/**
 * Offline planner for bootstrapping verified D1 staff roles from Firebase data.
 *
 * An authorized operator exports the Firebase Authentication user list and the
 * Firestore `profiles` documents (see docs/firestore-encrypted-backup-runbook.md),
 * writes an explicit approved-UID list, and runs the CLI. This module performs
 * every check before producing SQL: an ADMIN/AGENT profile is only accepted when
 * its UID exists in the Auth export, is verified and enabled, its role is known,
 * its email agrees with Auth, and the UID appears on the approved list. Nothing
 * here touches the network or a database; the generated SQL only inserts missing
 * rows (`ON CONFLICT DO NOTHING`) so an existing D1 profile is never rewritten.
 */
export const MAX_STAFF_IMPORT = 500;
export const STAFF_IMPORT_TOOL = 'chantakorn-staff-import/1';

export type StaffRole = 'ADMIN' | 'AGENT';
export type StaffImportEntry = { uid: string; role: StaffRole; fullName: string; email: string | null };
export type StaffImportPlan = {
  inserts: StaffImportEntry[];
  profilesSeen: number;
  skippedUser: number;
  byRole: { ADMIN: number; AGENT: number };
};
export type StaffImportInput = {
  authText: string;
  profilesText: string;
  approvedText: string;
  now?: Date;
};
export type StaffImportResult =
  | { ok: true; errors: []; plan: StaffImportPlan; sql: string; manifest: Record<string, unknown> }
  | { ok: false; errors: string[] };

const UID_RE = /^[A-Za-z0-9_-]{6,128}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_RE = /[\u0000-\u001f\u007f]/;
const ALL_ROLES = new Set(['USER', 'AGENT', 'ADMIN']);

type AuthUser = { uid: string; email: string | null; emailVerified: boolean; disabled: boolean };
type RawProfile = { uid: string; role: string; fullName: string; email: string | null };

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** Windows exports may carry a UTF-8 BOM; strip it for parsing but keep the raw file hash. */
function withoutBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

export function parseAuthExport(textValue: string): { users: Map<string, AuthUser>; errors: string[] } {
  const errors: string[] = [];
  const users = new Map<string, AuthUser>();
  let parsed: unknown;
  try { parsed = JSON.parse(textValue); }
  catch { return { users, errors: ['Firebase Auth export is not valid JSON'] }; }
  const list = parsed && typeof parsed === 'object' && 'users' in parsed ? (parsed as { users?: unknown }).users : null;
  if (!Array.isArray(list) || list.length === 0) return { users, errors: ['Firebase Auth export must contain a non-empty users array'] };
  if (list.length > 10_000) return { users, errors: ['Firebase Auth export exceeds the supported user count'] };
  for (const [index, item] of list.entries()) {
    if (!item || typeof item !== 'object') { errors.push(`Auth users[${index}] is not an object`); continue; }
    const user = item as Record<string, unknown>;
    const uid = text(user.localId);
    if (!uid || !UID_RE.test(uid)) { errors.push(`Auth users[${index}] has an invalid localId`); continue; }
    if (users.has(uid)) { errors.push(`Firebase Auth export repeats UID ${uid}`); continue; }
    const email = text(user.email);
    if (email !== null && (!EMAIL_RE.test(email) || email.length > 254)) { errors.push(`Auth user ${uid} has an invalid email`); continue; }
    if (typeof user.emailVerified !== 'boolean' || typeof user.disabled !== 'boolean') {
      errors.push(`Auth user ${uid} is missing emailVerified/disabled flags`); continue;
    }
    users.set(uid, { uid, email: email ? email.toLowerCase() : null, emailVerified: user.emailVerified, disabled: user.disabled });
  }
  return { users, errors };
}

export function parseProfilesExport(textValue: string): { profiles: RawProfile[]; errors: string[] } {
  const errors: string[] = [];
  const profiles: RawProfile[] = [];
  const trimmed = textValue.trim();
  if (!trimmed) return { profiles, errors: ['Firestore profiles export is empty'] };
  const records: unknown[] = [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) return { profiles, errors: ['Profiles JSON must be an array or NDJSON lines'] };
      records.push(...parsed);
    } catch { return { profiles, errors: ['Profiles JSON array is not valid JSON'] }; }
  } else {
    for (const [line, source] of trimmed.split(/\r?\n/).entries()) {
      if (!source.trim() || source.trim().startsWith('#')) continue;
      try { records.push(JSON.parse(source)); }
      catch { errors.push(`Profiles NDJSON line ${line + 1} is not valid JSON`); }
    }
  }
  for (const [index, record] of records.entries()) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) { errors.push(`Profiles record ${index + 1} is not an object`); continue; }
    const raw = record as Record<string, unknown>;
    // Accept both flattened documents and { id, data: { ...fields } } exports.
    const data = raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
      ? raw.data as Record<string, unknown> : raw;
    const uid = text(raw.uid) || text(raw.id) || text(data.uid);
    const role = text(data.role);
    if (!uid || !UID_RE.test(uid)) { errors.push(`Profiles record ${index + 1} has a missing or invalid UID`); continue; }
    if (!role || !ALL_ROLES.has(role)) { errors.push(`Profiles record ${uid} has a missing or unsupported role`); continue; }
    profiles.push({
      uid, role,
      fullName: text(data.full_name) ?? text(data.fullName) ?? '',
      email: text(data.email),
    });
  }
  return { profiles, errors };
}

export function parseApprovedUids(textValue: string): { uids: Set<string>; errors: string[] } {
  const uids = new Set<string>();
  const errors: string[] = [];
  for (const [line, source] of textValue.split(/\r?\n/).entries()) {
    const value = source.trim();
    if (!value || value.startsWith('#')) continue;
    if (!UID_RE.test(value)) { errors.push(`Approved UID line ${line + 1} is not a valid UID`); continue; }
    if (uids.has(value)) { errors.push(`Approved UID list repeats ${value}`); continue; }
    uids.add(value);
  }
  return { uids, errors };
}

