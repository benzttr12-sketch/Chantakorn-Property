const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

const origin = 'https://catalog.example';
const mediaId = '8adca02a-3479-47aa-a101-037434ff4bcb';
const property = (id = 'listing-one', extra = {}) => ({
  id, title: 'Published home', published: true, property_type: 'house', status: 'sale',
  price: 1250000, district: 'เมือง', province: 'สงขลา', features: ['garden'],
  cover_image: `/v1/media/properties/${mediaId}`, images: [`/v1/media/properties/${mediaId}`],
  ...extra,
});

function load({ env = {}, fetch = async () => { throw Error('Unexpected network request'); }, firestore = {} } = {}) {
  return loadTs({
    '@/lib/firestore-rest': {
      getFirestoreDocument: firestore.getFirestoreDocument || (async () => { throw Error('Unexpected Firestore document read'); }),
      listFirestoreDocuments: firestore.listFirestoreDocuments || (async () => { throw Error('Unexpected Firestore list'); }),
    },
  }, { fetch, process: { env: { NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN: origin, ...env } } })('lib/server-property-catalog.ts');
}

function assertPublicRequest(url, init) {
  assert.equal(new URL(url).origin, origin);
  assert.equal(init.method, 'GET');
  assert.equal(init.cache, 'no-store');
  assert.equal(init.credentials, 'omit');
  assert.equal(init.redirect, 'error');
  assert.ok(init.signal instanceof AbortSignal);
  assert.equal(init.headers, undefined);
  assert.equal(init.body, undefined);
}

test('explicit Firebase mode preserves staff reads and published query filtering', async () => {
  const reads = [];
  const document = Response.json({ fields: { published: { booleanValue: false } } });
  const api = load({ env: { NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND: ' firebase ' }, firestore: {
    getFirestoreDocument: async (...args) => { reads.push(args); return document; },
    listFirestoreDocuments: async (...args) => { reads.push(args); return [property(), property('draft', { published: false })]; },
  } });
  assert.equal(await api.getPublishedPropertyDocument('firebase-id', 'staff-id-token'), document);
  assert.deepEqual(reads[0], ['properties', 'firebase-id', 'staff-id-token']);
  assert.deepEqual((await api.listPublishedProperties(20)).map(row => row.id), ['listing-one']);
  assert.equal(reads[1][0], 'properties');
  assert.equal(reads[1][1], 20);
  assert.equal(reads[1][2].publishedOnly, true);
});

test('default Cloudflare mode reads only the configured public catalog and strips private fields', async () => {
  const api = load({ fetch: async (url, init) => {
    assertPublicRequest(url, init);
    assert.equal(new URL(url).pathname, '/v1/properties');
    assert.equal(new URL(url).searchParams.get('limit'), '20');
    return Response.json({ data: [
      property('visible', { internal_notes: 'private note', owner_phone: 'private number' }),
      property('draft', { published: false }), property('deleted', { deleted_at: '2026-10-27' }),
      property('deleted-camel', { deletedAt: '2026-10-27' }),
    ], next_cursor: null });
  } });
  const rows = await api.listPublishedProperties(20);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'visible');
  assert.equal(rows[0].cover_image, `${origin}/v1/media/properties/${mediaId}`);
  assert.deepEqual(Array.from(rows[0].images), [`${origin}/v1/media/properties/${mediaId}`]);
  assert.equal(JSON.stringify(rows).includes('private'), false);
});

test('Cloudflare detail adapts card fields without forwarding the Firebase staff token', async () => {
  const api = load({ fetch: async (url, init) => {
    assertPublicRequest(url, init);
    assert.equal(url, `${origin}/v1/properties/listing-one`);
    assert.equal(JSON.stringify(init).includes('private-staff-token'), false);
    return Response.json({ data: property('listing-one', {
      land_size: 10.5, agent: { name: 'Public agent', private_notes: 'secret' }, internal_notes: 'secret',
    }) });
  } });
  const response = await api.getPublishedPropertyDocument('listing-one', 'private-staff-token');
  const { fields } = await response.json();
  assert.equal(fields.published.booleanValue, true);
  assert.equal(fields.title.stringValue, 'Published home');
  assert.equal(fields.price.integerValue, '1250000');
  assert.equal(fields.land_size.doubleValue, 10.5);
  assert.equal(fields.features.arrayValue.values[0].stringValue, 'garden');
  assert.equal(fields.agent.mapValue.fields.name.stringValue, 'Public agent');
  assert.equal(fields.cover_image.stringValue, `${origin}/v1/media/properties/${mediaId}`);
  assert.equal(JSON.stringify(fields).includes('secret'), false);
});

test('Cloudflare missing, forbidden, draft and deleted details return no property', async () => {
  for (const getResponse of [
    () => Response.json({}, { status: 403 }), () => Response.json({}, { status: 404 }),
    () => Response.json({ data: property('listing-one', { published: false }) }),
    () => Response.json({ data: property('listing-one', { deleted_at: '2026-10-27' }) }),
  ]) {
    const api = load({ fetch: async () => getResponse() });
    const response = await api.getPublishedPropertyDocument('listing-one');
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {});
  }
});

