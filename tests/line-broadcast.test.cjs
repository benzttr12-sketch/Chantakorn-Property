const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { createHash } = require('node:crypto');

const propertyId = '813f2b90-36a7-488a-baf7-e7a79cd7c475';
const retryKey = '123e4567-e89b-42d3-a456-426614174000';
const acceptedRequestId = 'abcdef12-3456-4789-a123-456789abcdef';
const env = { LINE_CHANNEL_ACCESS_TOKEN: 'private-line-token', LINE_CHANNEL_SECRET: 'private-line-secret', NEXT_PUBLIC_SITE_URL: 'https://site.example/' };
const property = { published: true, title: 'ขายที่ดิน สิงหนคร', property_type: 'land', status: 'sale', price: 2500000, district: 'สิงหนคร', province: 'สงขลา', cover_image: 'https://images.example/ภาพจริง.jpg', internal_notes: 'private-owner-note', agent: { email: 'private-owner-email' } };

function documentResponse(values = property) {
  const fields = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'string') fields[key] = { stringValue: value };
    else if (typeof value === 'boolean') fields[key] = { booleanValue: value };
    else if (typeof value === 'number') fields[key] = { integerValue: String(value) };
    else if (Array.isArray(value)) fields[key] = { arrayValue: { values: value.map(image => ({ stringValue: image })) } };
    else fields[key] = { mapValue: { fields: {} } };
  }
  return Response.json({ fields });
}

function load({ staff = true, configuredEnv = env, getDocument = async () => documentResponse(), fetch = async () => { throw Error('Unexpected LINE request'); } } = {}) {
  function loadModule(file) {
    const module = { exports: {} };
    const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(source, {
      module, exports: module.exports, Request, Response, URL, Headers, AbortSignal, fetch, process: { env: configuredEnv },
      require(name) {
        if (name === '@/lib/api-response') return { jsonResponse: (body, init) => Response.json(body, init) };
        if (name === '@/lib/server-auth') return { requireStaff: async () => staff ? null : Response.json({ error: 'Unauthorized' }, { status: 401 }) };
        if (name === '@/lib/firestore-rest') return { getFirestoreDocument: getDocument };
        if (name === '@/lib/line-auth') return { OFFICIAL_LINE_BASIC_ID: '@930xzcyi' };
        if (name === '@/lib/line-property-broadcast') return loadModule('lib/line-property-broadcast.ts');
        if (name === '@/lib/line-property-image') return loadModule('lib/line-property-image.ts');
        if (name === '@/lib/format-code') return loadModule('lib/format-code.ts');
        if (name === 'node:crypto') return require(name);
        throw Error(`Unexpected dependency ${name}`);
      },
    });
    return module.exports;
  }
  return loadModule('app/api/line/broadcast/route.ts');
}

function previewRequest(id = propertyId) {
  return new Request(`https://api.example/api/line/broadcast?propertyId=${encodeURIComponent(id)}`, { headers: { Authorization: 'Bearer staff-session' } });
}
function sendRequest(body) {
  return new Request('https://api.example/api/line/broadcast', { method: 'POST', headers: { Authorization: 'Bearer staff-session' }, body: JSON.stringify(body) });
}
function botInfo(url, init) {
  assert.equal(url, 'https://api.line.me/v2/bot/info');
  assert.equal(init.method, 'GET');
  assert.equal(init.headers.Authorization, 'Bearer private-line-token');
  assert.equal(init.cache, 'no-store');
  assert.equal(init.redirect, 'error');
  assert.ok(init.signal instanceof AbortSignal);
  return Response.json({ basicId: '@930xzcyi', userId: 'private-bot-user-id', displayName: 'Private bot name' });
}
async function getRevision(options = {}) {
  const api = load({ fetch: botInfo, ...options });
  const response = await api.GET(previewRequest());
  assert.equal(response.status, 200);
  return (await response.json()).previewRevision;
}

