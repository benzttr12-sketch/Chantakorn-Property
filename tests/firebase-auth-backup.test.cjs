const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Readable } = require('node:stream');
const { promisify } = require('node:util');
const { createDecipheriv, scrypt } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const { spawnSync } = require('node:child_process');

const runtime = () => import('../scripts/firebase-auth-backup-runtime.mjs');
const password = 'synthetic-auth-backup-password-20261028';
const project = 'demo-auth-backup';
function temporary(t) {
  const base = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(base, 'chantakorn-auth-backup-'));
  t.after(() => {
    if (!path.isAbsolute(root) || path.dirname(root) !== base || !path.basename(root).startsWith('chantakorn-auth-backup-')) throw new Error('Unsafe fixture cleanup path');
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}
function user(localId, extra = {}) {
  return { localId, email: 'fixture@example.invalid', disabled: false, emailVerified: true,
    displayName: 'ผู้ดูแลทดสอบ', createdAt: '1790000000000', validSince: '1790000000',
    providerUserInfo: [{ providerId: 'google.com', rawId: 'fixture-google-provider', displayName: 'ผู้ดูแลทดสอบ' }],
    customAttributes: JSON.stringify({ role: 'ADMIN', note: 'ข้อมูลทดสอบ' }), ...extra };
}
async function collect(iterable) { const rows = []; for await (const row of iterable) rows.push(row); return rows; }
function sourceFor(pages) {
  let calls = 0;
  return { get calls() { return calls; }, async page(request) { assert.equal(request.pageSize, 100); return pages[calls++]; } };
}
async function archive(t, raw = [user('fixture-user-a')]) {
  const r = await runtime(), root = temporary(t), filePath = path.join(root, 'accounts.auth.enc');
  const source = sourceFor([{ users: raw, nextPageToken: null }]);
  const manifest = await r.createAuthEncryptedArchive({ filePath, password, project,
    records: r.authMetadataRecords(source, r.authBackupLimits({})) });
  return { ...r, filePath, manifest };
}
async function decodeFixture(a) {
  const key = await promisify(scrypt)(password, Buffer.from(a.manifest.salt, 'hex'), 32, { N: 16384, r: 8, p: 1 });
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(a.manifest.iv, 'hex'));
  const { version, format, firebaseProject, scope, passwordHashesIncluded, credentialsRestorable, createdAt } = a.manifest;
  decipher.setAAD(Buffer.from(JSON.stringify({ version, format, firebaseProject, scope, passwordHashesIncluded, credentialsRestorable, createdAt })));
  decipher.setAuthTag(Buffer.from(a.manifest.tag, 'hex'));
  const text = gunzipSync(Buffer.concat([decipher.update(fs.readFileSync(a.filePath)), decipher.final()])).toString('utf8');
  return text.trim() ? text.trimEnd().split('\n').map(line => JSON.parse(line)) : [];
}

test('Auth metadata preserves provider links and claims while excluding password and token material', async () => {
  const { normalizeAuthUser } = await runtime();
  const row = normalizeAuthUser(user('fixture-uid', {
    passwordHash: 'fixture-password-hash', salt: 'fixture-salt', refreshToken: 'fixture-refresh-token',
    password: 'fixture-password', mfaInfo: [{ totpInfo: { sharedSecretKey: 'fixture-mfa-secret' } }],
    providerUserInfo: [{ providerId: 'google.com', rawId: 'provider-identity', federatedId: 'provider-identity-url', accessToken: 'fixture-provider-token' }],
  }));
  assert.equal(row.uid, 'fixture-uid');
  assert.equal(row.disabled, false);
  assert.deepEqual(row.providerData, [{ providerId: 'google.com', rawId: 'provider-identity', federatedId: 'provider-identity-url' }]);
  assert.deepEqual(row.customClaims, { role: 'ADMIN', note: 'ข้อมูลทดสอบ' });
  assert.equal(row.validSince, '1790000000');
  for (const forbidden of ['passwordHash', 'salt', 'refreshToken', 'password', 'mfaInfo', 'accessToken']) assert.ok(!JSON.stringify(row).includes(forbidden));
});

