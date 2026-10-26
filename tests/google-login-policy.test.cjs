const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

test('deployed page CSP permits the GIS resources required for Google login without a broad Google wildcard', async () => {
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
  assert.ok(permits('script-src', 'https://accounts.google.com/gsi/client'));
  // Firebase's installed popup/redirect resolver loads api.js, then iframe modules.
  assert.ok(permits('script-src', 'https://apis.google.com/js/api.js'));
  assert.ok(permits('script-src', 'https://apis.google.com/_/scs/apps-static/_/js/iframe-module'));
  assert.ok(permits('style-src', 'https://accounts.google.com/gsi/style'));
  assert.ok(permits('frame-src', 'https://accounts.google.com/gsi/button'));
  assert.ok(permits('connect-src', 'https://accounts.google.com/gsi/status'));
  assert.ok(!permits('connect-src', 'https://accounts.google.com/unrelated'));
  assert.equal(headers.find(header => header.key === 'Cross-Origin-Opener-Policy').value, 'same-origin-allow-popups');
});
