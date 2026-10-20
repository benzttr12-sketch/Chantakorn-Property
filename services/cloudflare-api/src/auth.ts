import { createRemoteJWKSet, jwtVerify } from 'jose';

// Firebase Secure Token public signing keys (RS256), not App Check or a Firebase custom token.
// The remote key set is cached/revalidated by jose, so no Firebase Admin private key is needed.
const firebaseKeys = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
  { timeoutDuration: 5000, cooldownDuration: 30_000 },
);

export type VerifiedIdentity = {
  uid: string;
  email?: string;
  issuedAt: number;
  authTime: number;
};

export function firebaseProjectConfigured(projectId: string | undefined): projectId is string {
  return !!projectId && /^[a-z0-9][a-z0-9-]{3,98}[a-z0-9]$/.test(projectId)
    && !projectId.includes('replace') && !projectId.includes('placeholder');
}

export function extractBearer(header: string | undefined): string | null {
  if (!header || header.length > 8192) return null;
  const match = /^Bearer ([A-Za-z0-9_.-]{40,8000})$/.exec(header);
  return match ? match[1] : null;
}

/** Verify claims AND cryptographic signature, never decode JWT without verification. */
export async function verifyFirebaseIdToken(
  token: string,
  projectId: string,
  verificationKeys: Parameters<typeof jwtVerify>[1] = firebaseKeys,
): Promise<VerifiedIdentity | null> {
  if (!firebaseProjectConfigured(projectId) || token.length > 8000 || token.split('.').length !== 3) return null;
  try {
    const { payload } = await jwtVerify(token, verificationKeys, {
      algorithms: ['RS256'],
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      clockTolerance: 5,
    });
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) return null;
    if (typeof payload.iat !== 'number' || !Number.isInteger(payload.iat) || payload.iat > now + 5) return null;
    if (typeof payload.auth_time !== 'number' || !Number.isInteger(payload.auth_time) ||
        payload.auth_time < 0 || payload.auth_time > now + 5) return null;
    if (payload.email_verified !== true) return null;
    return {
      uid: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      issuedAt: payload.iat,
      authTime: payload.auth_time,
    };
  } catch {
    return null;
  }
}
