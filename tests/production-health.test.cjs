const test = require('node:test');
const assert = require('node:assert/strict');

const monitor = import('../scripts/production-health.mjs');
const now = Date.parse('2026-11-03T12:00:00Z');
const json = (body, headers = {}, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', ...headers },
});
const appHeaders = {
  'content-type': 'text/html',
  'cross-origin-opener-policy': 'same-origin-allow-popups',
  'content-security-policy': "script-src 'self' https://apis.google.com",
};

function fixture(override = () => undefined) {
  const requests = [];
  return {
    requests,
    fetchImpl: async (input, options) => {
      const url = new URL(input);
      requests.push({ url, options });
      assert.equal(options.method, 'GET');
      assert.equal(options.redirect, 'error');
      assert.equal(options.credentials, 'omit');
      assert.ok(options.signal instanceof AbortSignal);
      const replacement = await override(url, options);
      if (replacement) return replacement;
      if (['dns.google', 'cloudflare-dns.com'].includes(url.hostname)) {
        return json({ Status: 0, Answer: url.searchParams.get('type') === 'NS'
          ? [{ type: 2, data: 'elmo.ns.cloudflare.com.' }, { type: 2, data: 'MEGAN.NS.CLOUDFLARE.COM.' }]
          : [{ type: 1, data: '192.0.2.1' }] });
      }
      if (url.hostname === 'rdap.verisign.com') return json({
        ldhName: 'CHANTAKORNPROPERTY.COM', status: ['client transfer prohibited'],
        events: [{ eventAction: 'expiration', eventDate: '2027-10-18T00:00:00Z' }],
      });
      if (url.pathname === '/v1/staff/me') return json({ error: 'Unauthorized' }, { 'cache-control': 'private, no-store' }, 401);
      if (url.pathname === '/v1/properties') return json({
        data: [{ title: 'Synthetic listing', published: true, cover_image: '/v1/media/properties/synthetic-cover' }], next_cursor: null,
      }, { 'access-control-allow-origin': options.headers.Origin });
      if (url.pathname === '/v1/media/properties/synthetic-cover') return new Response('synthetic image', {
        headers: { 'content-type': 'image/webp', 'access-control-allow-origin': options.headers.Origin },
      });
      if (url.pathname === '/__/auth/iframe.js') return new Response('x'.repeat(2000), {
        headers: { 'content-type': 'text/javascript', 'cross-origin-opener-policy': 'unsafe-none' },
      });
      if (['/', '/login'].includes(url.pathname)) return new Response('<title>CHANTAKORN PROPERTY | Test</title>', { headers: appHeaders });
      throw new Error('Unexpected request');
    },
    readCertificate: async () => 60,
    now, attempts: 1,
  };
}

test('production monitor checks both origins, independent DNS, media and staff denial without credentials or writes', async () => {
  const { runProductionChecks, SITE_ORIGINS } = await monitor;
  const f = fixture();
  const report = await runProductionChecks(f);
  assert.equal(report.ok, true);
  assert.equal(report.checks.length, 19);
  for (const origin of SITE_ORIGINS) {
    assert.ok(f.requests.some(row => row.url.href === origin + '/login'));
    assert.ok(f.requests.some(row => row.url.pathname === '/v1/properties' && row.options.headers.Origin === origin));
    assert.ok(f.requests.some(row => row.url.pathname.startsWith('/v1/media/') && row.options.headers.Origin === origin));
  }
  assert.ok(f.requests.every(row => !row.url.pathname.startsWith('/v1/media/inquiries/')));
  assert.ok(f.requests.every(row => !row.options.headers.Cookie));
  assert.deepEqual(new Set(f.requests.filter(row => row.url.searchParams.has('type')).map(row => row.url.hostname)), new Set(['dns.google', 'cloudflare-dns.com']));
});

