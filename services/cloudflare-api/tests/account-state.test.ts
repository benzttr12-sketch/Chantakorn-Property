import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { verifyFirebaseIdToken } from '../src/auth.ts';
import { verifyFirebaseAccountState } from '../src/property-auth.ts';

const apiKey = 'test_account_lookup_key_1234567890';
const fixture = (async () => {
  const project = 'chantakorn-auth-test';
  const now = Math.floor(Date.now() / 1000);
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const pub = { ...await exportJWK(publicKey), kid: 'account-state-test', alg: 'RS256', use: 'sig' };
  const token = await new SignJWT({
    email: 'approved-staff@example.test', email_verified: true, auth_time: now - 120,
  }).setProtectedHeader({ alg: 'RS256', kid: pub.kid })
    .setIssuer(`https://securetoken.google.com/${project}`).setAudience(project)
    .setSubject('approved-staff-uid').setIssuedAt(now - 60).setExpirationTime(now + 300)
    .sign(privateKey);
  const identity = await verifyFirebaseIdToken(token, project, createLocalJWKSet({ keys: [pub] }));
  assert.ok(identity);
  return { token, identity };
})();

const accountFetch = (body: unknown): typeof fetch => async () => Response.json(body);

test('a signed identity requires a live active account and compares auth_time to validSince', async () => {
  const { token, identity } = await fixture;
  const fetchAccount: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://identitytoolkit.googleapis.com');
    assert.equal(url.pathname, '/v1/accounts:lookup');
    assert.equal(url.searchParams.get('key'), apiKey);
    assert.equal(init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(init?.body)), { idToken: token });
    assert.ok(init?.signal);
    return Response.json({ users: [{
      localId: identity.uid, emailVerified: true, disabled: false,
      validSince: String(identity.authTime),
    }] });
  };
  assert.deepEqual(await verifyFirebaseAccountState(token, identity, apiKey, fetchAccount), { ok: true });
  const revoked = await verifyFirebaseAccountState(token, identity, apiKey, accountFetch({ users: [{
    localId: identity.uid, emailVerified: true, validSince: String(identity.authTime + 1),
  }] }));
  assert.equal(revoked.ok, false);
  if (!revoked.ok) assert.equal(revoked.status, 403);
});

test('disabled, deleted, mismatched, or unverified live accounts cannot use a still-valid JWT', async () => {
  const { token, identity } = await fixture;
  const active = { localId: identity.uid, emailVerified: true, validSince: '0' };
  for (const users of [
    [], [{ ...active, disabled: true }], [{ ...active, localId: 'different-uid' }],
    [{ ...active, emailVerified: false }], [active, active],
  ]) {
    const result = await verifyFirebaseAccountState(token, identity, apiKey, accountFetch({ users }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 403);
  }
});

test('missing or malformed revocation state fails closed', async () => {
  const { token, identity } = await fixture;
  for (const value of [undefined, null, '', ' ', '-1', -1, '1e2', 1.5, 'NaN', true, {}, Number.MAX_SAFE_INTEGER + 1]) {
    const result = await verifyFirebaseAccountState(token, identity, apiKey, accountFetch({ users: [{
      localId: identity.uid, emailVerified: true, validSince: value,
    }] }));
    assert.equal(result.ok, false, `validSince=${String(value)}`);
    if (!result.ok) assert.equal(result.status, 403);
  }
});

test('missing API key, lookup outages, and invalid responses never grant staff access', async () => {
  const { token, identity } = await fixture;
  let calls = 0;
  const unexpectedFetch: typeof fetch = async () => { calls++; throw new Error('unexpected fetch'); };
  for (const key of [undefined, '', 'invalid key']) {
    const result = await verifyFirebaseAccountState(token, identity, key, unexpectedFetch);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 503);
  }
  assert.equal(calls, 0);
  const failedFetches: Array<{ fetcher: typeof fetch; status: number }> = [
    { fetcher: async () => { throw new Error('offline'); }, status: 503 },
    { fetcher: async () => new Response('bad json'), status: 503 },
    { fetcher: async () => new Response('{}', { status: 400 }), status: 401 },
    { fetcher: accountFetch({}), status: 403 },
    { fetcher: accountFetch({ users: 'invalid' }), status: 403 },
  ];
  for (const { fetcher, status } of failedFetches) {
    const result = await verifyFirebaseAccountState(token, identity, apiKey, fetcher);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, status);
  }
});
