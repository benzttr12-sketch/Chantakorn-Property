const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createDecipheriv, scryptSync, randomBytes, createHash } = require('node:crypto');
const { gunzipSync, gzipSync } = require('node:zlib');
const { spawnSync } = require('node:child_process');

const runtime = import(pathToFileURL(path.resolve(__dirname, '../scripts/r2-backup-runtime.mjs')).href);
const shared = import(pathToFileURL(path.resolve(__dirname, '../scripts/firestore-backup-runtime.mjs')).href);
const accountId = 'a'.repeat(32), password = 'fixture-only-long-encryption-password', bucket = 'private-media-test';
const object = (key, bytes) => ({ key, size: bytes.length, etag: createHash('md5').update(bytes).digest('hex'), last_modified: '2026-10-28T00:00:00.000Z',
  http_metadata: { contentType: 'image/jpeg', cacheControl: 'private, no-store' }, custom_metadata: { owner: 'fixture-private-user' }, storage_class: 'Standard' });
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'r2-backup-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, filePath: path.join(root, 'backup.r2.enc') };
}
function sourceFor(entries, options = {}) {
  let inventories = 0;
  return {
    async list({ bucket: requested, cursor }) {
      assert.equal(requested, bucket);
      if (!cursor) inventories++;
      const records = entries.map(entry => object(entry.key, entry.bytes));
      if (options.changeOnRescan && inventories > 1 && records[0]) records[0].last_modified = '2026-10-28T00:01:00Z';
      if (options.paginate && !cursor) return { items: records.slice(0, 1), cursor: 'page-two' };
      return { items: options.paginate ? records.slice(1) : records };
    },
    async read({ item }) {
      const entry = entries.find(record => record.key === item.key);
      return (async function* () { yield entry.bytes.subarray(0, 7); if (entry.bytes.length > 7) yield entry.bytes.subarray(7); })();
    },
  };
}
function decryptRecords(filePath, manifest) {
  const key = scryptSync(password, Buffer.from(manifest.salt, 'hex'), 32, { N: 16384, r: 8, p: 1 });
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(manifest.iv, 'hex')); decipher.setAuthTag(Buffer.from(manifest.tag, 'hex'));
  decipher.setAAD(Buffer.from(JSON.stringify({ version: 1, kind: 'r2-backup', format: 'r2-jsonl-v1',
    accountId: manifest.accountId, buckets: Object.keys(manifest.buckets).sort(), createdAt: manifest.createdAt })));
  const zipped = Buffer.concat([decipher.update(fs.readFileSync(filePath)), decipher.final()]); key.fill(0);
  return gunzipSync(zipped).toString('utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}

test('R2 binary backup round-trips all original bytes and private metadata, while only ciphertext and redacted manifest reach disk', async t => {
  const api = await runtime, { filePath, root } = fixture(t);
  const entries = [{ key: 'inquiries/customer-private/photo-หนึ่ง.jpg', bytes: randomBytes(170003) }, { key: 'empty-object', bytes: Buffer.alloc(0) }];
  const manifest = await api.createR2EncryptedArchive({ filePath, password, source: sourceFor(entries, { paginate: true }), accountId, buckets: [bucket] });
  assert.deepEqual(await api.verifyR2EncryptedArchive({ filePath, manifest, password, highWaterMark: 7 }),
    { verified: true, objects: 2, bytes: entries[0].bytes.length, bucketCount: 1, checksumVerified: true, objectDigestsVerified: true });
  const records = decryptRecords(filePath, manifest);
  let current, recovered = [];
  for (const record of records) {
    if (record.type === 'object') { current = { key: record.metadata.key, chunks: [], metadata: record.metadata }; recovered.push(current); }
    if (record.type === 'chunk') current.chunks.push(Buffer.from(record.data, 'base64'));
  }
  for (const entry of entries) {
    const result = recovered.find(item => item.key === entry.key);
    assert.deepEqual(Buffer.concat(result.chunks), entry.bytes);
    assert.equal(result.metadata.custom_metadata.owner, 'fixture-private-user');
  }
  const plaintextManifest = fs.readFileSync(`${filePath}.manifest.json`, 'utf8');
  assert.equal(plaintextManifest.includes('customer-private'), false); assert.equal(plaintextManifest.includes('fixture-private-user'), false);
  assert.equal(fs.readFileSync(filePath).includes(Buffer.from(entries[0].key)), false);
  assert.deepEqual(fs.readdirSync(root).sort(), ['backup.r2.enc', 'backup.r2.enc.manifest.json']);
});

test('R2 verification rejects wrong password, ciphertext tamper, forged count and failed GCM authentication', async t => {
  const api = await runtime, { filePath } = fixture(t);
  const manifest = await api.createR2EncryptedArchive({ filePath, password, source: sourceFor([{ key: 'private/key', bytes: Buffer.from('sensitive fixture') }]), accountId, buckets: [bucket] });
  await assert.rejects(api.verifyR2EncryptedArchive({ filePath, manifest, password: 'wrong-password-that-is-long-enough' }));
  await assert.rejects(api.verifyR2EncryptedArchive({ filePath, manifest: { ...manifest, accountId: 'b'.repeat(32) }, password }));
  await assert.rejects(api.verifyR2EncryptedArchive({ filePath, manifest: { ...manifest, createdAt: '2026-10-27T00:00:00.000Z' }, password }));
  await assert.rejects(api.verifyR2EncryptedArchive({ filePath, manifest: { ...manifest, objects: 5 }, password }), /R2_INVALID_MANIFEST/);
  await assert.rejects(api.verifyR2EncryptedArchive({ filePath, manifest: { ...manifest, tag: `${manifest.tag.startsWith('0') ? '1' : '0'}${manifest.tag.slice(1)}` }, password }));
  const bytes = fs.readFileSync(filePath); bytes[0] ^= 1; fs.writeFileSync(filePath, bytes);
  await assert.rejects(api.verifyR2EncryptedArchive({ filePath, manifest, password }), /R2_CHECKSUM_MISMATCH/);
});

test('R2 second inventory detects concurrent changes and removes only its own incomplete ciphertext', async t => {
  const api = await runtime, { filePath, root } = fixture(t);
  await assert.rejects(api.createR2EncryptedArchive({ filePath, password,
    source: sourceFor([{ key: 'private/key', bytes: Buffer.from('fixture') }], { changeOnRescan: true }), accountId, buckets: [bucket] }), /R2_INVENTORY_CHANGED/);
  assert.deepEqual(fs.readdirSync(root), []);
  fs.writeFileSync(filePath, 'existing archive must survive');
  await assert.rejects(api.createR2EncryptedArchive({ filePath, password, source: sourceFor([]), accountId, buckets: [bucket] }), /R2_ARCHIVE_EXISTS/);
  assert.equal(fs.readFileSync(filePath, 'utf8'), 'existing archive must survive');
});

test('R2 encrypted context authenticates empty bucket inventory and account labels', async t => {
  const api = await runtime, { filePath } = fixture(t);
  const manifest = await api.createR2EncryptedArchive({ filePath, password, accountId, buckets: [bucket],
    source: { list: async () => ({ items: [] }) } });
  assert.equal((await api.verifyR2EncryptedArchive({ filePath, manifest, password })).objects, 0);
  await assert.rejects(api.verifyR2EncryptedArchive({ filePath, password,
    manifest: { ...manifest, buckets: { 'other-empty-bucket': { objects: 0, bytes: 0 } } } }));
});

test('R2 rejects incomplete/object-cap scans, repeated cursors, duplicate keys and byte-size changes', async t => {
  const api = await runtime, { filePath } = fixture(t), limits = api.r2BackupLimits();
  const entries = [{ key: 'private/one', bytes: Buffer.from('one') }, { key: 'private/two', bytes: Buffer.from('two') }];
  await assert.rejects(api.createR2EncryptedArchive({ filePath, password, source: sourceFor(entries), accountId, buckets: [bucket], limits: { ...limits, objects: 1 } }), /R2_DATA_CAP/);
  await assert.rejects(api.createR2EncryptedArchive({ filePath, password, source: { list: async () => ({ items: [], cursor: 'repeat' }) }, accountId, buckets: [bucket] }), /R2_REPEATED_CURSOR/);
  await assert.rejects(api.createR2EncryptedArchive({ filePath, password, source: sourceFor([entries[0], entries[0]]), accountId, buckets: [bucket] }), /R2_DUPLICATE_OBJECT/);
  const changed = sourceFor([entries[0]]); changed.read = async () => (async function* () { yield Buffer.from('too many bytes'); })();
  await assert.rejects(api.createR2EncryptedArchive({ filePath, password, source: changed, accountId, buckets: [bucket] }), /R2_OBJECT_SIZE_MISMATCH/);
  assert.equal(fs.existsSync(filePath), false); assert.equal(fs.existsSync(`${filePath}.manifest.json`), false);
});

test('R2 source preserves required literal key slashes, encodes other reserved characters and keeps raw bytes without redirects or remote writes', async () => {
  const api = await runtime, compressed = gzipSync(Buffer.from('raw compressed object bytes'));
  const item = object('folder/private ?#ไทย.gz', compressed), calls = [];
  const source = api.r2BackupSource({ accountId, token: 'fixture-bearer-token', request: async (url, options) => {
    calls.push({ url, options });
    if (url.search) return { status: 200, body: [Buffer.from(JSON.stringify({ success: true, result: [item] }))] };
    return { status: 200, headers: new Headers({ 'content-length': String(item.size), etag: `"${item.etag}"`, 'content-encoding': 'gzip' }), body: [compressed] };
  } });
  assert.deepEqual((await source.list({ bucket })).items, [item]);
  const body = await source.read({ bucket, item }), chunks = []; for await (const chunk of body) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), compressed);
  assert.equal(calls[1].url.origin, 'https://api.cloudflare.com');
  assert.equal(calls[1].url.pathname.endsWith(item.key.split('/').map(encodeURIComponent).join('/')), true);
  assert.equal(calls[1].url.pathname.includes('%2F'), false);
  assert.equal(calls[1].url.search, ''); assert.equal(calls[1].url.hash, '');
  assert.equal(calls[1].options.headers['Accept-Encoding'], 'identity');
  let closed = false;
  const redirected = api.r2BackupSource({ accountId, token: 'fixture-bearer-token', request: async () => ({ status: 302, body: { destroy() { closed = true; } } }) });
  await assert.rejects(redirected.list({ bucket }), /R2_LIST_FAILED/); assert.equal(closed, true);
});