test('Auth listing uses fixed read-only Google endpoint and an abortable bounded stream without redirects or retries', async () => {
  const { authBackupSource } = await runtime();
  const calls = [];
  const client = { async request(options) {
    calls.push(options);
    return { status: 200, data: Readable.from([Buffer.from(JSON.stringify({ users: [user('a')], nextPageToken: 'next' }))]) };
  } };
  const source = authBackupSource({ client, project, timeoutMs: 15000 });
  const response = await source.page({ pageSize: 100, pageToken: 'opaque?token&safe=1' });
  assert.equal(response.users[0].localId, 'a');
  const url = new URL(calls[0].url);
  assert.equal(url.origin, 'https://identitytoolkit.googleapis.com');
  assert.equal(url.pathname, `/v1/projects/${project}/accounts:batchGet`);
  assert.equal(url.searchParams.get('nextPageToken'), 'opaque?token&safe=1');
  assert.equal(url.searchParams.get('maxResults'), '100');
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].responseType, 'stream');
  assert.equal(calls[0].retry, false);
  assert.equal(calls[0].maxRedirects, 0);
  assert.equal(calls[0].redirect, 'error');
  assert.ok(calls[0].timeout <= 15000 && calls[0].signal instanceof AbortSignal);
  assert.equal(calls[0].maxContentLength, 2 * 1024 * 1024);
  await assert.rejects(source.page({ pageSize: 1000 }), /AUTH_PAGE_INVALID/);
  assert.equal(calls.length, 1);
  assert.throws(() => authBackupSource({ client, project: 'project/other' }), /AUTH_PROJECT_INVALID/);
});

test('Auth stream byte cap and invalid response shapes fail before account processing', async () => {
  const { authBackupSource } = await runtime();
  const oversized = Readable.from([Buffer.alloc(2 * 1024 * 1024 + 1, 120)]);
  await assert.rejects(authBackupSource({ project, client: { request: async () => ({ status: 200, data: oversized }) } }).page({ pageSize: 100 }), /AUTH_PAGE_TOO_LARGE/);
  assert.equal(oversized.destroyed, true);
  for (const body of ['not json', '{"users":{}}', '[]']) {
    const source = authBackupSource({ project, client: { request: async () => ({ status: 200, data: Readable.from([Buffer.from(body)]) }) } });
    await assert.rejects(source.page({ pageSize: 100 }), /AUTH_PAGE_INVALID/);
  }
  const empty = authBackupSource({ project, client: { request: async () => ({ status: 200, data: Readable.from([Buffer.from('{}')]) }) } });
  assert.deepEqual(await empty.page({ pageSize: 100 }), { users: [], nextPageToken: undefined });
});

test('Auth shared deadline bounds even a credential adapter that ignores the request abort signal', async () => {
  const { authBackupSource } = await runtime();
  const source = authBackupSource({ project, timeoutMs: 5, client: {
    request: () => new Promise(resolve => setTimeout(() => resolve({ status: 200, data: Readable.from(['{}']) }), 40)),
  } });
  await assert.rejects(source.page({ pageSize: 100 }), /AUTH_BACKUP_TIMEOUT/);
});

test('Auth metadata pagination follows continuation and detects duplicate users or cyclic/malformed tokens', async () => {
  const { authMetadataRecords, authBackupLimits } = await runtime();
  const valid = sourceFor([{ users: [user('a')], nextPageToken: 'page-2' }, { users: [user('b', { disabled: true })] }]);
  assert.deepEqual((await collect(authMetadataRecords(valid))).map(row => [row.uid, row.disabled]), [['a', false], ['b', true]]);
  assert.equal(valid.calls, 2);
  const duplicate = sourceFor([{ users: [user('a')], nextPageToken: 'page-2' }, { users: [user('a')] }]);
  await assert.rejects(collect(authMetadataRecords(duplicate)), /AUTH_DUPLICATE_UID/);
  const cyclic = sourceFor([{ users: [], nextPageToken: 'same' }, { users: [], nextPageToken: 'same' }]);
  await assert.rejects(collect(authMetadataRecords(cyclic)), /AUTH_REPEATED_PAGE_TOKEN/);
  for (const nextPageToken of ['', 1, {}, 'x'.repeat(4097)]) {
    await assert.rejects(collect(authMetadataRecords(sourceFor([{ users: [], nextPageToken }]), authBackupLimits({}))), /AUTH_PAGE_INVALID/);
  }
});

