const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Timestamp, GeoPoint } = require('@google-cloud/firestore');

const runtime = () => import('../scripts/firestore-backup-runtime.mjs');
const password = 'offline-fixture-passphrase-20261020';
function temporary(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chantakorn-backup-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function fixture() {
  const thaiCollection = 'ข้อมูลลูกค้า'.repeat(12);
  const rows = new Map([
    ['profiles/staff', { email: 'fixture@example.invalid', role: 'ADMIN' }],
    ['inquiries/deleted-parent/notes/note', { message: 'ลูกค้าไทย', created: new Timestamp(1000, 123), point: new GeoPoint(7, 100) }],
    ['line_followers/fixture-line', { opted_out: true }],
    [`${thaiCollection}/ลูกค้า`, { name: 'ลูกค้าทดสอบ'.repeat(20), bytes: Buffer.from([0, 255, 1]) }],
  ]);
  const missing = new Set(['inquiries/deleted-parent']);
  const allPaths = [...rows.keys(), ...missing];
  const calls = [];
  function page(items, pageToken) {
    // Two entries per fixture page forces the production traversal through continuation tokens.
    const offset = Number(pageToken || 0);
    return { items: items.slice(offset, offset + 2), nextPageToken: offset + 2 < items.length ? String(offset + 2) : undefined };
  }
  const source = {
    async collections(request) {
      calls.push(['collections', request]);
      const prefix = request.parent ? `${request.parent}/` : '';
      const ids = [...new Set(allPaths.filter(p => p.startsWith(prefix)).map(p => p.slice(prefix.length).split('/')).filter(p => p.length >= 2).map(p => p[0]))];
      return page(ids, request.pageToken);
    },
    async documents(request) {
      calls.push(['documents', request]);
      const prefix = request.parent ? `${request.parent}/${request.collectionId}/` : `${request.collectionId}/`;
      const docs = allPaths.filter(p => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'));
      return page(docs.map(p => ({ path: p, exists: rows.has(p) })), request.pageToken);
    },
    async snapshot(p) { calls.push(['snapshot', p]); return { exists: rows.has(p), data: () => rows.get(p) }; },
  };
  return { source, rows, calls, thaiCollection };
}
async function collect(iterable) { const result = []; for await (const item of iterable) result.push(item); return result; }

test('off-repo guard handles native Windows paths, siblings, junctions and relative input', async t => {
  const { outsideRepositoryPath } = await runtime();
  const root = temporary(t), repo = path.join(root, 'repo'), sibling = path.join(root, 'repo-sibling');
  fs.mkdirSync(repo); fs.mkdirSync(sibling);
  assert.throws(() => outsideRepositoryPath(path.join(repo, 'archive.enc'), repo), /outside the Git/);
  assert.throws(() => outsideRepositoryPath('relative.enc', repo), /absolute/);
  assert.equal(outsideRepositoryPath(path.join(sibling, 'archive.enc'), repo), path.join(fs.realpathSync(sibling), 'archive.enc'));
  const alias = path.join(sibling, 'points-into-repo');
  fs.symlinkSync(repo, alias, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => outsideRepositoryPath(path.join(alias, 'archive.enc'), repo), /outside the Git/);
  const existing = path.join(repo, 'existing.enc'); fs.writeFileSync(existing, 'fixture');
  assert.throws(() => outsideRepositoryPath(path.join(alias, 'existing.enc'), repo, { existing: true }), /outside the Git/);
});

test('actual export traversal includes descendants below missing parents and follows bounded pages', async () => {
  const { firestoreRecords, backupLimits } = await runtime();
  const f = fixture(), counts = { records: 0, collections: Object.create(null) };
  const lines = await collect(firestoreRecords(f.source, counts, backupLimits({})));
  const decoded = lines.map(line => JSON.parse(line));
  assert.equal(counts.records, 4);
  assert.equal(decoded.length, 4);
  assert.ok(decoded.some(row => row.path === 'inquiries/deleted-parent/notes/note'));
  assert.ok(!decoded.some(row => row.path === 'inquiries/deleted-parent'));
  assert.equal(counts.collections['inquiries/{doc}/notes'], 1);
  assert.ok(f.calls.some(([method, request]) => method === 'collections' && request.pageToken));
  assert.ok(f.calls.filter(([method]) => method !== 'snapshot').every(([, request]) => request.pageSize === 100));
});

test('SDK adapter explicitly requests missing ancestors, named database and manual metadata pagination', async () => {
  const { firestoreBackupSource } = await runtime();
  const prefix = 'projects/demo-backup/databases/named-fixture/documents';
  const calls = [];
  const source = firestoreBackupSource({ project: 'demo-backup', database: 'named-fixture',
    db: { doc: p => ({ get: async () => ({ path: p }) }) },
    discovery: {
      async listCollectionIds(request, options) { calls.push({ request, options }); return [['notes'], null, { nextPageToken: 'next' }]; },
      async listDocuments(request, options) { calls.push({ request, options }); return [[{ name: `${prefix}/inquiries/gone` }, { name: `${prefix}/inquiries/live`, createTime: { seconds: '1' } }], null, {}]; },
    } });
  assert.equal((await source.collections({ parent: 'inquiries/gone', pageSize: 100 })).nextPageToken, 'next');
  const page = await source.documents({ parent: '', collectionId: 'inquiries', pageSize: 100, pageToken: 'page-2' });
  assert.deepEqual(page.items, [{ path: 'inquiries/gone', exists: false }, { path: 'inquiries/live', exists: true }]);
  assert.equal(calls[0].request.parent, `${prefix}/inquiries/gone`);
  assert.equal(calls[1].request.showMissing, true);
  assert.equal(calls[1].request.pageToken, 'page-2');
  assert.deepEqual(calls[1].request.mask, { fieldPaths: [] });
  assert.ok(calls.every(call => call.options.autoPaginate === false && call.options.retry === null));
  assert.deepEqual(await source.snapshot('profiles/staff'), { path: 'profiles/staff' });
});

test('discovery, location, collection, depth and document limits fail closed', async () => {
  const { firestoreRecords, backupLimits } = await runtime();
  for (const [name, expected] of [['records', /document cap/], ['locations', /location cap/], ['requests', /request cap/], ['collections', /collection cap/], ['depth', /depth cap/]]) {
    const { source } = fixture();
    await assert.rejects(collect(firestoreRecords(source, { records: 0, collections: {} }, { ...backupLimits({}), [name]: 1 })), expected);
  }
  assert.throws(() => backupLimits({ MAX_BACKUP_DISCOVERY_REQUESTS: '0' }), /Invalid/);
  assert.throws(() => backupLimits({ MAX_BACKUP_RECORDS: '200001' }), /Invalid/);
});

test('changing or duplicate discovery cannot produce an apparently complete archive', async () => {
  const { firestoreRecords, backupLimits } = await runtime();
  const changed = fixture(); changed.source.snapshot = async () => ({ exists: false });
  await assert.rejects(collect(firestoreRecords(changed.source, { records: 0, collections: {} }, backupLimits({}))), /changed during backup/);
  const repeated = fixture(); repeated.source.collections = async () => ({ items: [], nextPageToken: 'same-token' });
  await assert.rejects(collect(firestoreRecords(repeated.source, { records: 0, collections: {} }, backupLimits({}))), /Repeated discovery/);
});

async function archive(t) {
  const r = await runtime(), f = fixture(), root = temporary(t), filePath = path.join(root, 'fixture.firestore.enc');
  const counts = { records: 0, collections: {} };
  const manifest = await r.createEncryptedArchive({ filePath, password, counts,
    records: r.firestoreRecords(f.source, counts, r.backupLimits({})),
    metadata: { firestoreProject: 'demo-backup', firestoreDatabase: 'fixture-named' } });
  return { ...r, filePath, manifest };
}

test('real encrypted export and verifier preserve Thai across forced UTF-8 chunk boundaries', async t => {
  const a = await archive(t);
  const result = await a.verifyEncryptedArchive({ ...a, password, highWaterMark: 7, decodedChunkSize: 64 });
  assert.equal(result.records, 4);
  assert.equal(result.checksumVerified, true);
  const ciphertext = fs.readFileSync(a.filePath);
  assert.ok(!ciphertext.includes(Buffer.from('ลูกค้า')));
  assert.ok(!fs.readFileSync(`${a.filePath}.manifest.json`, 'utf8').includes('fixture-line'));
});

test('wrong passphrase, authentication tag, ciphertext and count tampering reject cleanly', async t => {
  const a = await archive(t);
  await assert.rejects(a.verifyEncryptedArchive({ ...a, password: 'different-passphrase-value' }));
  await assert.rejects(a.verifyEncryptedArchive({ ...a, password, manifest: { ...a.manifest, tag: '0'.repeat(32) } }));
  await assert.rejects(a.verifyEncryptedArchive({ ...a, password, manifest: { ...a.manifest, records: 5 } }), /manifest/);
  const bytes = fs.readFileSync(a.filePath); bytes[0] ^= 1; fs.writeFileSync(a.filePath, bytes);
  await assert.rejects(a.verifyEncryptedArchive({ ...a, password }), /checksum mismatch/);
});

test('failed scan cleans only its own incomplete files and preserves existing archives', async t => {
  const { createEncryptedArchive } = await runtime(), root = temporary(t), filePath = path.join(root, 'incomplete.enc');
  const options = { filePath, password, counts: { records: 0, collections: {} }, metadata: { firestoreProject: 'demo-backup', firestoreDatabase: 'fixture' } };
  async function* fail() { yield 'fixture\n'; throw new Error('scan stopped'); }
  await assert.rejects(createEncryptedArchive({ ...options, records: fail() }), /scan stopped/);
  assert.equal(fs.existsSync(filePath), false);
  fs.writeFileSync(filePath, 'existing-archive');
  await assert.rejects(createEncryptedArchive({ ...options, records: [] }), /never be overwritten/);
  assert.equal(fs.readFileSync(filePath, 'utf8'), 'existing-archive');
});

test('concurrent creators cannot delete the winning archive after exclusive-open rejection', async t => {
  const { createEncryptedArchive, verifyEncryptedArchive } = await runtime(), root = temporary(t), filePath = path.join(root, 'race.enc');
  const options = { filePath, password, counts: { records: 0, collections: {} }, records: [], metadata: { firestoreProject: 'demo-backup', firestoreDatabase: 'fixture' } };
  const results = await Promise.allSettled([createEncryptedArchive(options), createEncryptedArchive(options)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const manifest = results.find(r => r.status === 'fulfilled').value;
  assert.equal((await verifyEncryptedArchive({ filePath, password, manifest })).records, 0);
});