test('R2 source caps requests and rejects malformed pagination or changed etags before consuming object bytes', async () => {
  const api = await runtime, limits = { ...api.r2BackupLimits(), requests: 1 };
  const source = api.r2BackupSource({ accountId, token: 'fixture-bearer-token', limits, request: async () => ({ status: 200, body: [Buffer.from('{"success":true,"result":[]}')] }) });
  await source.list({ bucket }); await assert.rejects(source.list({ bucket }), /R2_REQUEST_CAP/);
  const malformed = api.r2BackupSource({ accountId, token: 'fixture-bearer-token', request: async () => ({ status: 200, body: [Buffer.from('{"success":true,"result":[],"result_info":{"is_truncated":true}}')] }) });
  await assert.rejects(malformed.list({ bucket }), /R2_INVALID_LIST_PAGE/);
  const changed = api.r2BackupSource({ accountId, token: 'fixture-bearer-token', request: async () => ({ status: 200, headers: new Headers({ 'content-length': '1', etag: 'different' }), body: { destroy() {} } }) });
  await assert.rejects(changed.read({ bucket, item: object('key', Buffer.from('x')) }), /R2_OBJECT_CHANGED_OR_UNAVAILABLE/);
  await assert.rejects(changed.read({ bucket, item: object('private/../different-key', Buffer.from('x')) }), /R2_INVALID_OBJECT_METADATA/);
});

