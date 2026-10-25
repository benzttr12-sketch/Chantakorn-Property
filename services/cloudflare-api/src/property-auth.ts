import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { profiles } from './db/schema.ts';
import { authorizeStaffProfile, extractBearer, firebaseProjectConfigured, verifyFirebaseIdToken, type VerifiedIdentity } from './auth.ts';
import { matchAllowedOrigin } from './media-validation.ts';

export type PropertyAuthEnv = {
  DB: D1Database;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_WEB_API_KEY?: string;
  ALLOWED_ORIGIN: string;
  PROPERTY_WRITES_ENABLED?: string;
  PROPERTY_PUBLICATION_ENABLED?: string;
};
export type StaffAuth = { ok: true; uid: string; fullName: string; role: 'ADMIN' | 'AGENT' }
  | { ok: false; status: 401 | 403 | 503; error: string };
type AccountStateCheck = { ok: true } | Extract<StaffAuth, { ok: false }>;

/** Check current Firebase account state for every protected read and write path. */
export async function verifyFirebaseAccountState(
  token: string,
  identity: VerifiedIdentity,
  apiKey: string | undefined,
  fetchAccount: typeof fetch = fetch,
): Promise<AccountStateCheck> {
  if (!apiKey || !/^[A-Za-z0-9_-]{20,100}$/.test(apiKey))
    return { ok: false, status: 503, error: 'Account state verification unavailable' };
  let response: Response;
  try {
    response = await fetchAccount(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { return { ok: false, status: 503, error: 'Could not verify account state' }; }
  if (!response.ok) return { ok: false, status: 401, error: 'Firebase session is invalid' };
  let body: unknown;
  try { body = await response.json(); }
  catch { return { ok: false, status: 503, error: 'Invalid account lookup response' }; }
  const users = (body && typeof body === 'object' && 'users' in body &&
    Array.isArray(body.users)) ? body.users as unknown[] : [];
  const user = users[0];
  if (users.length !== 1 || !user || typeof user !== 'object')
    return { ok: false, status: 403, error: 'Account unavailable' };
  const state = user as { localId?: unknown; disabled?: unknown; emailVerified?: unknown; validSince?: unknown };
  if (state.localId !== identity.uid || state.disabled === true || state.emailVerified !== true)
    return { ok: false, status: 403, error: 'Firebase account is not active or verified' };
  // Missing/malformed revocation state must not grant access on a protected path.
  const validSince = typeof state.validSince === 'string' && /^\d+$/.test(state.validSince)
    ? Number(state.validSince) : state.validSince;
  if (typeof validSince !== 'number' || !Number.isSafeInteger(validSince) || validSince < 0 ||
      validSince > identity.authTime)
    return { ok: false, status: 403, error: 'Firebase login is revoked or account state is incomplete' };
  return { ok: true };
}

export function canWriteProperties(env: PropertyAuthEnv, origin: string | undefined): boolean {
  return env.PROPERTY_WRITES_ENABLED === 'true' &&
    matchAllowedOrigin(origin ?? null, env.ALLOWED_ORIGIN) !== null;
}

/**
 * Read-only staff access on D1, plus optional live account lookup for routes with PII
 * and all mutation routes. No privileged admin role is inferred from a JWT payload.
 */
export async function authorizePropertyStaff(
  env: PropertyAuthEnv,
  header: string | undefined,
  liveFirebaseCheck = false,
): Promise<StaffAuth> {
  if (!firebaseProjectConfigured(env.FIREBASE_PROJECT_ID))
    return { ok: false, status: 503, error: 'Authentication is not configured' };
  const token = extractBearer(header);
  if (!token) return { ok: false, status: 401, error: 'Authentication required' };
  const identity = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
  if (!identity) return { ok: false, status: 401, error: 'Invalid Firebase identity' };
  const [profile] = await drizzle(env.DB).select({
    uid: profiles.uid, fullName: profiles.fullName, role: profiles.role,
    authDisabled: profiles.authDisabled, tokensValidAfter: profiles.tokensValidAfter,
  }).from(profiles).where(eq(profiles.uid, identity.uid)).limit(1);
  const role = authorizeStaffProfile(identity, profile);
  if (!role) return { ok: false, status: 403, error: 'Staff permission denied' };

  if (liveFirebaseCheck) {
    // Firebase lookups are intentionally rare: only staff read/write paths.
    // Missing key or network failure denies access rather than trusting stale roles.
    const state = await verifyFirebaseAccountState(token, identity, env.FIREBASE_WEB_API_KEY);
    if (!state.ok) return state;
  }
  return { ok: true, uid: identity.uid, fullName: profile.fullName, role };
}