test('Auth count, page, deadline, claims and malformed-user limits stop incomplete inventories', async () => {
  const { authMetadataRecords, authBackupLimits, normalizeAuthUser } = await runtime();
  const limits = authBackupLimits({});
  await assert.rejects(collect(authMetadataRecords(sourceFor([{ users: [user('a'), user('b')] }]), { ...limits, users: 1 })), /AUTH_USER_CAP/);
  const paged = sourceFor([{ users: [], nextPageToken: 'next' }, { users: [] }]);
  await assert.rejects(collect(authMetadataRecords(paged, { ...limits, pages: 1 })), /AUTH_PAGE_CAP/);
  assert.equal(paged.calls, 1);
  await assert.rejects(collect(authMetadataRecords({ page: async () => { await new Promise(resolve => setTimeout(resolve, 5)); return { users: [] }; } }, { ...limits, timeoutMs: 1 })), /AUTH_BACKUP_TIMEOUT/);
  await assert.rejects(collect(authMetadataRecords(sourceFor([{ users: Array.from({ length: 101 }, (_, i) => user(String(i))) }]))), /AUTH_PAGE_INVALID/);
  for (const extra of [{ customAttributes: '{bad' }, { customAttributes: '[]' }, { customAttributes: '{"x":"' + 'x'.repeat(1001) + '"}' }]) assert.throws(() => normalizeAuthUser(user('a', extra)), /AUTH_CLAIMS_INVALID/);
  for (const bad of [null, {}, user('', {}), user('a', { disabled: 'false' }), user('a', { providerUserInfo: [{ rawId: 'missing-provider' }] })]) assert.throws(() => normalizeAuthUser(bad), /AUTH_USER_INVALID/);
  for (const [key, value] of [['MAX_AUTH_BACKUP_USERS', '0'], ['MAX_AUTH_BACKUP_PAGES', '2001'], ['AUTH_BACKUP_TIMEOUT_MS', '900001']]) assert.throws(() => authBackupLimits({ [key]: value }), /AUTH_LIMIT_INVALID/);
});

test('real encrypted Auth archive preserves Thai/provider/claims and verifies without plaintext files or identifier leaks', async t => {
  const a = await archive(t, [user('ผู้ใช้ทดสอบ'), user('disabled-user', { disabled: true })]);
  assert.equal(a.manifest.records, 2);
  assert.equal(a.manifest.credentialsRestorable, false);
  assert.equal(a.manifest.passwordHashesIncluded, false);
  assert.equal(a.manifest.scope, 'project-default-users');
  const rows = await decodeFixture(a);
  assert.equal(rows[0].uid, 'ผู้ใช้ทดสอบ');
  assert.equal(rows[0].displayName, 'ผู้ดูแลทดสอบ');
  assert.equal(rows[0].providerData[0].rawId, 'fixture-google-provider');
  assert.equal(rows[0].customClaims.role, 'ADMIN');
  assert.equal(rows[1].disabled, true);
  const result = await a.verifyAuthEncryptedArchive({ ...a, password, expectedProject: project, highWaterMark: 7, decodedChunkSize: 64 });
  assert.deepEqual(result, { verified: true, records: 2, checksumVerified: true, passwordHashesIncluded: false, credentialsRestorable: false });
  assert.deepEqual(fs.readdirSync(path.dirname(a.filePath)).sort(), ['accounts.auth.enc', 'accounts.auth.enc.manifest.json']);
  assert.ok(!fs.readFileSync(a.filePath).includes(Buffer.from('ผู้ใช้ทดสอบ')));
  const manifestText = fs.readFileSync(`${a.filePath}.manifest.json`, 'utf8');
  for (const privateValue of ['ผู้ใช้ทดสอบ', 'disabled-user', 'fixture@example.invalid', 'fixture-google-provider', 'ADMIN']) assert.ok(!manifestText.includes(privateValue));
});

test('Auth verifier rejects wrong passphrase, tag/checksum/count changes and authenticated project-header tampering', async t => {
  const a = await archive(t);
  await assert.rejects(a.verifyAuthEncryptedArchive({ ...a, password: 'wrong-fixture-backup-password' }));
  await assert.rejects(a.verifyAuthEncryptedArchive({ ...a, password, manifest: { ...a.manifest, tag: '0'.repeat(32) } }));
  await assert.rejects(a.verifyAuthEncryptedArchive({ ...a, password, manifest: { ...a.manifest, records: 2 } }), /AUTH_RECORD_COUNT_MISMATCH/);
  await assert.rejects(a.verifyAuthEncryptedArchive({ ...a, password, manifest: { ...a.manifest, firebaseProject: 'demo-different-project' } }));
  await assert.rejects(a.verifyAuthEncryptedArchive({ ...a, password, expectedProject: 'demo-different-project' }), /AUTH_PROJECT_MISMATCH/);
  assert.throws(() => a.validateAuthManifest({ ...a.manifest, users: ['private-uid'] }), /AUTH_MANIFEST_INVALID/);
  const bytes = fs.readFileSync(a.filePath); bytes[0] ^= 1; fs.writeFileSync(a.filePath, bytes);
  await assert.rejects(a.verifyAuthEncryptedArchive({ ...a, password }), /AUTH_CHECKSUM_MISMATCH/);
});