test('anonymous preview and broadcast fail before reading properties or calling LINE', async () => {
  let calls = 0;
  const api = load({ staff: false, getDocument: async () => { calls += 1; }, fetch: async () => { calls += 1; } });
  for (const response of [await api.GET(previewRequest()), await api.POST(sendRequest({ propertyId, retryKey }))]) {
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store, private');
  }
  assert.equal(calls, 0);
});

test('preview reads the selected authoritative published document and reveals only card fields', async () => {
  let read;
  let lineReads = 0;
  const api = load({ getDocument: async (...args) => { read = args; return documentResponse({ ...property, id: 'incorrect-stored-id' }); },
    fetch: async (...args) => { lineReads += 1; return botInfo(...args); },
  });
  const response = await api.GET(previewRequest());
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.equal(api.dynamic, 'force-dynamic');
  assert.deepEqual(read, ['properties', propertyId, 'staff-session']);
  assert.equal(lineReads, 1);
  assert.equal(result.success, true);
  assert.equal(result.audience, 'all_followers');
  assert.equal(result.oa, '@930xzcyi');
  assert.equal(result.property.id, propertyId);
  assert.equal(result.property.title, property.title);
  assert.equal(result.property.price, property.price);
  assert.equal(result.property.type, 'land');
  assert.equal(result.property.status, 'sale');
  assert.equal(result.property.location, 'สิงหนคร · สงขลา');
  assert.equal(result.property.detailUrl, 'https://site.example/properties/CK-813F2B');
  assert.equal(result.property.imageUrl, 'https://images.example/%E0%B8%A0%E0%B8%B2%E0%B8%9E%E0%B8%88%E0%B8%A3%E0%B8%B4%E0%B8%87.jpg');
  assert.match(result.previewRevision, /^[0-9a-f]{64}$/);
  for (const privateValue of ['private-line-token', 'private-line-secret', 'private-owner-note', 'private-owner-email', 'private-bot-user-id', 'incorrect-stored-id']) {
    assert.equal(JSON.stringify(result).includes(privateValue), false);
  }
});

test('drafts, missing documents and storage failures cannot be previewed or sent', async () => {
  const revision = await getRevision();
  const cases = [
    [async () => documentResponse({ ...property, published: false }), 400, 'PROPERTY_NOT_PUBLISHED'],
    [async () => Response.json({}, { status: 404 }), 404, 'PROPERTY_NOT_FOUND'],
    [async () => Response.json({ error: 'private-storage-error' }, { status: 403 }), 503, 'PROPERTY_UNAVAILABLE'],
    [async () => { throw Error('private-storage-error'); }, 503, 'PROPERTY_UNAVAILABLE'],
  ];
  for (const [getDocument, status, code] of cases) {
    let lineCalls = 0;
    const api = load({ getDocument, fetch: async () => { lineCalls += 1; } });
    for (const response of [await api.GET(previewRequest()), await api.POST(sendRequest({ propertyId, retryKey, previewRevision: revision }))]) {
      const result = await response.json();
      assert.equal(response.status, status);
      assert.equal(result.code, code);
      assert.equal(result.deliveryStatus, 'rejected');
      assert.equal(result.retryable, false);
      assert.equal(JSON.stringify(result).includes('private-storage-error'), false);
    }
    assert.equal(lineCalls, 0);
  }
});

test('invalid property IDs, UUIDs and client payload fields are rejected before reads', async () => {
  let reads = 0;
  const api = load({ getDocument: async () => { reads += 1; }, fetch: async () => { reads += 1; } });
  const valid = { propertyId, retryKey, previewRevision: 'a'.repeat(64) };
  const cases = [
    { ...valid, propertyId: '../settings' },
    { ...valid, retryKey: 'not-a-uuid' },
    { ...valid, retryKey: '00000000-0000-0000-0000-000000000000' },
    { ...valid, previewRevision: undefined },
    { ...valid, messages: [{ type: 'text', text: 'Arbitrary announcement' }] },
    { ...valid, token: 'attacker-token' },
    { ...valid, recipients: ['attacker-recipient'] },
    { ...valid, title: 'Client-edited title' },
    [], null,
  ];
  for (const body of cases) assert.equal((await api.POST(sendRequest(body))).status, 400);
  assert.equal((await api.GET(previewRequest('a/b'))).status, 400);
  assert.equal(reads, 0);
});

