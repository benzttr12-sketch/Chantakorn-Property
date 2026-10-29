const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { getPathMatch } = require('next/dist/shared/lib/router/utils/path-match');

// Next applies matching rules in order; the last value for a header wins.
// Use its installed route matcher so helper-prefix boundaries match production.
function effectiveHeaders(rules, pathname) {
  const headers = new Map();
  for (const rule of rules) {
    if (getPathMatch(rule.source)(pathname) === false) continue;
    for (const header of rule.headers) headers.set(header.key.toLowerCase(), header.value);
  }
  return headers;
}

test('deployed page CSP permits Firebase Google auth scripts and popup communication', async () => {
  const { default: config } = await import(pathToFileURL(path.join(__dirname, '../next.config.mjs')));
  const headers = (await config.headers()).find(row => row.source === '/:path*').headers;
  const csp = headers.find(header => header.key === 'Content-Security-Policy').value;
  const directives = new Map(csp.split(';').map(part => {
    const [name, ...values] = part.trim().split(/\s+/); return [name, values];
  }));
  function permits(directive, resource) {
    return directives.get(directive).some(source => {
      if (!source.startsWith('https://')) return false;
      const allowed = new URL(source), actual = new URL(resource);
      return allowed.origin === actual.origin && (allowed.pathname === '/' ||
        (allowed.pathname.endsWith('/') ? actual.pathname.startsWith(allowed.pathname) : actual.pathname === allowed.pathname));
    });
  }
  assert.ok(!permits('script-src', 'https://accounts.google.com/gsi/client'));
  // Firebase's installed popup/redirect resolver loads api.js, then iframe modules.
  assert.ok(permits('script-src', 'https://apis.google.com/js/api.js'));
  assert.ok(permits('script-src', 'https://apis.google.com/_/scs/apps-static/_/js/iframe-module'));
  assert.ok(!permits('connect-src', 'https://accounts.google.com/gsi/status'));
  assert.ok(!permits('connect-src', 'https://accounts.google.com/unrelated'));
  assert.equal(headers.find(header => header.key === 'Cross-Origin-Opener-Policy').value, 'same-origin-allow-popups');
});

test('Firebase helper navigations preserve their opener without changing other security headers', async () => {
  const { default: config } = await import(pathToFileURL(path.join(__dirname, '../next.config.mjs')));
  const rules = await config.headers();
  const appHeaders = effectiveHeaders(rules, '/login');
  assert.equal(appHeaders.get('cross-origin-opener-policy'), 'same-origin-allow-popups');
  appHeaders.delete('cross-origin-opener-policy');
  for (const pathname of ['/__/auth', '/__/auth/', '/__/auth/handler', '/__/auth/iframe', '/__/auth/handler.js', '/__/auth/iframe.js', '/__/auth/experiments.js', '/__/auth/nested/callback']) {
    const headers = effectiveHeaders(rules, pathname);
    assert.equal(headers.get('cross-origin-opener-policy'), 'unsafe-none', pathname);
    headers.delete('cross-origin-opener-policy');
    assert.deepEqual(headers, appHeaders, `${pathname} must retain CSP, framing, HSTS and all other protections`);
  }
});

test('the Firebase helper COOP exception cannot spill onto application routes or lookalike prefixes', async () => {
  const { default: config } = await import(pathToFileURL(path.join(__dirname, '../next.config.mjs')));
  const rules = await config.headers();
  const appHeaders = effectiveHeaders(rules, '/login');
  for (const pathname of ['/', '/login', '/register', '/admin', '/admin/properties', '/properties', '/api/line/diagnostics', '/__/authentication', '/__/authentication/handler', '/__/auth-evil', '/__/auth-evil/handler', '/__/auth%2Fhandler', '/x/__/auth/handler']) {
    assert.deepEqual(effectiveHeaders(rules, pathname), appHeaders, pathname);
  }
});