test('Auth archives cannot overwrite existing files; failed/capped/concurrent creators preserve the winner', async t => {
  const r = await runtime(), root = temporary(t), filePath = path.join(root, 'failure.auth.enc');
  async function* failing() { yield r.normalizeAuthUser(user('a')); throw new Error('synthetic source failure'); }
  await assert.rejects(r.createAuthEncryptedArchive({ filePath, password, project, records: failing() }), /synthetic source failure/);
  assert.deepEqual(fs.readdirSync(root), []);
  const capped = r.authMetadataRecords(sourceFor([{ users: [user('a'), user('b')] }]), { ...r.authBackupLimits({}), users: 1 });
  await assert.rejects(r.createAuthEncryptedArchive({ filePath, password, project, records: capped }), /AUTH_USER_CAP/);
  assert.deepEqual(fs.readdirSync(root), []);
  const attempts = await Promise.allSettled([1, 2].map(() => r.createAuthEncryptedArchive({ filePath, password, project, records: [] })));
  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await r.verifyAuthEncryptedArchive({ filePath, password })).records, 0);
  await assert.rejects(r.createAuthEncryptedArchive({ filePath, password, project, records: [] }), /AUTH_ARCHIVE_EXISTS/);
  assert.equal((await r.verifyAuthEncryptedArchive({ filePath, password })).records, 0);
});

test('Auth path guard rejects repository/junction paths and invalid records cannot leave ciphertext or manifests', async t => {
  const r = await runtime(), root = temporary(t), filePath = path.join(root, 'invalid.auth.enc');
  const inRepo = path.resolve(__dirname, 'never-created.auth.enc');
  await assert.rejects(r.createAuthEncryptedArchive({ filePath: inRepo, password, project, records: [] }), /outside the Git/);
  assert.equal(fs.existsSync(inRepo), false);
  const alias = path.join(root, 'repository-junction');
  fs.symlinkSync(path.resolve(__dirname, '..'), alias, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(r.createAuthEncryptedArchive({ filePath: path.join(alias, 'never-created.auth.enc'), password, project, records: [] }), /outside the Git/);
  const otherRepo = path.join(root, 'another-checkout'); fs.mkdirSync(otherRepo); fs.writeFileSync(path.join(otherRepo, '.git'), 'gitdir: fixture');
  await assert.rejects(r.createAuthEncryptedArchive({ filePath: path.join(otherRepo, 'never-created.auth.enc'), password, project, records: [] }), /AUTH_ARCHIVE_IN_REPOSITORY/);
  const normalized = r.normalizeAuthUser(user('a'));
  for (const record of [{ ...normalized, passwordHash: 'must-not-store' }, { ...normalized, customClaims: { unsupported: undefined } }, { ...normalized, providerData: [{ providerId: 'google.com', constructor: 'hidden-token' }] }]) {
    await assert.rejects(r.createAuthEncryptedArchive({ filePath, password, project, records: [record] }), /AUTH_(RECORD|CLAIMS)_INVALID/);
    assert.equal(fs.existsSync(filePath), false);
    assert.equal(fs.existsSync(`${filePath}.manifest.json`), false);
  }
});

test('Auth CLI requires explicit read gate/project and never echoes passphrases, private filenames or ADC errors', t => {
  const root = temporary(t), filePath = path.join(root, 'private-user-id.auth.enc');
  const script = path.resolve(__dirname, '../scripts/firebase-auth-safe-backup.mjs');
  const baseEnv = { ...process.env, CHANTAKORN_BACKUP_PASSPHRASE: password,
    ALLOW_FIREBASE_AUTH_EXPORT_READS: '', FIREBASE_PROJECT_ID: '', GOOGLE_APPLICATION_CREDENTIALS: path.join(root, 'private-missing-credentials.json') };
  for (const [env, expected] of [[baseEnv, 'AUTH_EXPORT_READ_GATE'], [{ ...baseEnv, ALLOW_FIREBASE_AUTH_EXPORT_READS: 'I_UNDERSTAND', FIREBASE_PROJECT_ID: 'wrong-project' }, 'AUTH_PROJECT_MISMATCH']]) {
    const result = spawnSync(process.execPath, [script, 'backup', filePath], { encoding: 'utf8', env });
    assert.equal(result.status, 1);
    assert.deepEqual(JSON.parse(result.stderr.trim()), { ok: false, code: expected });
    assert.equal(result.stdout, '');
    assert.ok(!result.stderr.includes(password) && !result.stderr.includes('private-user-id') && !result.stderr.includes('private-missing-credentials'));
    assert.equal(fs.existsSync(filePath), false);
  }
});
