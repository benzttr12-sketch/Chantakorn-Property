const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const site = 'https://chantakornproperty.com';
const policy = import(pathToFileURL(path.join(__dirname, '../next.config.mjs'))).then(async ({ default: config }) => {
  const headers = (await config.headers()).find(row => row.source === '/:path*').headers;
  return new Map(headers.find(header => header.key === 'Content-Security-Policy').value.split(';').map(part => {
    const [directive, ...sources] = part.trim().split(/\s+/);
    return [directive, sources];
  }));
});

async function permits(directive, resource) {
  const directives = await policy;
  const actual = new URL(resource, site);
  return (directives.get(directive) || directives.get('default-src')).some(source => {
    if (source === "'self'") return actual.origin === site;
    if (!source.startsWith('https://')) return false;
    const allowed = new URL(source);
    const hostMatches = allowed.hostname.startsWith('*.')
      ? actual.hostname.endsWith(allowed.hostname.slice(1))
      : actual.hostname === allowed.hostname;
    return actual.protocol === allowed.protocol && actual.port === allowed.port && hostMatches &&
      (allowed.pathname === '/' || actual.pathname.startsWith(allowed.pathname));
  });
}

test('Google Maps can load its API, static modules and vector requests', async () => {
  assert.ok(await permits('script-src', 'https://maps.googleapis.com/maps/api/js?loading=async'));
  assert.ok(await permits('script-src', 'https://maps.gstatic.com/maps-api-v3/api/js/63/1a/common.js'));
  assert.ok(await permits('connect-src', 'https://maps.gstatic.com/maps-api-v3/api/js/63/1a/common.js'));
  assert.ok(await permits('connect-src', 'https://mapsresources-pa.googleapis.com/$rpc/google.internal.maps.mapsresources.v1.MapsResourcesService/GetViewportInfo'));
});

test('Google Maps imagery supports satellite and Street View hosts without granting script access', async () => {
  for (const url of ['https://khm0.google.com/kh/v=1010?x=1&y=1&z=1', 'https://khms3.google.com/kh/v=1010', 'https://khmdb0.google.com/kh/v=1010', 'https://cbks0.google.com/cbk?output=tile']) {
    assert.ok(await permits('img-src', url), url);
    assert.ok(await permits('connect-src', url), url);
    assert.ok(!await permits('script-src', url), url);
  }
  assert.ok(await permits('img-src', 'https://lh3.ggpht.com/street-view-thumbnail'));
});

test('Google iframe fallback allows both the original URL and its actual redirected destination', async () => {
  assert.ok(await permits('frame-src', 'https://maps.google.com/maps?q=7.0084,100.4705&output=embed'));
  assert.ok(await permits('frame-src', 'https://www.google.com/maps/embed?origin=mfe&pb=location'));
});

test('admin and parcel maps allow Leaflet tiles and contact allows its OpenStreetMap iframe', async () => {
  for (const server of ['a', 'b', 'c']) {
    assert.ok(await permits('img-src', `https://${server}.tile.openstreetmap.org/11/1595/983.png`));
  }
  assert.ok(await permits('img-src', 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/11/983/1595'));
  assert.ok(await permits('frame-src', 'https://www.openstreetmap.org/export/embed.html?layer=mapnik'));
});

test('map sources do not permit unrelated hosts, insecure tiles or the retired Google login script', async () => {
  for (const directive of ['script-src', 'img-src', 'connect-src', 'frame-src']) {
    assert.ok(!await permits(directive, 'https://untrusted.invalid/map'));
    assert.ok(!await permits(directive, 'https://maps.gstatic.com.untrusted.invalid/map'));
  }
  assert.ok(!await permits('img-src', 'http://a.tile.openstreetmap.org/11/1595/983.png'));
  assert.ok(!await permits('script-src', 'https://server.arcgisonline.com/map.js'));
  assert.ok(!await permits('script-src', 'https://accounts.google.com/gsi/client'));
  assert.ok(!await permits('connect-src', 'https://accounts.google.com/gsi/status'));
});