test('Wrangler token retrieval is captured privately with disk logging and telemetry disabled', async () => {
  const api = await runtime; let captured;
  const token = await api.wranglerBackupToken(path.resolve(__dirname, '..'), { CHANTAKORN_BACKUP_PASSPHRASE: 'private-fixture-vault-password' }, async (executable, args, options) => {
    captured = { executable, args, options }; return { stdout: JSON.stringify({ type: 'oauth', token: 'fixture-secret-token-value' }) };
  });
  assert.equal(token, 'fixture-secret-token-value'); assert.equal(captured.options.env.WRANGLER_WRITE_LOGS, 'false');
  assert.equal(captured.options.env.WRANGLER_SEND_METRICS, 'false'); assert.equal(captured.args.includes(token), false);
  assert.equal(Object.hasOwn(captured.options.env, 'CHANTAKORN_BACKUP_PASSPHRASE'), false);
  await assert.rejects(api.wranglerBackupToken(path.resolve(__dirname, '..'), {}, async () => { throw new Error('provider exception with private token'); }), /R2_AUTH_UNAVAILABLE/);
});

test('R2 CLI enforces explicit read gate and safely redacts operational failures; outside-repo guard resolves symlinks', async t => {
  const api = await runtime, { outsideRepositoryPath } = await shared, { root, filePath } = fixture(t);
  const repository = path.join(root, 'repo'); fs.mkdirSync(repository);
  assert.throws(() => outsideRepositoryPath(path.join(repository, 'secret.enc'), repository), /outside the Git repository/);
  const link = path.join(root, 'repo-link');
  try { fs.symlinkSync(repository, link, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (error.code !== 'EPERM') throw error; }
  if (fs.existsSync(link)) assert.throws(() => outsideRepositoryPath(path.join(link, 'secret.enc'), repository), /outside the Git repository/);
  const cli = path.resolve(__dirname, '../scripts/r2-safe-backup.mjs');
  const result = spawnSync(process.execPath, [cli, 'backup', filePath], { encoding: 'utf8', env: { ...process.env, ALLOW_R2_EXPORT_READS: '', CHANTAKORN_BACKUP_PASSPHRASE: password } });
  assert.equal(result.status, 1); assert.equal(result.stderr.trim(), '{"ok":false,"code":"R2_READ_GATE"}');
  assert.equal(result.stderr.includes(password), false); assert.equal(result.stderr.includes(root), false); assert.equal(fs.existsSync(filePath), false);
  assert.deepEqual(api.parseR2Buckets('private-one,public-two'), ['private-one', 'public-two']);
  assert.throws(() => api.parseR2Buckets('private-one,private-one'), /R2_INVALID_BUCKETS/);
  assert.throws(() => api.r2BackupLimits({ MAX_R2_BACKUP_BYTES: 'Infinity' }), /R2_INVALID_LIMITS/);
});