function cleanName(value: string): string | null {
  const name = value.trim();
  if (name.length < 2 || name.length > 120 || CONTROL_RE.test(name)) return null;
  return name;
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function renderStaffImportSql(
  plan: StaffImportPlan, hashes: { auth: string; profiles: string; approved: string }, generatedAt: string,
): string {
  const rows = plan.inserts.map(entry =>
    `  (${sqlLiteral(entry.uid)}, ${sqlLiteral(entry.fullName)}, ${entry.email ? sqlLiteral(entry.email) : 'NULL'}, ` +
    `${sqlLiteral(entry.role)}, 0, 0, ${sqlLiteral(generatedAt)}, ${sqlLiteral(generatedAt)})`);
  return [
    '-- Chantakorn D1 staff role import (offline planner output; review by a second operator)',
    `-- generated_at: ${generatedAt}`,
    `-- entries: ${plan.inserts.length} (ADMIN ${plan.byRole.ADMIN}, AGENT ${plan.byRole.AGENT})`,
    `-- auth_sha256: ${hashes.auth}`,
    `-- profiles_sha256: ${hashes.profiles}`,
    `-- approved_sha256: ${hashes.approved}`,
    '-- Existing rows are never modified: ON CONFLICT DO NOTHING.',
    'INSERT INTO profiles (uid, full_name, email, role, auth_disabled, tokens_valid_after, created_at, updated_at)',
    'VALUES',
    rows.join(',\n'),
    'ON CONFLICT(uid) DO NOTHING;',
    '',
  ].join('\n');
}

export async function buildStaffImport({ authText, profilesText, approvedText, now = new Date() }: StaffImportInput): Promise<StaffImportResult> {
  const errors: string[] = [];
  const auth = parseAuthExport(withoutBom(authText));
  const profiles = parseProfilesExport(withoutBom(profilesText));
  const approved = parseApprovedUids(withoutBom(approvedText));
  errors.push(...auth.errors, ...profiles.errors, ...approved.errors);
  if (!approved.uids.size) errors.push('Approved UID list must contain at least one UID');
  if (Number.isNaN(now.getTime())) errors.push('Import timestamp is invalid');
  const generatedAt = now.toISOString();

  const seen = new Set<string>();
  const inserts: StaffImportEntry[] = [];
  let skippedUser = 0;
  for (const profile of profiles.profiles) {
    if (profile.role === 'USER') { skippedUser++; continue; }
    const { uid } = profile;
    if (seen.has(uid)) { errors.push(`Profiles export repeats staff UID ${uid}`); continue; }
    seen.add(uid);
    const user = auth.users.get(uid);
    if (!user) { errors.push(`Staff profile ${uid} has no matching Firebase Auth account`); continue; }
    if (!user.emailVerified) errors.push(`Firebase account ${uid} is not email-verified`);
    if (user.disabled) errors.push(`Firebase account ${uid} is disabled`);
    const fullName = cleanName(profile.fullName);
    if (!fullName) errors.push(`Staff profile ${uid} needs a valid full_name (2-120 printable characters)`);
    let email: string | null = null;
    if (profile.email !== null) {
      const trimmed = profile.email.trim().toLowerCase();
      if (!EMAIL_RE.test(trimmed) || trimmed.length > 254) errors.push(`Staff profile ${uid} has an invalid email`);
      else email = trimmed;
    }
    if (email && user.email && email !== user.email) errors.push(`Staff profile ${uid} email does not match Firebase Auth`);
    if (!email && user.email) email = user.email;
    if (!approved.uids.has(uid)) errors.push(`Staff UID ${uid} is not on the approved UID list`);
    if (fullName) inserts.push({ uid, role: profile.role as StaffRole, fullName, email });
  }
  for (const uid of approved.uids) {
    if (!seen.has(uid)) errors.push(`Approved UID ${uid} has no ADMIN/AGENT profile in the export`);
  }
  if (inserts.length > MAX_STAFF_IMPORT) errors.push(`Staff import exceeds the ${MAX_STAFF_IMPORT}-entry limit`);
  if (!inserts.length) errors.push('No verified, approved ADMIN/AGENT profiles were found to import');
  if (errors.length) return { ok: false, errors };

  inserts.sort((a, b) => a.uid.localeCompare(b.uid));
  const plan: StaffImportPlan = {
    inserts, profilesSeen: profiles.profiles.length, skippedUser,
    byRole: {
      ADMIN: inserts.filter(entry => entry.role === 'ADMIN').length,
      AGENT: inserts.filter(entry => entry.role === 'AGENT').length,
    },
  };
  const [authHash, profilesHash, approvedHash] = await Promise.all([
    sha256Hex(authText), sha256Hex(profilesText), sha256Hex(approvedText),
  ]);
  const hashes = { auth: authHash, profiles: profilesHash, approved: approvedHash };
  return {
    ok: true, errors: [],
    plan,
    sql: renderStaffImportSql(plan, hashes, generatedAt),
    // Deliberately no names/emails: the manifest is an audit companion for the SQL file.
    manifest: {
      tool: STAFF_IMPORT_TOOL, generated_at: generatedAt,
      inputs: { auth_sha256: authHash, profiles_sha256: profilesHash, approved_sha256: approvedHash },
      summary: {
        profiles_seen: plan.profilesSeen, staff: plan.inserts.length,
        by_role: plan.byRole, skipped_user: skippedUser,
      },
      entries: plan.inserts.map(entry => ({ uid: entry.uid, role: entry.role })),
    },
  };
}