test('DNS suspension, parking HTTP 200, OAuth header drift and access regressions fail closed', async t => {
  const { runProductionChecks } = await monitor;
  const cases = [
    ['dns-resolution-failed', url => url.hostname === 'dns.google' && json({ Status: 2 })],
    ['nameservers-changed', url => url.searchParams.get('type') === 'NS' && json({ Status: 0, Answer: [{ type: 2, data: 'launch1.spaceship.net.' }] })],
    ['registration-suspended', url => url.hostname === 'rdap.verisign.com' && json({ ldhName: 'chantakornproperty.com', status: ['client hold'] })],
    ['registration-expiring', url => url.hostname === 'rdap.verisign.com' && json({ ldhName: 'chantakornproperty.com', events: [{ eventAction: 'expiration', eventDate: '2026-11-10T00:00:00Z' }] })],
    ['wrong-website', url => url.pathname === '/' && new Response('<title>Domain parked</title>', { headers: appHeaders })],
    ['popup-policy-changed', url => url.pathname === '/login' && new Response('<title>CHANTAKORN PROPERTY</title>', { headers: { ...appHeaders, 'cross-origin-opener-policy': 'same-origin' } })],
    ['auth-helper-unavailable', url => url.pathname === '/__/auth/iframe.js' && new Response('<html>404</html>', { headers: { 'content-type': 'text/html' } })],
    ['catalog-origin-denied', url => url.pathname === '/v1/properties' && json({ data: [], next_cursor: null }, { 'access-control-allow-origin': '*' })],
    ['catalog-schema-invalid', (url, opts) => url.pathname === '/v1/properties' && json({ data: [], next_cursor: 123 }, { 'access-control-allow-origin': opts.headers.Origin })],
    ['staff-access-boundary-failed', url => url.pathname === '/v1/staff/me' && json({ role: 'ADMIN' })],
  ];
  for (const [code, override] of cases) await t.test(code, async () => {
    const report = await runProductionChecks(fixture(override));
    assert.equal(report.ok, false);
    assert.ok(report.checks.some(row => row.code === code), JSON.stringify(report));
  });
});

test('catalog monitor never follows an external or private cover URL', async () => {
  const { runProductionChecks } = await monitor;
  for (const cover of ['https://untrusted.invalid/image', '/v1/media/inquiries/private', 'https://user:password@chantakorn-property-api.chantakorn-property.workers.dev/v1/media/properties/key']) {
    const f = fixture((url, opts) => url.pathname === '/v1/properties' && json({
      data: [{ title: 'Synthetic', published: true, cover_image: cover }], next_cursor: null,
    }, { 'access-control-allow-origin': opts.headers.Origin }));
    const report = await runProductionChecks(f);
    assert.ok(report.checks.some(row => row.code === 'catalog-cover-origin-invalid'));
    assert.ok(!f.requests.some(row => row.url.href === cover));
    assert.ok(!f.requests.some(row => row.url.pathname.startsWith('/v1/media/')));
  }
});

test('empty catalog is valid and certificate expiry fails independently', async () => {
  const { runProductionChecks } = await monitor;
  const f = fixture((url, opts) => url.pathname === '/v1/properties' && json({ data: [], next_cursor: null }, { 'access-control-allow-origin': opts.headers.Origin }));
  assert.equal((await runProductionChecks(f)).ok, true);
  const report = await runProductionChecks({ ...f, readCertificate: async () => 13 });
  assert.equal(report.checks.filter(row => row.code === 'certificate-expiring').length, 2);
});

test('transient failures retry within the bound and raw provider details never reach reports', async () => {
  const { runProductionChecks } = await monitor;
  let calls = 0;
  const f = fixture(url => {
    if (url.hostname === 'dns.google' && ++calls === 1) throw new Error('private token / customer@example.invalid');
  });
  const report = await runProductionChecks({ ...f, attempts: 2 });
  assert.equal(report.ok, true);
  const broken = fixture(() => { throw new Error('private token / customer@example.invalid'); });
  const failed = await runProductionChecks(broken);
  assert.equal(failed.ok, false);
  assert.ok(!JSON.stringify(failed).includes('customer@'));
  assert.ok(!JSON.stringify(failed).includes('private token'));
});

test('bounded response reader rejects misleading length headers and oversized streams', async () => {
  const { boundedRequest } = await monitor;
  await assert.rejects(boundedRequest('https://example.invalid', { maxBytes: 8,
    fetchImpl: async () => new Response('small', { headers: { 'content-length': '100' } }),
  }), /response-too-large/);
  await assert.rejects(boundedRequest('https://example.invalid', { maxBytes: 8,
    fetchImpl: async () => new Response('more than eight bytes'),
  }), /response-too-large/);
});