test('missing token and a token for another OA prevent preview and send', async () => {
  const revision = await getRevision();
  for (const [configuredEnv, fetch, code] of [
    [{ ...env, LINE_CHANNEL_ACCESS_TOKEN: '' }, async () => { throw Error('Token should not be sent'); }, 'LINE_TOKEN_MISSING'],
    [env, async () => Response.json({ basicId: '@different-account', userId: 'private-other-bot' }), 'LINE_ACCOUNT_MISMATCH'],
    [env, async () => Response.json({ message: 'private-token-error' }, { status: 401 }), 'LINE_TOKEN_INVALID'],
  ]) {
    const api = load({ configuredEnv, fetch });
    for (const response of [await api.GET(previewRequest()), await api.POST(sendRequest({ propertyId, retryKey, previewRevision: revision }))]) {
      const result = await response.json();
      assert.equal(result.success, false);
      assert.equal(result.code, code);
      assert.equal(result.deliveryStatus, 'rejected');
      assert.equal(JSON.stringify(result).includes('private-other-bot'), false);
      assert.equal(JSON.stringify(result).includes('@different-account'), false);
    }
  }
});

test('published listing changes invalidate its preview before any LINE request', async () => {
  const revision = await getRevision();
  let lineCalls = 0;
  const api = load({ getDocument: async () => documentResponse({ ...property, price: 3500000 }), fetch: async () => { lineCalls += 1; } });
  const response = await api.POST(sendRequest({ propertyId, retryKey, previewRevision: revision }));
  const result = await response.json();
  assert.equal(response.status, 409);
  assert.equal(result.code, 'PROPERTY_CHANGED');
  assert.equal(result.deliveryStatus, 'rejected');
  assert.equal(result.retryable, false);
  assert.equal(lineCalls, 0);
});

test('same built message has a stable revision and irrelevant private changes do not affect it', async () => {
  const revision = await getRevision();
  assert.equal(await getRevision(), revision);
  assert.equal(await getRevision({ getDocument: async () => documentResponse({ ...property, internal_notes: 'other-private-note' }) }), revision);
});

