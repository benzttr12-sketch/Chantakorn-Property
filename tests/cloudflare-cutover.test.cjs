const test = require('node:test');
const assert = require('node:assert/strict');

const apiOrigin = 'https://catalog.example';
const sites = ['https://website.example', 'https://www.website.example'];
const media = '/v1/media/properties/4c17a746-ea69-4507-846c-4214ec097a46';
const listing = { id: 'listing-one', published: true, images: [media] };

function fixture({ page = { data: [listing], next_cursor: null }, detail = listing, imageHeaders = {}, inspect = () => {} } = {}) {
  const calls = [];
  const fetchImpl = async (value, init) => {
    const url = new URL(value);
    calls.push(url);
    assert.equal(url.origin, apiOrigin);
    assert.equal(init.method, 'GET');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store');
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(init.body, undefined);
    assert.ok(Object.keys(init.headers || {}).every(key => key === 'Origin'));
    inspect(url, init);
    const site = init.headers?.Origin;
    const headers = { 'Cache-Control': 'no-store', Vary: 'Origin',
      ...(sites.includes(site) ? { 'Access-Control-Allow-Origin': site } : {}) };
    if (url.pathname === '/health') return Response.json({ ok: true });
    if (url.pathname === '/v1/properties') return Response.json(page, { headers });
    if (url.pathname === '/v1/properties/listing-one') return Response.json({ data: detail }, { headers });
    if (url.pathname === media) return new Response(new Uint8Array([0xff, 0xd8, 0xff]), { headers: { ...headers, 'Cache-Control': 'private, no-store', 'Content-Type': 'image/jpeg', ...imageHeaders } });
    assert.fail('Unexpected endpoint');
  };
  return { calls, fetchImpl };
}

test('cutover verification checks both origins, published detail and R2 using only bounded anonymous reads', async () => {
  const { verifyCloudflare } = await import('../scripts/verify-cloudflare.mjs');
  const h = fixture();
  const report = await verifyCloudflare({ apiOrigin, siteOrigins: sites, requireListings: true, fetchImpl: h.fetchImpl });
  assert.equal(report.ok, true);
  assert.equal(report.detail, 'verified');
  assert.equal(report.media, 'verified');
  assert.equal(h.calls.length, 6);
  assert.ok(!JSON.stringify(report).includes(listing.id));
  assert.equal((await verifyCloudflare({ apiOrigin, siteOrigins: sites,
    fetchImpl: fixture({ imageHeaders: { 'Cache-Control': 'private, max-age=180' } }).fetchImpl })).ok, true);
});

test('empty catalogs explicitly leave image/detail unverified and can fail the cutover gate', async () => {
  const { verifyCloudflare } = await import('../scripts/verify-cloudflare.mjs');
  const h = fixture({ page: { data: [], next_cursor: null } });
  const report = await verifyCloudflare({ apiOrigin, siteOrigins: sites, fetchImpl: h.fetchImpl });
  assert.equal(report.detail, 'unverified-empty-catalog');
  assert.equal(h.calls.length, 4);
  await assert.rejects(verifyCloudflare({ apiOrigin, siteOrigins: sites, requireListings: true, fetchImpl: h.fetchImpl }), /Catalog is empty/);
});

test('cutover verification rejects unsafe origins and never fetches foreign or credential-bearing image URLs', async () => {
  const { verifyCloudflare } = await import('../scripts/verify-cloudflare.mjs');
  for (const value of ['http://catalog.example', 'https://user:pass@catalog.example', 'https://catalog.example/path']) {
    await assert.rejects(verifyCloudflare({ apiOrigin: value, fetchImpl: () => assert.fail('Unexpected fetch') }));
  }
  for (const image of ['https://foreign.example/image.jpg', `https://user:pass@catalog.example${media}`, `${media}?secret=anything`]) {
    const h = fixture({ detail: { ...listing, cover_image: image } });
    await assert.rejects(verifyCloudflare({ apiOrigin, siteOrigins: sites, fetchImpl: h.fetchImpl }), /canonical Worker R2 URL/);
    assert.equal(h.calls.length, 5);
  }
});

test('cutover verification fails for missing CORS, unpublished rows, invalid media and oversized streams', async () => {
  const { verifyCloudflare } = await import('../scripts/verify-cloudflare.mjs');
  const h = fixture();
  await assert.rejects(verifyCloudflare({ apiOrigin, siteOrigins: sites, fetchImpl: async (url, init) => {
    const response = await h.fetchImpl(url, init);
    response.headers.delete('Access-Control-Allow-Origin');
    return response;
  } }), /CORS/);
  for (const page of [{ data: [{ ...listing, published: false }], next_cursor: null }, { data: [listing] }]) {
    await assert.rejects(verifyCloudflare({ apiOrigin, siteOrigins: sites, fetchImpl: fixture({ page }).fetchImpl }));
  }
  await assert.rejects(verifyCloudflare({ apiOrigin, siteOrigins: sites,
    fetchImpl: fixture({ imageHeaders: { 'Content-Type': 'text/html' } }).fetchImpl }), /supported image/);
  for (const policy of ['public, max-age=180', 'private, max-age=3600', 'private, max-age=180, s-maxage=3600']) {
    await assert.rejects(verifyCloudflare({ apiOrigin, siteOrigins: sites,
      fetchImpl: fixture({ imageHeaders: { 'Cache-Control': policy } }).fetchImpl }), /three-minute/);
  }
  let cancelled = false;
  await assert.rejects(verifyCloudflare({ apiOrigin, siteOrigins: sites, fetchImpl: async () =>
    new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1)); }, cancel() { cancelled = true; } }))
  }), /byte limit/);
  assert.equal(cancelled, true);
  let cancelledHeaders = false;
  await assert.rejects(verifyCloudflare({ apiOrigin, siteOrigins: sites, fetchImpl: async url =>
    new URL(url).pathname === '/health' ? Response.json({ ok: true }) :
      new Response(new ReadableStream({ cancel() { cancelledHeaders = true; } }))
  }), /CORS/);
  assert.equal(cancelledHeaders, true);
});
