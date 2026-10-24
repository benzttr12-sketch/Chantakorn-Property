const test = require('node:test');
const assert = require('node:assert/strict');
const { Timestamp, GeoPoint } = require('@google-cloud/firestore');

test('Firestore archival codec preserves typed data without leaking UID paths', async () => {
  const { encodeFirestoreValue, redactCollectionPath } = await import('../scripts/firestore-backup-codec.mjs');
  const value = {
    lastSeen: new Timestamp(1_797_000_000, 123_000_000),
    loc: new GeoPoint(7.0, 100.48),
    attachments: [Buffer.from('test\0bytes')],
    contact: { phone: 'private-value', optional: null },
  };
  const coded = encodeFirestoreValue(value);
  assert.equal(coded.$fs, 'map');
  assert.deepEqual(coded.entries.map(([name]) => name), ['lastSeen','loc','attachments','contact']);
  assert.deepEqual(coded.entries[0][1], { $fs: 'timestamp', seconds: 1797000000, nanoseconds: 123000000 });
  assert.deepEqual(coded.entries[1][1], { $fs: 'geopoint', latitude: 7, longitude: 100.48 });
  assert.equal(coded.entries[2][1].values[0].$fs, 'bytes');
  assert.equal(redactCollectionPath('inquiries/sensitive-lead-id/notes'), 'inquiries/{doc}/notes');
  assert.equal(redactCollectionPath('line_followers'), 'line_followers');
  assert.equal(redactCollectionPath('users/uid-a/records/uid-b/private'), 'users/{doc}/records/{doc}/private');
  assert.ok(!redactCollectionPath('inquiries/123/private').includes('123'));
});

test('encrypted archive manifest schema rejects incomplete or dangerous metadata', async () => {
  const { validateEncryptedBackupManifest } = await import('../scripts/firestore-backup-codec.mjs');
  const valid = {
    version: 1, encryption: 'AES-256-GCM', compression: 'gzip',
    sha256: 'a'.repeat(64), salt: 'b'.repeat(32), iv: 'c'.repeat(24),
    tag: 'd'.repeat(32), records: 0, firestoreDatabase: 'named-db',
  };
  assert.deepEqual(validateEncryptedBackupManifest(valid), valid);
  assert.throws(() => validateEncryptedBackupManifest({ ...valid, tag: 'bad' }));
  assert.throws(() => validateEncryptedBackupManifest({ ...valid, records: -1 }));
  assert.throws(() => validateEncryptedBackupManifest({ ...valid, encryption: 'plaintext' }));
  assert.throws(() => validateEncryptedBackupManifest({ ...valid, sha256: 'x' }));
});

test('unknown or undefined Firestore values fail closed, never silently coerce', async () => {
  const { encodeFirestoreValue } = await import('../scripts/firestore-backup-codec.mjs');
  assert.throws(() => encodeFirestoreValue(undefined));
  assert.throws(() => encodeFirestoreValue(Infinity));
  assert.throws(() => encodeFirestoreValue(new Date('invalid')));
});