test('Cloudflare IDs cannot escape the fixed public detail route', async () => {
  const api = load();
  for (const id of ['', '..', '../settings', 'https://attacker.example', 'a?b', 'a#b', 'a'.repeat(121)]) {
    assert.equal((await api.getPublishedPropertyDocument(id, 'staff-token')).status, 404);
  }
});

test('missing or unsafe configured API origins fail before any request', async () => {
  for (const value of ['', 'http://catalog.example', 'https://user:password@catalog.example',
    'https://catalog.example/path', 'https://catalog.example?token=secret', 'https://catalog.example#fragment',
    '//catalog.example', 'not a URL']) {
    const api = load({ env: { NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN: value } });
    await assert.rejects(api.listPublishedProperties(20));
    await assert.rejects(api.getPublishedPropertyDocument('listing-one'));
  }
});

test('unknown backend and invalid list bounds fail without reading either database', async () => {
  const invalidBackend = load({ env: { NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND: 'typo' } });
  await assert.rejects(invalidBackend.listPublishedProperties(20), /Invalid property backend/);
  await assert.rejects(invalidBackend.getPublishedPropertyDocument('listing-one'), /Invalid property backend/);
  const api = load();
  for (const limit of [0, -1, 201, 1.5, NaN, '20']) {
    await assert.rejects(api.listPublishedProperties(limit), /Invalid property catalog limit/);
  }
});

test('Cloudflare pagination shares one deadline and returns at most the requested published slice', async () => {
  const requests = [];
  const api = load({ fetch: async (url, init) => {
    assertPublicRequest(url, init);
    const page = requests.length;
    requests.push({ url: new URL(url), signal: init.signal });
    return Response.json({ data: Array.from({ length: 30 }, (_, index) => property(`listing-${page * 30 + index}`)), next_cursor: `cursor-${page}` });
  } });
  const rows = await api.listPublishedProperties(200);
  assert.equal(rows.length, 200);
  assert.equal(rows[199].id, 'listing-199');
  assert.equal(requests.length, 7);
  for (const [index, request] of requests.entries()) {
    assert.equal(request.signal, requests[0].signal);
    assert.equal(request.url.searchParams.get('limit'), '30');
    assert.equal(request.url.searchParams.get('cursor'), index === 0 ? null : `cursor-${index - 1}`);
  }
});

test('malformed catalog pages cannot be treated as an empty successful catalog', async () => {
  for (const body of [null, [], {}, { data: [], next_cursor: undefined },
    { data: {}, next_cursor: null }, { data: [null], next_cursor: null },
    { data: [property('', {})], next_cursor: null }, { data: [property('x'.repeat(121))], next_cursor: null },
    { data: [], next_cursor: '' }, { data: [], next_cursor: 1 }, { data: [], next_cursor: 'x'.repeat(513) },
    { data: Array.from({ length: 21 }, () => property()), next_cursor: null }]) {
    await assert.rejects(load({ fetch: async () => Response.json(body) }).listPublishedProperties(20));
  }
});

test('cyclic cursors and page overruns fail within the bounded request count', async () => {
  let cyclicRequests = 0;
  await assert.rejects(load({ fetch: async () => { cyclicRequests += 1; return Response.json({ data: [property()], next_cursor: 'repeat' }); } }).listPublishedProperties(200), /Repeated property catalog cursor/);
  assert.equal(cyclicRequests, 2);
  let sparseRequests = 0;
  await assert.rejects(load({ fetch: async () => {
    sparseRequests += 1;
    return Response.json({ data: [property()], next_cursor: `cursor-${sparseRequests}` });
  } }).listPublishedProperties(200), /bounded page count/);
  assert.equal(sparseRequests, 7);
});

test('non-success and redirect responses are rejected and their bodies are cancelled', async () => {
  for (const status of [301, 302, 400, 401, 500]) {
    let cancelled = false;
    const api = load({ fetch: async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status }) });
    await assert.rejects(api.listPublishedProperties(20), /catalog unavailable/);
    assert.equal(cancelled, true);
  }
});

test('declared and streamed oversize bodies are cancelled before JSON parsing', async () => {
  for (const declared of ['2097153', '-1', 'invalid']) {
    let cancelled = false;
    const api = load({ fetch: async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'Content-Length': declared } }) });
    await assert.rejects(api.listPublishedProperties(20), /response too large/);
    assert.equal(cancelled, true);
  }
  let cancelled = false;
  const api = load({ fetch: async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(2097153)); },
    cancel() { cancelled = true; },
  })) });
  await assert.rejects(api.listPublishedProperties(20), /response too large/);
  assert.equal(cancelled, true);
});

test('invalid JSON, UTF-8 and timeout failures remain visible to the route', async () => {
  for (const body of ['{invalid', new Uint8Array([0xc0, 0xaf])]) {
    await assert.rejects(load({ fetch: async () => new Response(body) }).listPublishedProperties(20));
  }
  const api = load({ fetch: async () => { throw Object.assign(Error('deadline'), { name: 'TimeoutError' }); } });
  await assert.rejects(api.listPublishedProperties(20), { name: 'TimeoutError' });
  await assert.rejects(api.getPublishedPropertyDocument('listing-one'), { name: 'TimeoutError' });
});
