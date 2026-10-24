import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStaffImport, MAX_STAFF_IMPORT, parseProfilesExport } from '../src/staff-import.ts';

const now = new Date('2026-10-24T00:00:00.000Z');
const adminUid = 'uid-admin-0001';
const agentUid = 'uid-agent-0002';
const userUid = 'uid-user-0003';

const authUsers = () => JSON.stringify({ users: [
  { localId: adminUid, email: 'Bancha@Example.com', emailVerified: true, disabled: false },
  { localId: agentUid, email: 'agent@example.com', emailVerified: true, disabled: false },
  { localId: userUid, email: 'user@example.com', emailVerified: true, disabled: false },
  { localId: 'uid-unverified-01', email: 'unverified@example.com', emailVerified: false, disabled: false },
  { localId: 'uid-disabled-0001', email: 'disabled@example.com', emailVerified: true, disabled: true },
] });
const profilesNdjson = () => [
  JSON.stringify({ uid: adminUid, role: 'ADMIN', full_name: "คุณบันชา O'Brien", email: 'bancha@example.com' }),
  JSON.stringify({ id: agentUid, data: { role: 'AGENT', full_name: 'Agent One', email: 'agent@example.com' } }),
  JSON.stringify({ uid: userUid, role: 'USER', full_name: 'Customer' }),
].join('\n');
const approved = () => `# approved by operator\n${adminUid}\n${agentUid}\n`;
const base = () => ({ authText: authUsers(), profilesText: profilesNdjson(), approvedText: approved(), now });

async function expectFailure(mutate: (input: Record<string, string | Date>) => void, pattern: RegExp) {
  const input = base() as Record<string, string | Date>;
  mutate(input);
  const result = await buildStaffImport(input as never);
  assert.equal(result.ok, false, `expected failure matching ${pattern}`);
  if (!result.ok) assert.match(result.errors.join('\n'), pattern);
}

test('builds a deterministic insert-only plan from verified, approved exports', async () => {
  const result = await buildStaffImport(base());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.plan.inserts.map(entry => [entry.uid, entry.role, entry.email]), [
    [adminUid, 'ADMIN', 'bancha@example.com'],
    [agentUid, 'AGENT', 'agent@example.com'],
  ]);
  assert.deepEqual(result.plan.byRole, { ADMIN: 1, AGENT: 1 });
  assert.equal(result.plan.skippedUser, 1);
  assert.match(result.sql, /^-- Chantakorn D1 staff role import/);
  assert.match(result.sql, /ON CONFLICT\(uid\) DO NOTHING;/);
  assert.match(result.sql, /'2026-10-24T00:00:00\.000Z'/);
  assert.match(result.sql, /'คุณบันชา O''Brien'/);
  assert.equal((result.sql.match(/INSERT INTO profiles/g) || []).length, 1);
  const manifest = result.manifest as Record<string, any>;
  assert.equal(manifest.tool, 'chantakorn-staff-import/1');
  assert.equal(manifest.summary.staff, 2);
  assert.deepEqual(manifest.entries, [{ uid: adminUid, role: 'ADMIN' }, { uid: agentUid, role: 'AGENT' }]);
  for (const hash of Object.values(manifest.inputs)) assert.match(String(hash), /^[0-9a-f]{64}$/);
  const serialized = JSON.stringify(manifest);
  assert.equal(serialized.includes('@'), false, 'manifest must not contain emails');
  assert.equal(serialized.includes('บันชา'), false, 'manifest must not contain full names');
});

test('tolerates UTF-8 BOMs from Windows exports while keeping raw input hashes', async () => {
  const input = base() as Record<string, string | Date>;
  input.authText = '\uFEFF' + String(input.authText);
  input.profilesText = '\uFEFF' + String(input.profilesText);
  input.approvedText = '\uFEFF' + String(input.approvedText);
  const result = await buildStaffImport(input as never);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.plan.inserts.length, 2);
  const manifest = result.manifest as Record<string, any>;
  for (const hash of Object.values(manifest.inputs)) assert.match(String(hash), /^[0-9a-f]{64}$/);
});

test('sorts inserts by UID and counts the roles deterministically', async () => {
  const input = base() as Record<string, string | Date>;
  input.authText = JSON.stringify({ users: JSON.parse(String(input.authText)).users.concat([
    { localId: 'aaa-admin-0001', email: 'a@example.com', emailVerified: true, disabled: false },
  ]) });
  input.profilesText = `${String(input.profilesText)}\n${JSON.stringify({ uid: 'aaa-admin-0001', role: 'ADMIN', full_name: 'A Admin' })}`;
  input.approvedText = `${String(input.approvedText)}aaa-admin-0001\n`;
  const result = await buildStaffImport(input as never);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.plan.inserts.map(entry => entry.uid), ['aaa-admin-0001', adminUid, agentUid]);
  assert.deepEqual(result.plan.byRole, { ADMIN: 2, AGENT: 1 });
});

