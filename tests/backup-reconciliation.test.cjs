const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const repository = path.resolve(__dirname, '..');
const script = path.join(repository, 'scripts/backup-reconciliation.mjs');
const runtime = () => import('../scripts/backup-reconciliation.mjs');
const password = 'synthetic-reconciliation-password-20261028';
const fixtureProject = 'demo-backup-reconciliation', fixtureDatabase = 'named-archive-fixture';
const privateUid = 'fixture-private-admin-uid', disabledUid = 'fixture-private-disabled-uid';
const lineId = digit => `U${digit.repeat(32)}`;
const privateValues = [privateUid, disabledUid, 'private@example.invalid', 'ข้อความส่วนตัวของลูกค้า', lineId('a'), lineId('b')];

function temporary(t) {
  const base = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(base, 'chantakorn-reconcile-test-'));
  t.after(() => {
    if (!path.isAbsolute(root) || path.dirname(root) !== base || !path.basename(root).startsWith('chantakorn-reconcile-test-')) throw new Error('Unsafe reconciliation fixture cleanup');
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}
function fixtureRows() {
  return [
    [`profiles/${privateUid}`, { uid: privateUid, role: 'ADMIN', full_name: 'ชื่อทดสอบส่วนตัว', email: 'private@example.invalid' }],
    [`profiles/${disabledUid}`, { role: 'USER' }],
    ['inquiries/private-inquiry', { message: 'ข้อความส่วนตัวของลูกค้า' }],
    ['inquiries/missing-parent/notes/private-note', { message: 'ข้อความส่วนตัวของลูกค้า' }],
    [`line_followers/${lineId('a')}`, { user_id: lineId('a'), is_active: true }],
    [`line_followers/${lineId('b')}`, { user_id: lineId('b'), is_active: false }],
  ];
}
function fixtureUsers() {
  return [
    { localId: privateUid, email: 'private@example.invalid', emailVerified: true, providerUserInfo: [{ providerId: 'google.com', rawId: 'fixture-provider-identity' }] },
    { localId: disabledUid, disabled: true, providerUserInfo: [{ providerId: 'password', rawId: 'fixture-password-identity' }] },
  ];
}
async function fixture(t, { rows = fixtureRows(), users = fixtureUsers(), project = fixtureProject, database = fixtureDatabase } = {}) {
  const directory = temporary(t);
  const { createEncryptedArchive } = await import('../scripts/firestore-backup-runtime.mjs');
  const { encodeFirestoreValue, redactCollectionPath } = await import('../scripts/firestore-backup-codec.mjs');
  const { createAuthEncryptedArchive, normalizeAuthUser } = await import('../scripts/firebase-auth-backup-runtime.mjs');
  const collections = Object.create(null);
  const records = rows.map(([documentPath, data]) => {
    const collection = redactCollectionPath(documentPath.split('/').slice(0, -1).join('/'));
    collections[collection] = (collections[collection] || 0) + 1;
    return JSON.stringify({ path: documentPath, data: encodeFirestoreValue(data) }) + '\n';
  });
  const firestoreManifest = await createEncryptedArchive({ filePath: path.join(directory, 'firestore.enc'), password,
    records, counts: { records: rows.length, collections }, metadata: { firestoreProject: project, firestoreDatabase: database } });
  const authManifest = await createAuthEncryptedArchive({ filePath: path.join(directory, 'firebase-auth.enc'), password, project,
    records: users.map(normalizeAuthUser) });
  return { directory, firestoreManifest, authManifest, options: { snapshotDirectory: directory, password, expectedProject: project, expectedDatabase: database } };
}
function assertCountsOnly(value) {
  if (value && typeof value === 'object') {
    assert.equal(Array.isArray(value), false);
    for (const child of Object.values(value)) assertCountsOnly(child);
  } else assert.ok(typeof value === 'number' || typeof value === 'boolean');
}

test('complete authenticated encrypted backups reconcile profile/Auth/providers, inquiries and follower opt-outs using counts only', async t => {
  const f = await fixture(t), { reconcileBackups } = await runtime();
  const result = await reconcileBackups(f.options);
  assert.equal(result.ok, true);
  assert.equal(result.complete, true);
  assert.equal(result.inventoriesMatch, true);
  assert.equal(result.pointInTimeSnapshot, false);
  assert.equal(result.passwordCredentialsRestorable, false);
  assert.equal(result.firestoreRecords, 6);
  assert.deepEqual(result.auth, { records: 2, disabled: 1, verifiedEmail: 1, withProvider: 2, withoutProvider: 0, duplicateUids: 0, withoutProfile: 0,
    withoutProfileEnabledVerified: 0, withoutProfileEnabledUnverified: 0, withoutProfileDisabled: 0 });
  assert.equal(result.profiles.roles.ADMIN, 1);
  assert.equal(result.profiles.roles.USER, 1);
  assert.equal(result.profiles.missingAuth, 0);
  assert.equal(result.profiles.matchedDisabledAuth, 1);
  assert.equal(result.profiles.disabledStaffAuth, 0);
  assert.equal(result.profiles.unverifiedStaffAuth, 0);
  assert.deepEqual(result.inquiries, { records: 1, descendantRecords: 1 });
  assert.equal(result.lineFollowers.active, 1);
  assert.equal(result.lineFollowers.optedOut, 1);
  assert.equal(result.lineFollowers.uniqueValidUserIds, 2);
  assert.equal(result.findings, 0);
  assertCountsOnly(result);
  for (const value of privateValues) assert.ok(!JSON.stringify(result).includes(value));
  assert.deepEqual(fs.readdirSync(f.directory).sort(), ['firebase-auth.enc', 'firebase-auth.enc.manifest.json', 'firestore.enc', 'firestore.enc.manifest.json']);
});

test('offline reconciliation reports unmatched users, invalid roles/UID conflicts, duplicate declared identities and disabled staff without changing them', async t => {
  const rows = fixtureRows();
  rows[1][1].role = 'AGENT';
  rows.push(['profiles/missing-auth-user', { uid: privateUid, role: 'OWNER' }]);
  const users = [...fixtureUsers(), { localId: 'auth-without-profile' }];
  const f = await fixture(t, { rows, users });
  const result = await (await runtime()).reconcileBackups(f.options);
  assert.equal(result.complete, true);
  assert.equal(result.inventoriesMatch, false);
  assert.equal(result.auth.withoutProfile, 1);
  assert.equal(result.auth.withoutProfileEnabledUnverified, 1);
  assert.equal(result.auth.withoutProvider, 1);
  assert.equal(result.profiles.missingAuth, 1);
  assert.equal(result.profiles.invalidRoles, 1);
  assert.equal(result.profiles.uidFieldConflicts, 1);
  assert.equal(result.profiles.duplicateDeclaredUids, 1);
  assert.equal(result.profiles.disabledStaffAuth, 1);
  assert.equal(result.profiles.unverifiedStaffAuth, 1);
  assert.ok(result.findings >= 6);
  assertCountsOnly(result);
});

test('no-profile Auth accounts are separated into enabled verified, enabled unverified and disabled review buckets', async t => {
  const users = [...fixtureUsers(),
    { localId: 'orphan-verified', emailVerified: true },
    { localId: 'orphan-unverified', emailVerified: false },
    { localId: 'orphan-disabled', emailVerified: true, disabled: true },
  ];
  const f = await fixture(t, { users });
  const result = await (await runtime()).reconcileBackups(f.options);
  assert.equal(result.auth.withoutProfile, 3);
  assert.equal(result.auth.withoutProfileEnabledVerified, 1);
  assert.equal(result.auth.withoutProfileEnabledUnverified, 1);
  assert.equal(result.auth.withoutProfileDisabled, 1);
  assert.equal(result.auth.withoutProfileEnabledVerified + result.auth.withoutProfileEnabledUnverified + result.auth.withoutProfileDisabled, result.auth.withoutProfile);
  assert.equal(result.profiles.records, 2);
  assert.equal(result.profiles.missingAuth, 0);
  assert.equal(result.profiles.unverifiedStaffAuth, 0);
  assert.equal(result.findings, 3);
  assertCountsOnly(result);
});

test('enabled but unverified staff Auth is a finding even when UID and role match', async t => {
  const rows = [...fixtureRows(), ['profiles/unverified-staff', { role: 'AGENT' }]];
  const users = [...fixtureUsers(), { localId: 'unverified-staff', emailVerified: false, disabled: false }];
  const f = await fixture(t, { rows, users });
  const result = await (await runtime()).reconcileBackups(f.options);
  assert.equal(result.profiles.missingAuth, 0);
  assert.equal(result.auth.withoutProfile, 0);
  assert.equal(result.profiles.matchedEnabledAuth, 2);
  assert.equal(result.profiles.disabledStaffAuth, 0);
  assert.equal(result.profiles.unverifiedStaffAuth, 1);
  assert.equal(result.findings, 1);
  assert.equal(result.inventoriesMatch, false);
  assertCountsOnly(result);
});

test('LINE follower reconciliation counts malformed IDs, conflicts, duplicates and unknown/contradictory opt-out state safely', async t => {
  const rows = fixtureRows();
  rows.push(
    ['line_followers/legacy-alias', { user_id: lineId('a'), is_active: true }],
    [`line_followers/${lineId('c')}`, { user_id: 'malformed-private-line-id' }],
    [`line_followers/${lineId('d')}`, { user_id: lineId('e'), id: 'invalid-stored-id', is_active: true, opted_out: true }],
    [`line_followers/${lineId('f')}`, { is_active: true }],
    [`line_followers/${lineId('1')}`, { user_id: lineId('1'), is_active: 'yes', opted_out: 'no' }],
  );
  const f = await fixture(t, { rows });
  const result = await (await runtime()).reconcileBackups(f.options);
  const followers = result.lineFollowers;
  assert.equal(followers.records, 7);
  assert.equal(followers.invalidUserIds, 1);
  assert.equal(followers.invalidUserIdFields, 1);
  assert.equal(followers.invalidDocumentIds, 1);
  assert.equal(followers.invalidStoredIds, 1);
  assert.equal(followers.idConflicts, 1);
  assert.equal(followers.duplicateUserIds, 1);
  assert.equal(followers.missingUserIdFields, 1);
  assert.equal(followers.invalidActiveFlags, 2);
  assert.equal(followers.invalidOptOutFlags, 1);
  assert.equal(followers.activeOptOutConflicts, 1);
  assert.equal(followers.optedOut, 2);
  assert.equal(followers.unknownState, 2);
  assert.equal(followers.active, 3);
  assert.equal(followers.uniqueActiveUserIds, 2);
  assertCountsOnly(result);
});

test('reconciliation fails closed rather than treating a truncated Firestore/Auth sample as a complete inventory', async t => {
  const { reconcileBackups, reconciliationLimits } = await runtime();
  const f = await fixture(t);
  await assert.rejects(reconcileBackups({ ...f.options, limits: reconciliationLimits({ MAX_RECONCILIATION_RECORDS: '1' }) }), /RECONCILIATION_INCOMPLETE_INVENTORY/);
  const small = await fixture(t, { rows: fixtureRows().slice(0, 1), users: fixtureUsers() });
  await assert.rejects(reconcileBackups({ ...small.options, limits: reconciliationLimits({ MAX_RECONCILIATION_RECORDS: '1' }) }), /AUTH_READ_RECORD_CAP/);
  assert.throws(() => reconciliationLimits({ MAX_RECONCILIATION_RECORDS: '5001' }), /Invalid restore limits/);
});

test('Auth metadata is returned to the private in-memory reader only after GCM authentication and within strict record/byte bounds', async t => {
  const f = await fixture(t);
  const { readVerifiedAuthRecords } = await import('../scripts/firebase-auth-backup-runtime.mjs');
  const options = { filePath: path.join(f.directory, 'firebase-auth.enc'), password, expectedProject: fixtureProject };
  const result = await readVerifiedAuthRecords(options);
  assert.equal(result.authenticated, true);
  assert.equal(result.sourceRecords, 2);
  assert.equal(result.users[0].uid, privateUid);
  assert.equal(Object.isFrozen(result.users[0].providerData), true);
  await assert.rejects(readVerifiedAuthRecords({ ...options, maxRecords: 1 }), /AUTH_READ_RECORD_CAP/);
  await assert.rejects(readVerifiedAuthRecords({ ...options, maxBytes: 1 }), /AUTH_READ_BYTE_CAP/);
  await assert.rejects(readVerifiedAuthRecords({ ...options, manifest: { ...f.authManifest, tag: '0'.repeat(32) } }));
});

test('wrong project/database, passphrase and ciphertext tampering cannot return reconciliation counts', async t => {
  const { reconcileBackups } = await runtime();
  const f = await fixture(t);
  await assert.rejects(reconcileBackups({ ...f.options, expectedProject: 'demo-other-project' }), /RECONCILIATION_PROJECT_MISMATCH/);
  await assert.rejects(reconcileBackups({ ...f.options, expectedDatabase: 'another-database' }), /RECONCILIATION_PROJECT_MISMATCH/);
  await assert.rejects(reconcileBackups({ ...f.options, password: 'different-offline-private-passphrase' }));
  const bytes = fs.readFileSync(path.join(f.directory, 'firebase-auth.enc')); bytes[0] ^= 1;
  fs.writeFileSync(path.join(f.directory, 'firebase-auth.enc'), bytes);
  await assert.rejects(reconcileBackups(f.options), /AUTH_CHECKSUM_MISMATCH/);
});

test('snapshot paths must be absolute, off-repo and contain their own encrypted artifacts', async t => {
  const { reconcileBackups } = await runtime();
  const f = await fixture(t);
  await assert.rejects(reconcileBackups({ ...f.options, snapshotDirectory: '.' }), /RECONCILIATION_PATH_INVALID/);
  await assert.rejects(reconcileBackups({ ...f.options, snapshotDirectory: repository }), /outside the Git/);
  const alias = path.join(f.directory, 'repo-junction');
  fs.symlinkSync(repository, alias, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(reconcileBackups({ ...f.options, snapshotDirectory: alias }), /outside the Git/);
  const other = await fixture(t);
  fs.unlinkSync(path.join(f.directory, 'firebase-auth.enc'));
  // Windows permits directory junction fixtures without requiring symlink-creation privileges.
  fs.symlinkSync(process.platform === 'win32' ? other.directory : path.join(other.directory, 'firebase-auth.enc'),
    path.join(f.directory, 'firebase-auth.enc'), process.platform === 'win32' ? 'junction' : 'file');
  await assert.rejects(reconcileBackups(f.options), /RECONCILIATION_PATH_INVALID/);
});

test('CLI prints only aggregate counts for a matching configured project and emits a fixed non-PII error on failure', async t => {
  const project = JSON.parse(fs.readFileSync(path.join(repository, 'firebase-applet-config.json'), 'utf8')).projectId;
  const database = JSON.parse(fs.readFileSync(path.join(repository, 'firebase.json'), 'utf8')).firestore.database;
  const f = await fixture(t, { project, database });
  const env = { ...process.env, CHANTAKORN_BACKUP_PASSPHRASE: password,
    GOOGLE_APPLICATION_CREDENTIALS: path.join(f.directory, 'must-not-read-credentials.json') };
  const good = spawnSync(process.execPath, [script, f.directory], { encoding: 'utf8', env });
  assert.equal(good.status, 0, good.stderr);
  assert.equal(good.stderr, '');
  const report = JSON.parse(good.stdout);
  assert.equal(report.complete, true);
  assertCountsOnly(report);
  for (const value of [...privateValues, password, f.directory, project, database]) assert.ok(!good.stdout.includes(value));
  const bad = spawnSync(process.execPath, [script, f.directory], { encoding: 'utf8', env: { ...env, CHANTAKORN_BACKUP_PASSPHRASE: 'wrong-private-fixture-password' } });
  assert.equal(bad.status, 1);
  assert.equal(bad.stdout, '');
  assert.deepEqual(JSON.parse(bad.stderr), { ok: false, complete: false, code: 'BACKUP_RECONCILIATION_FAILED' });
  for (const value of [...privateValues, password, f.directory]) assert.ok(!bad.stderr.includes(value));
});
