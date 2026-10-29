#!/usr/bin/env node
/** Offline counts only. No role changes, imports, account restoration or network calls. */
import { readFileSync, statSync, existsSync } from 'node:fs';
import { isAbsolute, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { outsideRepositoryPath } from './firestore-backup-runtime.mjs';
import { readRestoreSample, restoreLimits, decodeFirestoreValue } from './firestore-restore-validation.mjs';
import { readVerifiedAuthRecords } from './firebase-auth-backup-runtime.mjs';

const repository = fileURLToPath(new URL('..', import.meta.url));
const MiB = 1024 * 1024;
const roles = new Set(['ADMIN', 'AGENT', 'USER']);
const lineUserId = /^U[0-9a-f]{32}$/i;
function fail(code) { throw new Error(code); }
function plainObject(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function validUid(value) { return typeof value === 'string' && value.length > 0 && value.length <= 128; }

export function reconciliationLimits(environment = process.env) {
  return restoreLimits({
    MAX_RESTORE_SAMPLE_RECORDS: environment.MAX_RECONCILIATION_RECORDS ?? '5000',
    MAX_RESTORE_SAMPLE_BYTES: environment.MAX_RECONCILIATION_BYTES ?? String(64 * MiB),
    MAX_RESTORE_ARCHIVE_BYTES: String(256 * MiB),
    MAX_RESTORE_TIMEOUT_MS: environment.MAX_RECONCILIATION_TIMEOUT_MS ?? '120000',
  });
}

function checkedSnapshot(input) {
  if (typeof input !== 'string' || !isAbsolute(input)) fail('RECONCILIATION_PATH_INVALID');
  const directory = outsideRepositoryPath(input, repository, { existing: true });
  if (!statSync(directory).isDirectory()) fail('RECONCILIATION_PATH_INVALID');
  for (let current = directory;; current = dirname(current)) {
    if (existsSync(join(current, '.git'))) fail('RECONCILIATION_PATH_INVALID');
    if (dirname(current) === current) break;
  }
  const files = {};
  for (const name of ['firestore.enc', 'firestore.enc.manifest.json', 'firebase-auth.enc', 'firebase-auth.enc.manifest.json']) {
    const file = outsideRepositoryPath(join(directory, name), repository, { existing: true });
    const stat = statSync(file);
    if (dirname(file) !== directory || !stat.isFile() || stat.size > (name.endsWith('.json') ? MiB : 512 * MiB)) fail('RECONCILIATION_PATH_INVALID');
    files[name] = file;
  }
  return { directory, files };
}

function countsFor(rows, users) {
  const auth = new Map(), assignedUids = new Set(), profileUids = new Set();
  const result = {
    auth: { records: users.length, disabled: 0, verifiedEmail: 0, withProvider: 0, withoutProvider: 0, duplicateUids: 0, withoutProfile: 0,
      withoutProfileEnabledVerified: 0, withoutProfileEnabledUnverified: 0, withoutProfileDisabled: 0 },
    profiles: { records: 0, roles: { ADMIN: 0, AGENT: 0, USER: 0 }, invalidRoles: 0, invalidUids: 0, uidFieldConflicts: 0,
      duplicateDeclaredUids: 0, missingAuth: 0, matchedEnabledAuth: 0, matchedDisabledAuth: 0, disabledStaffAuth: 0, unverifiedStaffAuth: 0, matchedWithoutProvider: 0 },
    inquiries: { records: 0, descendantRecords: 0 },
    lineFollowers: { records: 0, validUserIds: 0, invalidUserIds: 0, missingUserIdFields: 0, invalidUserIdFields: 0,
      invalidDocumentIds: 0, invalidStoredIds: 0, idConflicts: 0, duplicateUserIds: 0, uniqueValidUserIds: 0,
      active: 0, optedOut: 0, unknownState: 0, invalidActiveFlags: 0, invalidOptOutFlags: 0, activeOptOutConflicts: 0, uniqueActiveUserIds: 0 },
  };
  for (const user of users) {
    if (auth.has(user.uid)) { result.auth.duplicateUids++; continue; }
    auth.set(user.uid, user);
    if (user.disabled) result.auth.disabled++;
    if (user.emailVerified) result.auth.verifiedEmail++;
    if (user.providerData.length) result.auth.withProvider++; else result.auth.withoutProvider++;
  }
  const followerIds = new Set(), activeFollowerIds = new Set();
  for (const row of rows) {
    const parts = row.path.split('/');
    if (parts[0] === 'inquiries') {
      if (parts.length === 2) result.inquiries.records++;
      else result.inquiries.descendantRecords++;
    }
    if (parts.length !== 2 || !['profiles', 'line_followers'].includes(parts[0])) continue;
    const data = decodeFirestoreValue(row.data);
    if (!plainObject(data)) fail('RECONCILIATION_RECORD_INVALID');
    const documentId = parts[1];
    if (parts[0] === 'profiles') {
      const profile = result.profiles;
      profile.records++; profileUids.add(documentId);
      if (!validUid(documentId)) profile.invalidUids++;
      if (roles.has(data.role)) profile.roles[data.role]++; else profile.invalidRoles++;
      let conflicted = false;
      for (const field of ['uid', 'id']) if (data[field] !== undefined && (!validUid(data[field]) || data[field] !== documentId)) conflicted = true;
      if (conflicted) profile.uidFieldConflicts++;
      const assigned = data.uid ?? documentId;
      if (validUid(assigned)) {
        if (assignedUids.has(assigned)) profile.duplicateDeclaredUids++;
        assignedUids.add(assigned);
      }
      const match = auth.get(documentId);
      if (!match) profile.missingAuth++;
      else {
        if (match.disabled) profile.matchedDisabledAuth++; else profile.matchedEnabledAuth++;
        if (match.disabled && (data.role === 'ADMIN' || data.role === 'AGENT')) profile.disabledStaffAuth++;
        if (!match.emailVerified && (data.role === 'ADMIN' || data.role === 'AGENT')) profile.unverifiedStaffAuth++;
        if (match.providerData.length === 0) profile.matchedWithoutProvider++;
      }
    } else {
      const follower = result.lineFollowers;
      follower.records++;
      const documentValid = lineUserId.test(documentId);
      if (!documentValid) follower.invalidDocumentIds++;
      const hasUserId = data.user_id !== undefined;
      const userIdValid = typeof data.user_id === 'string' && lineUserId.test(data.user_id);
      if (!hasUserId) follower.missingUserIdFields++;
      else if (!userIdValid) follower.invalidUserIdFields++;
      const storedIdValid = typeof data.id === 'string' && lineUserId.test(data.id);
      if (data.id !== undefined && !storedIdValid) follower.invalidStoredIds++;
      // Match the application's user_id -> id/document-id fallback without coercing malformed fields.
      const candidate = hasUserId ? (userIdValid ? data.user_id : null) :
        data.id !== undefined ? (storedIdValid ? data.id : null) : documentValid ? documentId : null;
      let conflict = false;
      if (candidate && documentValid && candidate.toLowerCase() !== documentId.toLowerCase()) conflict = true;
      if (candidate && storedIdValid && candidate.toLowerCase() !== data.id.toLowerCase()) conflict = true;
      if (conflict) follower.idConflicts++;
      const id = candidate?.toLowerCase();
      if (!id) follower.invalidUserIds++;
      else {
        follower.validUserIds++;
        if (followerIds.has(id)) follower.duplicateUserIds++;
        followerIds.add(id);
      }
      if (typeof data.is_active !== 'boolean') follower.invalidActiveFlags++;
      if (data.opted_out !== undefined && typeof data.opted_out !== 'boolean') follower.invalidOptOutFlags++;
      if (data.is_active === true && data.opted_out === true) follower.activeOptOutConflicts++;
      if (data.is_active === false || data.opted_out === true) follower.optedOut++;
      else if (data.is_active === true) { follower.active++; if (id) activeFollowerIds.add(id); }
      else follower.unknownState++;
    }
  }
  for (const [uid, user] of auth) if (!profileUids.has(uid)) {
    result.auth.withoutProfile++;
    if (user.disabled) result.auth.withoutProfileDisabled++;
    else if (user.emailVerified) result.auth.withoutProfileEnabledVerified++;
    else result.auth.withoutProfileEnabledUnverified++;
  }
  result.lineFollowers.uniqueValidUserIds = followerIds.size;
  result.lineFollowers.uniqueActiveUserIds = activeFollowerIds.size;
  const p = result.profiles, f = result.lineFollowers;
  const findings = result.auth.duplicateUids + result.auth.withoutProfile + p.invalidRoles + p.invalidUids + p.uidFieldConflicts +
    p.duplicateDeclaredUids + p.missingAuth + p.disabledStaffAuth + p.unverifiedStaffAuth + f.invalidUserIds + f.invalidUserIdFields + f.invalidStoredIds +
    f.idConflicts + f.duplicateUserIds + f.invalidActiveFlags + f.invalidOptOutFlags + f.activeOptOutConflicts;
  return { ...result, findings };
}

/** Both complete inventories must authenticate before any counts are returned. */
export async function reconcileBackups({ snapshotDirectory, password, expectedProject, expectedDatabase, limits = reconciliationLimits({}) }) {
  if (typeof expectedProject !== 'string' || !expectedProject || typeof expectedDatabase !== 'string' || !expectedDatabase || expectedDatabase === '(default)') fail('RECONCILIATION_PROJECT_REQUIRED');
  const { files } = checkedSnapshot(snapshotDirectory);
  const manifest = JSON.parse(readFileSync(files['firestore.enc.manifest.json'], 'utf8'));
  if (manifest.firestoreProject !== expectedProject || manifest.firestoreDatabase !== expectedDatabase) fail('RECONCILIATION_PROJECT_MISMATCH');
  const bounded = restoreLimits({ MAX_RESTORE_SAMPLE_RECORDS: limits.sampleRecords, MAX_RESTORE_SAMPLE_BYTES: limits.sampleBytes,
    MAX_RESTORE_ARCHIVE_BYTES: Math.min(limits.decodedBytes, 256 * MiB), MAX_RESTORE_TIMEOUT_MS: limits.timeoutMs });
  if (manifest.records > bounded.sampleRecords) fail('RECONCILIATION_INCOMPLETE_INVENTORY');
  const firestore = await readRestoreSample({ filePath: files['firestore.enc'], manifest, password, limits: bounded });
  if (!firestore.authenticated || firestore.sample.length !== firestore.sourceRecords) fail('RECONCILIATION_INCOMPLETE_INVENTORY');
  const auth = await readVerifiedAuthRecords({ filePath: files['firebase-auth.enc'], password, expectedProject,
    maxRecords: bounded.sampleRecords, maxBytes: bounded.sampleBytes });
  if (!auth.authenticated || auth.users.length !== auth.sourceRecords) fail('RECONCILIATION_INCOMPLETE_INVENTORY');
  const counts = countsFor(firestore.sample, auth.users);
  return { ok: true, complete: true, inventoriesMatch: counts.findings === 0, pointInTimeSnapshot: false, passwordCredentialsRestorable: false,
    firestoreRecords: firestore.sourceRecords, ...counts };
}

async function main() {
  try {
    if (process.argv.length !== 3) fail('RECONCILIATION_ARGUMENTS_INVALID');
    const firebase = JSON.parse(readFileSync(new URL('../firebase-applet-config.json', import.meta.url), 'utf8'));
    const database = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8')).firestore?.database;
    const result = await reconcileBackups({ snapshotDirectory: process.argv[2], password: process.env.CHANTAKORN_BACKUP_PASSPHRASE,
      expectedProject: firebase.projectId, expectedDatabase: database, limits: reconciliationLimits() });
    // Fixed keys and aggregate numbers only; no decoded records, provider IDs or private paths.
    console.log(JSON.stringify({ ...result, inventoriesMatch: result.findings === 0 }));
  } catch {
    console.error(JSON.stringify({ ok: false, complete: false, code: 'BACKUP_RECONCILIATION_FAILED' }));
    process.exitCode = 1;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
