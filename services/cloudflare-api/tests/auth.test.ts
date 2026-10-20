import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { authorizeStaffProfile, extractBearer, firebaseProjectConfigured, verifyFirebaseIdToken } from '../src/auth.ts';

const project = 'chantakorn-auth-test';
const now = Math.floor(Date.now() / 1000);

test('only configured Firebase project IDs and bounded Bearer tokens are accepted', () => {
  assert.equal(firebaseProjectConfigured(project), true);
  assert.equal(firebaseProjectConfigured('replace-with-firebase-project-id'), false);
  assert.equal(firebaseProjectConfigured(''), false);
  assert.equal(extractBearer('Bearer a.b.c'), null);
  assert.equal(extractBearer('Basic ' + 'a'.repeat(60)), null);
  assert.equal(extractBearer('Bearer ' + 'a'.repeat(40)), 'a'.repeat(40));
});

test('cryptographic signature and all Firebase claims are verified', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const pub = await exportJWK(publicKey);
  pub.kid = 'test-kid';
  pub.alg = 'RS256';
  pub.use = 'sig';
  const keys = createLocalJWKSet({ keys: [pub] });
  const sign = (overrides: { audience?: string; issuer?: string; verified?: boolean; authTime?: number; issuedAt?: number; exp?: number } = {}) =>
    new SignJWT({ email: 'staff@example.test', email_verified: overrides.verified ?? true, auth_time: overrides.authTime ?? now - 90 })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
      .setIssuer(overrides.issuer ?? `https://securetoken.google.com/${project}`)
      .setAudience(overrides.audience ?? project)
      .setSubject('firebase-uid-123')
      .setIssuedAt(overrides.issuedAt ?? now - 60)
      .setExpirationTime(overrides.exp ?? now + 120)
      .sign(privateKey);

  const valid = await sign();
  const identity = await verifyFirebaseIdToken(valid, project, keys);
  assert.equal(identity?.uid, 'firebase-uid-123');
  assert.equal(identity?.email, 'staff@example.test');
  assert.equal(identity?.authTime, now - 90);
  assert.equal(await verifyFirebaseIdToken(await sign({ audience: 'other-project' }), project, keys), null);
  assert.equal(await verifyFirebaseIdToken(await sign({ issuer: 'https://securetoken.google.com/other' }), project, keys), null);
  assert.equal(await verifyFirebaseIdToken(await sign({ verified: false }), project, keys), null);
  assert.equal(await verifyFirebaseIdToken(await sign({ authTime: now + 500 }), project, keys), null);
  assert.equal(await verifyFirebaseIdToken(await sign({ issuedAt: now + 500 }), project, keys), null);
  assert.equal(await verifyFirebaseIdToken(await sign({ exp: now - 100 }), project, keys), null);
  const altered = valid.slice(0, -6) + 'ABCDEF';
  assert.equal(await verifyFirebaseIdToken(altered, project, keys), null);
});

test('role gate denies missing, mismatched, disabled, revoked, and USER identities', () => {
  const identity = { uid: 'staff-123', issuedAt: 500, authTime: 400 };
  const profile = { uid: 'staff-123', role: 'ADMIN', authDisabled: false, tokensValidAfter: 0 };
  assert.equal(authorizeStaffProfile(identity, profile), 'ADMIN');
  assert.equal(authorizeStaffProfile(identity, { ...profile, role: 'AGENT' }), 'AGENT');
  assert.equal(authorizeStaffProfile(identity, undefined), null);
  assert.equal(authorizeStaffProfile(identity, { ...profile, uid: 'someone-else' }), null);
  assert.equal(authorizeStaffProfile(identity, { ...profile, role: 'USER' }), null);
  assert.equal(authorizeStaffProfile(identity, { ...profile, authDisabled: true }), null);
  assert.equal(authorizeStaffProfile(identity, { ...profile, tokensValidAfter: 401 }), null);
  assert.equal(authorizeStaffProfile(identity, { ...profile, tokensValidAfter: 400 }), 'ADMIN');
});
