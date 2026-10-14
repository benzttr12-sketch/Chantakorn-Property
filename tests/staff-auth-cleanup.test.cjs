const test = require('node:test');
const assert = require('node:assert/strict');
const loader = require('./load-ts.cjs');

const request = token => new Request('https://example.test/api/line/diagnostics', {
  headers: { Authorization: `Bearer ${token}` },
});

test('retired demo bearer tokens still require Firebase verification even with legacy preview flags', async () => {
  let lookups = 0;
  const token = `demo ${Buffer.from('preview@example.test|ADMIN').toString('base64')}`;
  const { requireStaff } = loader({}, {
    process: { env: { NEXT_PUBLIC_DATA_BACKEND: 'local', NEXT_PUBLIC_ENABLE_DEMO_AUTH: 'true', NEXT_PUBLIC_FIREBASE_API_KEY: 'public-fixture', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'fixture-project' } },
    fetch: async (url, options) => {
      assert.ok(String(url).startsWith('https://identitytoolkit.googleapis.com/'));
      assert.equal(JSON.parse(options.body).idToken, token);
      lookups++;
      return Response.json({ error: 'INVALID_ID_TOKEN' }, { status: 400 });
    },
  })('lib/server-auth.ts');
  assert.equal((await requireStaff(request(token))).status, 401);
  assert.equal(lookups, 1);
});

test('real staff verification retains verified accounts and current server-controlled roles', async () => {
  for (const fixture of [
    { role: 'ADMIN', verified: true, expected: null },
    { role: 'AGENT', verified: true, expected: null },
    { role: 'USER', verified: true, expected: 403 },
    { role: 'OWNER', verified: true, expected: 403 },
    { role: 'ADMIN', verified: false, expected: 403 },
    { role: 'ADMIN', verified: true, disabled: true, expected: 403 },
  ]) {
    const calls = [];
    const { requireStaff } = loader({}, {
      process: { env: { NEXT_PUBLIC_FIREBASE_API_KEY: 'public-fixture', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'fixture-project' } },
      fetch: async (url, options) => {
        calls.push(String(url));
        if (String(url).startsWith('https://identitytoolkit.googleapis.com/')) {
          return Response.json({ users: [{ localId: 'staff-fixture', emailVerified: fixture.verified, disabled: fixture.disabled }] });
        }
        assert.ok(String(url).includes('/documents/profiles/staff-fixture'));
        assert.equal(options.headers.Authorization, 'Bearer firebase-fixture');
        return Response.json({ fields: { role: { stringValue: fixture.role } } });
      },
    })('lib/server-auth.ts');
    const result = await requireStaff(request('firebase-fixture'));
    assert.equal(result?.status ?? null, fixture.expected);
    assert.equal(calls.length, fixture.verified && !fixture.disabled ? 2 : 1);
  }
});