test('broadcast sends one authoritative Flex to all LINE friends without owner or registry recipients', async () => {
  const revision = await getRevision();
  const calls = [];
  let sent;
  const api = load({ configuredEnv: { ...env, LINE_TARGET_USER_ID: 'private-owner-id', LINE_ADMIN_USER_IDS: 'private-admin-id' },
    getDocument: async (collection, id) => { assert.equal(collection, 'properties'); assert.equal(id, propertyId); return documentResponse(); },
    fetch: async (url, init) => {
      calls.push(url);
      if (url.endsWith('/info')) return botInfo(url, init);
      assert.equal(url, 'https://api.line.me/v2/bot/message/broadcast');
      assert.equal(init.method, 'POST');
      assert.equal(init.headers['X-Line-Retry-Key'], retryKey);
      assert.equal(init.headers.Authorization, 'Bearer private-line-token');
      assert.equal(init.cache, 'no-store');
      assert.equal(init.redirect, 'error');
      assert.ok(init.signal instanceof AbortSignal);
      sent = JSON.parse(init.body);
      return Response.json({}, { headers: { 'x-line-request-id': acceptedRequestId } });
    },
  });
  const response = await api.POST(sendRequest({ propertyId, retryKey, previewRevision: revision }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.success, true);
  assert.equal(result.deliveryStatus, 'accepted');
  assert.equal(result.requestId, acceptedRequestId);
  assert.equal(result.recipientCount, undefined);
  assert.equal(result.isRealSent, undefined);
  assert.deepEqual(Object.keys(sent), ['messages']);
  assert.equal(sent.messages.length, 1);
  const card = sent.messages[0];
  assert.equal(card.type, 'flex');
  assert.equal(card.contents.body.contents[1].text, property.title);
  assert.equal(card.contents.footer.contents[0].action.uri, 'https://site.example/properties/CK-813F2B');
  assert.equal(createHash('sha256').update(JSON.stringify(sent)).digest('hex'), revision);
  for (const privateValue of ['private-owner-id', 'private-admin-id', 'private-owner-note', 'private-owner-email', 'private-line-token']) {
    assert.equal(JSON.stringify(sent).includes(privateValue), false);
    assert.equal(JSON.stringify(result).includes(privateValue), false);
  }
  assert.deepEqual(calls, ['https://api.line.me/v2/bot/info', 'https://api.line.me/v2/bot/message/broadcast']);
});

test('embedded property cover uses the published image proxy and the authoritative document ID', async () => {
  const photo = 'data:image/jpeg;base64,AQID';
  const api = load({ getDocument: async () => documentResponse({ ...property, id: 'wrong-id', cover_image: photo, images: ['https://images.example/gallery.jpg'] }), fetch: botInfo });
  const result = await (await api.GET(previewRequest())).json();
  const version = createHash('sha256').update(photo).digest('hex').slice(0, 16);
  assert.equal(result.property.imageUrl, `https://api.example/api/line/property-image?id=${propertyId}&v=${version}`);
  assert.equal(JSON.stringify(result).includes(photo), false);
});

test('LINE deduplication is accepted only with a valid accepted-request-id', async () => {
  const revision = await getRevision();
  for (const [requestId, accepted] of [[acceptedRequestId, true], [null, false], ['private-token-from-header', false]]) {
    let bodyReads = 0;
    const api = load({ fetch: async (url, init) => {
      if (url.endsWith('/info')) return botInfo(url, init);
      return { ok: false, status: 409, headers: new Headers(requestId ? { 'x-line-accepted-request-id': requestId } : {}), json: async () => { bodyReads += 1; } };
    } });
    const response = await api.POST(sendRequest({ propertyId, retryKey, previewRevision: revision }));
    const result = await response.json();
    assert.equal(result.success, accepted);
    assert.equal(result.deliveryStatus, accepted ? 'accepted' : 'unknown');
    assert.equal(result.alreadyAccepted, accepted ? true : undefined);
    assert.equal(result.retryable, accepted ? undefined : true);
    assert.equal(bodyReads, 0);
    assert.equal(JSON.stringify(result).includes('private-token-from-header'), false);
  }
});

test('LINE rejections are classified and sanitized without reading provider error bodies', async () => {
  const revision = await getRevision();
  for (const [status, code, uncertain] of [
    [401, 'LINE_TOKEN_INVALID', false], [403, 'LINE_TOKEN_INVALID', false],
    [429, 'LINE_QUOTA_OR_RATE_LIMIT', false], [400, 'LINE_INVALID_MESSAGE', false],
    [500, 'LINE_DELIVERY_UNKNOWN', true], [503, 'LINE_DELIVERY_UNKNOWN', true],
  ]) {
    let bodyReads = 0;
    const api = load({ fetch: async (url, init) => {
      if (url.endsWith('/info')) return botInfo(url, init);
      return { ok: false, status, headers: new Headers({ 'x-line-request-id': 'private-invalid-request-id' }), json: async () => { bodyReads += 1; return { message: 'private-line-token private-customer-data' }; } };
    } });
    const result = await (await api.POST(sendRequest({ propertyId, retryKey, previewRevision: revision }))).json();
    assert.equal(result.success, false);
    assert.equal(result.code, code);
    assert.equal(result.deliveryStatus, uncertain ? 'unknown' : 'rejected');
    assert.equal(result.retryable, uncertain);
    assert.equal(bodyReads, 0);
    for (const value of ['private-line-token', 'private-customer-data', 'private-invalid-request-id']) assert.equal(JSON.stringify(result).includes(value), false);
  }
});

test('broadcast timeout is uncertain and retry preserves the same key and payload', async () => {
  const revision = await getRevision();
  const sends = [];
  const api = load({ fetch: async (url, init) => {
    if (url.endsWith('/info')) return botInfo(url, init);
    sends.push({ key: init.headers['X-Line-Retry-Key'], body: init.body });
    if (sends.length === 1) throw Object.assign(Error('private-network-details'), { name: 'TimeoutError' });
    return Response.json({}, { status: 409, headers: { 'x-line-accepted-request-id': acceptedRequestId } });
  } });
  const first = await (await api.POST(sendRequest({ propertyId, retryKey, previewRevision: revision }))).json();
  assert.equal(first.deliveryStatus, 'unknown');
  assert.equal(first.retryable, true);
  assert.equal(JSON.stringify(first).includes('private-network-details'), false);
  const retry = await (await api.POST(sendRequest({ propertyId, retryKey, previewRevision: revision }))).json();
  assert.equal(retry.deliveryStatus, 'accepted');
  assert.equal(retry.alreadyAccepted, true);
  assert.deepEqual(sends[0], sends[1]);
});

test('failed account preflight never attempts a broadcast and remains a rejected send', async () => {
  const revision = await getRevision();
  const calls = [];
  const api = load({ fetch: async url => { calls.push(url); throw Error('private-line-token'); } });
  const result = await (await api.POST(sendRequest({ propertyId, retryKey, previewRevision: revision }))).json();
  assert.equal(result.deliveryStatus, 'rejected');
  assert.equal(result.code, 'LINE_ACCOUNT_UNAVAILABLE');
  assert.deepEqual(calls, ['https://api.line.me/v2/bot/info']);
  assert.equal(JSON.stringify(result).includes('private-line-token'), false);
});

test('long Unicode text is bounded and cards omit unusable hero images', async () => {
  const api = load({ getDocument: async () => documentResponse({ ...property, title: '🏡'.repeat(500), cover_image: 'http://private.example/photo.jpg' }), fetch: botInfo });
  const preview = await (await api.GET(previewRequest())).json();
  assert.equal(preview.property.title.length, 180);
  assert.equal(preview.property.imageUrl, undefined);
  assert.equal(preview.property.title.endsWith('🏡'), true);
  let card;
  const sendApi = load({ getDocument: async () => documentResponse({ ...property, title: '🏡'.repeat(500), cover_image: 'http://private.example/photo.jpg' }),
    fetch: async (url, init) => { if (url.endsWith('/info')) return botInfo(url, init); card = JSON.parse(init.body).messages[0]; return Response.json({}); },
  });
  assert.equal((await sendApi.POST(sendRequest({ propertyId, retryKey, previewRevision: preview.previewRevision }))).status, 200);
  assert.ok(card.altText.length <= 400);
  assert.equal(card.contents.hero, undefined);
});

test('unsafe canonical site URLs fail without echoing credentials or reading storage', async () => {
  let reads = 0;
  const api = load({ configuredEnv: { ...env, NEXT_PUBLIC_SITE_URL: 'https://private-token:private-secret@site.example/' }, getDocument: async () => { reads += 1; } });
  const result = await (await api.GET(previewRequest())).json();
  assert.equal(result.code, 'SITE_URL_INVALID');
  assert.equal(reads, 0);
  assert.equal(JSON.stringify(result).includes('private-token'), false);
  assert.equal(JSON.stringify(result).includes('private-secret'), false);
});

test('missing site configuration uses the request origin, preserving a configured site base path', async () => {
  for (const [site, expected] of [[undefined, 'https://api.example/properties/CK-813F2B'], ['https://site.example/listings/', 'https://site.example/listings/properties/CK-813F2B']]) {
    const api = load({ configuredEnv: { ...env, NEXT_PUBLIC_SITE_URL: site }, fetch: botInfo });
    const result = await (await api.GET(previewRequest())).json();
    assert.equal(result.success, true);
    assert.equal(result.property.detailUrl, expected);
  }
});
