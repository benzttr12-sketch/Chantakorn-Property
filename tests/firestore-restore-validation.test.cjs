const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { Firestore, Timestamp, GeoPoint, DocumentReference } = require('@google-cloud/firestore');

const runtime = () => import('../scripts/firestore-restore-validation.mjs');
const codec = () => import('../scripts/firestore-backup-codec.mjs');
const archiveRuntime = () => import('../scripts/firestore-backup-runtime.mjs');
const password = 'synthetic-restore-fixture-passphrase-20261028';
const target = { host: '127.0.0.1:8085', project: 'demo-chantakorn-restore', database: 'restore-synthetic-fixture' };

function temporary(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chantakorn-restore-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function fixtureRows(referenceDb) {
  const data = { name: 'ลูกค้าทดสอบ', enabled: false, empty: null, count: 17, price: 1.75,
    timestamp: new Timestamp(1234, 987654000), point: new GeoPoint(7.4727, 100.4414),
    date: new Date('2026-10-01T12:34:56.789Z'), bytes: Buffer.from([0, 255, 7]),
    reference: referenceDb.doc('profiles/synthetic-admin'), constructor: 'ordinary stored field', nested: { values: ['ไทย', 0, true] } };
  return new Map([
    ['profiles/synthetic-admin', data],
    ['inquiries/missing-parent/notes/synthetic-note', { message: 'ข้อความภาษาไทย'.repeat(7) }],
    ['line_followers/synthetic-follower', { opted_out: true }],
  ]);
}

async function fixtureArchive(t, { rawRows, rows } = {}) {
  const { createEncryptedArchive } = await archiveRuntime();
  const { encodeFirestoreValue, redactCollectionPath } = await codec();
  const referenceDb = new Firestore({ projectId: 'demo-archive-fixture', databaseId: 'source-fixture' });
  t.after(() => referenceDb.terminate());
  const actualRows = rawRows || [...(rows || fixtureRows(referenceDb))].map(([docPath, data]) => ({ path: docPath,
    create_time: encodeFirestoreValue(new Timestamp(1000, 1)), update_time: encodeFirestoreValue(new Timestamp(1001, 2)), data: encodeFirestoreValue(data) }));
  const counts = { records: actualRows.length, collections: Object.create(null) };
  for (const row of actualRows) {
    const key = redactCollectionPath(row.path.split('/').slice(0, -1).join('/'));
    counts.collections[key] = (counts.collections[key] || 0) + 1;
  }
  const filePath = path.join(temporary(t), 'synthetic.firestore.enc');
  const manifest = await createEncryptedArchive({ filePath, password, counts,
    records: actualRows.map(row => JSON.stringify(row) + '\n'), metadata: { firestoreProject: 'demo-archive-fixture', firestoreDatabase: 'source-fixture' } });
  return { filePath, manifest, password, actualRows };
}

function fakeDestination(t, { nonempty = false, mismatch = false, race = false } = {}) {
  const referenceDb = new Firestore({ projectId: target.project, databaseId: target.database });
  t.after(() => referenceDb.terminate());
  const rows = new Map(), calls = [];
  return {
    rows, calls,
    factory(configuration) {
      calls.push(['factory', configuration]);
      return {
        async listCollections() { calls.push(['list']); return nonempty ? [{}] : []; },
        doc(docPath) { return referenceDb.doc(docPath); },
        batch() {
          const pending = [];
          return {
            create(reference, data) { calls.push(['create']); pending.push([reference.path, data]); return this; },
            async commit() {
              if (race || pending.some(([docPath]) => rows.has(docPath))) throw new Error('ALREADY_EXISTS');
              for (const [docPath, data] of pending) rows.set(docPath, data);
              calls.push(['commit']);
            },
          };
        },
        async getAll(...references) {
          calls.push(['getAll']);
          return references.map(reference => ({ exists: rows.has(reference.path), ref: reference,
            data: () => mismatch ? { bad: 'different-content' } : rows.get(reference.path) }));
        },
        async terminate() { calls.push(['terminate']); },
      };
    },
  };
}

test('restore destination rejects production, remote or ambiguous emulator targets', async () => {
  const { isolatedRestoreTarget } = await runtime();
  assert.deepEqual(isolatedRestoreTarget(target), target);
  assert.equal(isolatedRestoreTarget({ ...target, host: '[::1]:8085' }).host, '[::1]:8085');
  for (const host of [undefined, 'localhost:8085', '0.0.0.0:8085', '192.168.1.1:8085', 'firestore.googleapis.com:443',
    'http://127.0.0.1:8085', '127.0.0.1', '127.0.0.1:80', '127.0.0.1:8085/path', '127.0.0.1:8085@evil.test:8085']) {
    assert.throws(() => isolatedRestoreTarget({ ...target, host }), /loopback/);
  }
  for (const project of [undefined, 'project-d417918c-0e3b-4185-812', 'production', 'demo-']) {
    assert.throws(() => isolatedRestoreTarget({ ...target, project }), /demo-/);
  }
  for (const database of [undefined, '(default)', 'production', 'restore-', 'restore-a/path']) {
    assert.throws(() => isolatedRestoreTarget({ ...target, database }), /named database/);
  }
});

test('native decoder retains timestamps, geopoints, bytes, references, dates and prototype-named fields', async t => {
  const { decodeFirestoreValue } = await runtime(), { encodeFirestoreValue } = await codec();
  const referenceDb = new Firestore({ projectId: target.project, databaseId: target.database });
  t.after(() => referenceDb.terminate());
  const original = fixtureRows(referenceDb).get('profiles/synthetic-admin');
  original.timestamp = new Timestamp(1234, 987654321);
  Object.defineProperty(original, '__proto__', { value: { retained: true }, enumerable: true });
  const decoded = decodeFirestoreValue(encodeFirestoreValue(original), docPath => referenceDb.doc(docPath));
  assert.ok(decoded.timestamp instanceof Timestamp);
  assert.equal(decoded.timestamp.nanoseconds, 987654321);
  assert.ok(decoded.point instanceof GeoPoint);
  assert.ok(decoded.reference instanceof DocumentReference);
  assert.equal(decoded.reference.path, 'profiles/synthetic-admin');
  assert.equal(decoded.reference.firestore.projectId, target.project);
  assert.deepEqual(decoded.bytes, Buffer.from([0, 255, 7]));
  assert.equal(decoded.date.toISOString(), original.date.toISOString());
  assert.equal(Object.getPrototypeOf(decoded), Object.prototype);
  assert.deepEqual(Object.getOwnPropertyDescriptor(decoded, '__proto__').value, { retained: true });
  assert.equal({}.retained, undefined);
});

test('decoder rejects unknown tags, malformed native values and duplicate map fields', async () => {
  const { decodeFirestoreValue } = await runtime();
  for (const encoded of [
    { $fs: 'unknown' }, { $fs: 'timestamp', seconds: 1, nanoseconds: 1.5 },
    { $fs: 'timestamp', seconds: 1, nanoseconds: 1000000000 },
    { $fs: 'geopoint', latitude: 91, longitude: 100 }, { $fs: 'bytes', base64: 'bad%%' },
    { $fs: 'date', iso: 'invalid' }, { $fs: 'reference', path: 'profiles' },
    { $fs: 'reference', path: 'profiles/..' }, { $fs: 'array', values: 'bad' },
    { $fs: 'map', entries: [['same', 1], ['same', 2]] },
    { $fs: 'map', entries: [['field', 1]], extra: 'rejected' },
  ]) assert.throws(() => decodeFirestoreValue(encoded));
});

test('authenticated sample reads preserve Thai across chunks and bounded sampling retains source inventory', async t => {
  const { readRestoreSample, restoreLimits } = await runtime();
  const a = await fixtureArchive(t);
  const result = await readRestoreSample({ ...a, highWaterMark: 7, decodedChunkSize: 64,
    limits: { ...restoreLimits({}), sampleRecords: 2 } });
  assert.equal(result.authenticated, true);
  assert.equal(result.checksumVerified, true);
  assert.equal(result.sourceRecords, 3);
  assert.equal(result.sample.length, 2);
  assert.equal(result.sourceCollectionCount, 3);
  assert.equal(result.sample[1].path, 'inquiries/missing-parent/notes/synthetic-note');
  assert.ok(JSON.stringify(result.sample[1]).includes('ข้อความภาษาไทย'));
  assert.ok(Object.isFrozen(result.sample[1].data.entries));
  assert.throws(() => result.sample.push({}), TypeError);
});

test('create-only restore verifies typed sample without inventing missing ancestors or restoring server metadata', async t => {
  const { readRestoreSample, restoreToIsolatedEmulator } = await runtime();
  const archive = await readRestoreSample(await fixtureArchive(t));
  const destination = fakeDestination(t);
  const result = await restoreToIsolatedEmulator({ archive, target, clientFactory: destination.factory });
  assert.deepEqual(result, { restored: true, verified: true, sampleRecords: 3, sourceRecords: 3,
    sampleLimited: false, serverTimestampsRestored: false, destination: 'local-demo-emulator' });
  assert.equal(destination.rows.has('inquiries/missing-parent'), false);
  assert.equal(destination.rows.has('inquiries/missing-parent/notes/synthetic-note'), true);
  assert.equal(destination.rows.get('profiles/synthetic-admin').create_time, undefined);
  assert.equal(destination.calls.filter(([name]) => name === 'create').length, 3);
  assert.deepEqual(destination.calls.at(-1), ['terminate']);
});

test('checksum, authentication tag and inventory failures reject before sample can reach a writer', async t => {
  const { readRestoreSample } = await runtime();
  const a = await fixtureArchive(t);
  await assert.rejects(readRestoreSample({ ...a, password: 'a-distinct-wrong-fixture-passphrase' }));
  await assert.rejects(readRestoreSample({ ...a, manifest: { ...a.manifest, tag: '00'.repeat(16) } }));
  const collections = { ...a.manifest.collections, profiles: 2 };
  await assert.rejects(readRestoreSample({ ...a, manifest: { ...a.manifest, records: 4, collections } }), /inventory/);
  const bytes = fs.readFileSync(a.filePath); bytes[0] ^= 1; fs.writeFileSync(a.filePath, bytes);
  await assert.rejects(readRestoreSample(a), /checksum/);
});

test('malformed duplicate paths and invalid typed fields never become an authenticated sample', async t => {
  const { readRestoreSample } = await runtime();
  const row = { path: 'profiles/synthetic', data: { $fs: 'map', entries: [['field', 'safe']] } };
  const duplicate = await fixtureArchive(t, { rawRows: [row, row] });
  await assert.rejects(readRestoreSample(duplicate), /Duplicate/);
  const invalid = await fixtureArchive(t, { rawRows: [{ ...row, data: { $fs: 'map', entries: [['bad', { $fs: 'unknown' }]] } }] });
  await assert.rejects(readRestoreSample(invalid), /Unknown/);
});

test('decoded archive and selected sample byte caps fail closed without plaintext temporary files', async t => {
  const { readRestoreSample, restoreLimits } = await runtime();
  const a = await fixtureArchive(t);
  await assert.rejects(readRestoreSample({ ...a, limits: { ...restoreLimits({}), decodedBytes: 100 } }), /archive byte cap/);
  await assert.rejects(readRestoreSample({ ...a, limits: { ...restoreLimits({}), sampleBytes: 100 } }), /sample byte cap/);
  assert.deepEqual(fs.readdirSync(path.dirname(a.filePath)).sort(), ['synthetic.firestore.enc', 'synthetic.firestore.enc.manifest.json']);
  assert.throws(() => restoreLimits({ MAX_RESTORE_SAMPLE_RECORDS: '5001' }), /limits/);
  assert.throws(() => restoreLimits({ MAX_RESTORE_ARCHIVE_BYTES: '0' }), /limits/);
});

test('restore refuses a nonempty emulator, racing create and content mismatch without overwriting data', async t => {
  const { readRestoreSample, restoreToIsolatedEmulator } = await runtime();
  const archive = await readRestoreSample(await fixtureArchive(t));
  const existing = fakeDestination(t, { nonempty: true });
  await assert.rejects(restoreToIsolatedEmulator({ archive, target, clientFactory: existing.factory }), /empty/);
  assert.ok(!existing.calls.some(([name]) => name === 'create'));
  const racing = fakeDestination(t, { race: true });
  await assert.rejects(restoreToIsolatedEmulator({ archive, target, clientFactory: racing.factory }), /ALREADY_EXISTS/);
  assert.equal(racing.rows.size, 0);
  const different = fakeDestination(t, { mismatch: true });
  await assert.rejects(restoreToIsolatedEmulator({ archive, target, clientFactory: different.factory }), /content mismatch/);
  const noAuth = fakeDestination(t);
  await assert.rejects(restoreToIsolatedEmulator({ archive: { ...archive, authenticated: false }, target, clientFactory: noAuth.factory }), /authenticated/);
  await assert.rejects(restoreToIsolatedEmulator({ archive: { ...archive, authenticated: true }, target, clientFactory: noAuth.factory }), /authenticated/);
  assert.equal(noAuth.calls.length, 0);
});

test('restore refuses service-unrepresentable reserved fields and timestamp precision before opening a writer', async t => {
  const { readRestoreSample, restoreToIsolatedEmulator } = await runtime();
  const invalidValues = [
    { $fs: 'map', entries: [['nested', { $fs: 'map', entries: [['__proto__', 'preserve in archive only']] }]] },
    { $fs: 'map', entries: [['value', { $fs: 'array', values: [{ $fs: 'timestamp', seconds: 1234, nanoseconds: 987654321 }] }]] },
  ];
  for (const data of invalidValues) {
    const archive = await readRestoreSample(await fixtureArchive(t, { rawRows: [{ path: 'profiles/synthetic', data }] }));
    const destination = fakeDestination(t);
    await assert.rejects(restoreToIsolatedEmulator({ archive, target, clientFactory: destination.factory }), /cannot be stored losslessly/);
    assert.equal(destination.calls.length, 0);
    assert.equal(destination.rows.size, 0);
  }
});

test('CLI inspect outputs only redacted counts and restore rejects production settings before reading files', async t => {
  const a = await fixtureArchive(t);
  const script = path.resolve(__dirname, '../scripts/firestore-restore-validation.mjs');
  const env = { ...process.env, CHANTAKORN_BACKUP_PASSPHRASE: password };
  const inspected = spawnSync(process.execPath, [script, 'inspect', a.filePath], { env, encoding: 'utf8' });
  assert.equal(inspected.status, 0, inspected.stderr);
  const result = JSON.parse(inspected.stdout);
  assert.equal(result.sourceRecords, 3);
  assert.equal(result.authenticated, true);
  assert.ok(!inspected.stdout.includes('synthetic-admin') && !inspected.stdout.includes('ลูกค้า'));
  const denied = spawnSync(process.execPath, [script, 'restore', path.join(path.dirname(a.filePath), 'does-not-exist')], {
    env: { ...env, ALLOW_FIRESTORE_EMULATOR_RESTORE: 'DEMO_ONLY', FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com:443',
      FIREBASE_RESTORE_PROJECT_ID: 'production-project', FIRESTORE_RESTORE_DATABASE_ID: 'production' }, encoding: 'utf8' });
  assert.equal(denied.status, 1);
  assert.equal(denied.stdout, '');
  assert.match(denied.stderr, /Restore validation failed/);
  assert.ok(!denied.stderr.includes('does-not-exist') && !denied.stderr.includes(password));
});

test('synthetic encrypted archive restores into a real isolated local Firestore emulator', {
  skip: process.env.RUN_FIRESTORE_RESTORE_EMULATOR_TESTS !== 'true',
}, async t => {
  const { readRestoreSample, isolatedRestoreTarget, restoreToIsolatedEmulator } = await runtime();
  const isolated = isolatedRestoreTarget({ ...target, host: process.env.FIRESTORE_EMULATOR_HOST,
    database: `restore-fixture-${crypto.randomBytes(6).toString('hex')}` });
  const archive = await readRestoreSample(await fixtureArchive(t));
  const result = await restoreToIsolatedEmulator({ archive, target: isolated });
  assert.equal(result.sampleRecords, 3);
  assert.equal(result.verified, true);
  const db = new Firestore({ projectId: isolated.project, databaseId: isolated.database, host: isolated.host, ssl: false });
  try {
    assert.equal((await db.doc('inquiries/missing-parent').get()).exists, false);
    const child = await db.doc('inquiries/missing-parent/notes/synthetic-note').get();
    assert.equal(child.exists, true);
    assert.equal(child.data().message, 'ข้อความภาษาไทย'.repeat(7));
  } finally { await db.terminate(); }
});