test('fails closed on unverified, disabled or missing Firebase identities', async () => {
  await expectFailure(input => {
    input.profilesText += '\n' + JSON.stringify({ uid: 'uid-unverified-01', role: 'ADMIN', full_name: 'Unverified' });
    input.approvedText += 'uid-unverified-01\n';
  }, /uid-unverified-01 is not email-verified/);
  await expectFailure(input => {
    input.profilesText += '\n' + JSON.stringify({ uid: 'uid-disabled-0001', role: 'ADMIN', full_name: 'Disabled' });
    input.approvedText += 'uid-disabled-0001\n';
  }, /uid-disabled-0001 is disabled/);
  await expectFailure(input => {
    input.profilesText += '\n' + JSON.stringify({ uid: 'uid-ghost-00001', role: 'AGENT', full_name: 'Ghost' });
    input.approvedText += 'uid-ghost-00001\n';
  }, /no matching Firebase Auth account/);
});

test('requires an explicit approved-UID list that exactly matches the staff profiles', async () => {
  await expectFailure(input => { input.approvedText = `# none\n`; }, /must contain at least one UID/);
  await expectFailure(input => { input.approvedText = `${adminUid}\n`; }, new RegExp(`${agentUid} is not on the approved UID list`));
  await expectFailure(input => { input.approvedText += `${userUid}\n`; }, new RegExp(`${userUid} has no ADMIN/AGENT profile`));
  await expectFailure(input => { input.approvedText += 'not a uid!\n'; }, /not a valid UID/);
  await expectFailure(input => { input.approvedText += `${adminUid}\n`; }, /Approved UID list repeats/);
});

test('rejects unverified email agreement, unknown roles, duplicates and malformed names', async () => {
  await expectFailure(input => {
    input.profilesText = String(input.profilesText).replace('bancha@example.com', 'someone@example.com');
  }, /email does not match Firebase Auth/);
  await expectFailure(input => {
    input.profilesText = `${String(input.profilesText)}\n${JSON.stringify({ uid: adminUid, role: 'ADMIN', full_name: 'Duplicate' })}`;
  }, /repeats staff UID/);
  await expectFailure(input => {
    input.profilesText = String(input.profilesText).replace('"role":"ADMIN"', '"role":"OWNER"');
  }, /unsupported role/);
  await expectFailure(input => {
    input.profilesText = String(input.profilesText).replace("คุณบันชา O'Brien", 'x');
  }, /valid full_name/);
  await expectFailure(input => {
    input.profilesText = `${String(input.profilesText)}\nthis is not json`;
  }, /not valid JSON/);
});

test('rejects empty or malformed exports before generating any SQL', async () => {
  await expectFailure(input => { input.authText = '{}'; }, /non-empty users array/);
  await expectFailure(input => { input.authText = 'not json'; }, /not valid JSON/);
  await expectFailure(input => { input.profilesText = '{}'; }, /missing or invalid UID/);
  await expectFailure(input => {
    input.authText = JSON.stringify({ users: [] });
  }, /non-empty users array/);
  await expectFailure(input => {
    input.profilesText = '';
  }, /profiles export is empty/);
});

test('accepts flat arrays and Firestore-shaped profile records', () => {
  const flat = parseProfilesExport(JSON.stringify([
    { uid: adminUid, role: 'ADMIN', full_name: 'Admin', email: 'a@example.com' },
    { id: agentUid, data: { role: 'AGENT', full_name: 'Agent' } },
  ]));
  assert.deepEqual(flat.errors, []);
  assert.deepEqual(flat.profiles.map(profile => [profile.uid, profile.role]), [
    [adminUid, 'ADMIN'], [agentUid, 'AGENT'],
  ]);
  const malformed = parseProfilesExport('\n{"uid":"x"}\n');
  assert.equal(malformed.profiles.length, 0);
  assert.match(malformed.errors.join('\n'), /UID|role/);
});

test('enforces the bounded entry limit instead of importing an unbounded roster', async () => {
  const users = Array.from({ length: MAX_STAFF_IMPORT + 1 }, (_, index) => ({
    localId: `bulk-${String(index).padStart(6, '0')}`, email: `bulk${index}@example.com`,
    emailVerified: true, disabled: false,
  }));
  const input = {
    authText: JSON.stringify({ users }),
    profilesText: users.map(user => JSON.stringify({
      uid: user.localId, role: 'AGENT', full_name: `Agent ${user.localId}`,
    })).join('\n'),
    approvedText: users.map(user => user.localId).join('\n'),
    now,
  };
  const result = await buildStaffImport(input);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join('\n'), new RegExp(`exceeds the ${MAX_STAFF_IMPORT}-entry limit`));
});
