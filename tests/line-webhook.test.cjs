const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash, createHmac, webcrypto } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const sharp = require('sharp');

function load(file, { env = {}, fetch = async () => { throw Error('Unexpected request'); }, firestore = {}, requireStaff = async () => null, log = () => {} } = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = vm.createContext({
    module, exports: module.exports, Request, Response, URL, URLSearchParams, Headers, AbortSignal, Buffer,
    TextEncoder, crypto: webcrypto, btoa: text => Buffer.from(text, 'binary').toString('base64'),
    fetch, process: { env }, console: Object.fromEntries(['log', 'info', 'warn', 'error'].map(level => [level, (...args) => log(level, ...args)])),
    require(name) {
      if (name === '@/lib/api-response') return { jsonResponse: (body, init) => Response.json(body, init) };
      if (name === '@/lib/server-auth') return { requireStaff };
      if (name === '@/lib/line-property-image') return load('lib/line-property-image.ts');
      if (name === '@/lib/format-code') return load('lib/format-code.ts');
      if (name === '@/app/api/line/property-image/route') return load('app/api/line/property-image/route.ts', { env, fetch, firestore, requireStaff });
      if (name === 'sharp') return { default: sharp };
      if (name === 'node:buffer') return require(name);
      if (name === 'node:crypto') return require(name);
      if (name === '@/lib/firestore-rest') return {
        createFirestoreDocument: firestore.createFirestoreDocument || (async () => ({ ok: true })),
        patchFirestoreDocument: firestore.patchFirestoreDocument || (async () => ({ ok: true })),
        listFirestoreDocuments: firestore.listFirestoreDocuments || (async () => []),
        getFirestoreDocument: firestore.getFirestoreDocument || (async () => { throw Error('Unexpected document read'); }),
      };
      if (name === '../../firebase-applet-config.json') return { default: { projectId: 'test-project', firestoreDatabaseId: '(default)', apiKey: 'test-key' } };
      throw Error(name);
    },
  });
  vm.runInContext(source, context);
  return module.exports;
}

function signedRequest(text, secret = 'test-secret', url = 'https://example.com/api/line/webhook') {
  const body = JSON.stringify({ events: [{ type: 'message', replyToken: 'real-reply-token', source: { userId: 'Utest' }, message: { type: 'text', text } }] });
  const signature = createHmac('sha256', secret).update(body).digest('base64');
  return new Request(url, { method: 'POST', headers: { 'x-line-signature': signature }, body });
}

function propertyDocument(property) {
  const fields = {};
  for (const [key, value] of Object.entries(property)) {
    if (typeof value === 'boolean') fields[key] = { booleanValue: value };
    else if (typeof value === 'string') fields[key] = { stringValue: value };
    else if (Array.isArray(value)) fields[key] = { arrayValue: { values: value.map(image => ({ stringValue: image })) } };
  }
  return Response.json({ fields });
}

async function propertyReply(properties) {
  let sent;
  const api = load('app/api/line/webhook/route.ts', {
    env: { LINE_CHANNEL_SECRET: 'test-secret', LINE_CHANNEL_ACCESS_TOKEN: 'test-token', NEXT_PUBLIC_SITE_URL: 'https://site.example.com/property-site/' },
    firestore: { listFirestoreDocuments: async () => properties },
    fetch: async (url, init) => {
      assert.equal(url, 'https://api.line.me/v2/bot/message/reply');
      sent = JSON.parse(init.body);
      return Response.json({});
    },
  });
  const response = await api.POST(signedRequest('ดูทรัพย์', 'test-secret', 'https://api.example.com/api/line/webhook'));
  assert.equal((await response.json()).success, true);
  return sent;
}

test('webhook reports missing LINE credentials instead of readiness', async () => {
  const api = load('app/api/line/webhook/route.ts');
  const response = await api.GET(new Request('https://example.com/api/line/webhook'));
  const result = await response.json();
  assert.equal(result.status, 'configuration_required');
  assert.equal(result.isChannelAccessTokenConfigured, false);
  assert.equal(result.isChannelSecretConfigured, false);
});

test('diagnostics expose source revision and presence checks without revealing credentials', async () => {
  const api = load('app/api/line/webhook/route.ts', {
    env: { LINE_CHANNEL_ACCESS_TOKEN: 'private-token', LINE_CHANNEL_SECRET: 'private-secret', APP_BUILD_SHA: 'abc123' },
  });
  const response = await api.GET(new Request('https://api.example.com/api/line/webhook'));
  const result = await response.json();
  assert.equal(result.status, 'configured');
  assert.equal(result.buildRevision, 'abc123');
  assert.equal(result.credentialValidation, 'presence_only');
  assert.equal(result.webhookEndpoint, 'https://api.example.com/api/line/webhook');
  assert.equal(JSON.stringify(result).includes('private-token'), false);
  assert.equal(JSON.stringify(result).includes('private-secret'), false);
});

test('LINE verification accepts signed empty events without calling LINE or writing inquiries', async () => {
  const api = load('app/api/line/webhook/route.ts', {
    env: { LINE_CHANNEL_SECRET: 'test-secret' },
    firestore: { createFirestoreDocument: async () => { throw Error('Unexpected write'); } },
  });
  const body = JSON.stringify({ destination: 'Ubot', events: [] });
  const signature = createHmac('sha256', 'test-secret').update(body).digest('base64');
  const response = await api.POST(new Request('https://example.com/api/line/webhook', {
    method: 'POST', headers: { 'x-line-signature': signature }, body,
  }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.success, true);
  assert.equal(result.processedEvents, 0);
  assert.equal(result.successfulReplies, 0);
});

test('invalid webhook signatures are rejected before writing customer data', async () => {
  let writes = 0;
  const api = load('app/api/line/webhook/route.ts', {
    env: { LINE_CHANNEL_SECRET: 'actual-secret' },
    firestore: { createFirestoreDocument: async () => { writes += 1; return { ok: true }; } },
  });
  const response = await api.POST(signedRequest('ดูทรัพย์', 'wrong-secret'));
  assert.equal(response.status, 401);
  assert.equal(writes, 0);
});

test('staff simulation neither writes customer records nor sends real replies', async () => {
  let writes = 0;
  let sends = 0;
  const api = load('app/api/line/webhook/route.ts', {
    env: { LINE_CHANNEL_ACCESS_TOKEN: 'test-token' },
    fetch: async () => { sends += 1; return Response.json({}); },
    firestore: {
      createFirestoreDocument: async () => { writes += 1; return { ok: true }; },
      listFirestoreDocuments: async () => [{ published: true, title: 'Public home', slug: 'home' }],
    },
  });
  const response = await api.POST(new Request('https://example.com/api/line/webhook', {
    method: 'POST', headers: { 'x-line-simulation': 'true' },
    body: JSON.stringify({ events: [
      { type: 'follow', replyToken: 'test_follow', source: { userId: 'Utest' } },
      { type: 'message', replyToken: 'test_message', source: { userId: 'Utest' }, message: { type: 'text', text: 'ดูทรัพย์' } },
    ] }),
  }));
  const result = await response.json();
  assert.equal(result.simulation, true);
  assert.equal(result.simulatedReplies, 2);
  assert.equal(result.successfulReplies, 0);
  assert.equal(writes, 0);
  assert.equal(sends, 0);
});

test('anonymous callers cannot bypass signatures with the simulation header', async () => {
  const api = load('app/api/line/webhook/route.ts', {
    requireStaff: async () => Response.json({ error: 'Unauthorized' }, { status: 401 }),
    firestore: { createFirestoreDocument: async () => { throw Error('Unexpected write'); } },
  });
  const response = await api.POST(new Request('https://example.com/api/line/webhook', {
    method: 'POST', headers: { 'x-line-simulation': 'true' }, body: JSON.stringify({ events: [] }),
  }));
  assert.equal(response.status, 401);
});

test('webhook does not claim to have replied when the LINE token is missing', async () => {
  const api = load('app/api/line/webhook/route.ts', {
    env: { LINE_CHANNEL_SECRET: 'test-secret' },
    firestore: { listFirestoreDocuments: async () => [{ title: 'Public home', published: true, slug: 'public-home' }] },
  });
  const response = await api.POST(signedRequest('ดูทรัพย์'));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.success, false);
  assert.equal(result.failedReplies, 1);
});

test('LINE property carousel contains only published homes with static-site links', async () => {
  let sent;
  let queryOptions;
  const api = load('app/api/line/webhook/route.ts', {
    env: { LINE_CHANNEL_SECRET: 'test-secret', LINE_CHANNEL_ACCESS_TOKEN: 'test-token', NEXT_PUBLIC_SITE_URL: 'https://example.com/site/' },
    firestore: { listFirestoreDocuments: async (_collection, _limit, options) => {
      queryOptions = options;
      return [
        { id: 'home one', title: 'Public home', published: true, slug: 'home one', status: 'sale', price: 1000000 },
        { title: 'Private draft', published: false, slug: 'draft', status: 'sale', price: 2000000 },
      ];
    } },
    fetch: async (url, init) => {
      sent = { url, body: JSON.parse(init.body) };
      return Response.json({});
    },
  });
  const response = await api.POST(signedRequest('ดูทรัพย์'));
  const result = await response.json();
  assert.equal(result.success, true);
  assert.equal(result.failedReplies, 0);
  assert.equal(queryOptions.publishedOnly, true);
  assert.equal(sent.url, 'https://api.line.me/v2/bot/message/reply');
  const bubbles = sent.body.messages[0].contents.contents;
  assert.equal(bubbles.length, 1);
  assert.equal(bubbles[0].body.contents[1].text, 'Public home');
  assert.equal(bubbles[0].footer.contents[0].action.uri, 'https://example.com/site/properties/CK-HOME%20ONE');
});

async function customerReply(text, properties, options = {}) {
  const sent = [];
  const api = load('app/api/line/webhook/route.ts', {
    env: { LINE_CHANNEL_SECRET: 'test-secret', LINE_CHANNEL_ACCESS_TOKEN: 'test-token', NEXT_PUBLIC_SITE_URL: 'https://site.example.com' },
    firestore: { listFirestoreDocuments: async () => properties, ...options.firestore },
    fetch: async (_url, init) => { sent.push(JSON.parse(init.body)); return Response.json({}); },
    ...options,
  });
  const response = await api.POST(signedRequest(text));
  return { sent, response, result: await response.json() };
}

const searchableProperties = [
  { id: '813f2b90-36a7-488a-baf7-e7a79cd7c475', title: 'ที่ดินสิงหนคร', published: true, property_type: 'land', status: 'sale', district: 'สิงหนคร', province: 'สงขลา' },
  { id: 'house-one', title: 'บ้านขายหาดใหญ่', published: true, property_type: 'house', status: 'sale', district: 'หาดใหญ่', province: 'สงขลา' },
  { id: 'house-two', title: 'บ้านเช่าหาดใหญ่', published: true, property_type: 'house', status: 'rent', district: 'หาดใหญ่', province: 'สงขลา' },
  { id: 'land-three', title: 'ที่ดินขายหาดใหญ่', published: true, property_type: 'land', status: 'sale', district: 'หาดใหญ่', province: 'สงขลา' },
];

test('Thai buyer phrases search by type, sale status and location instead of opening the seller form', async () => {
  for (const [phrase, expectedTitle] of [
    ['มีขายที่ดิน สิงหนครไหมครับ', 'ที่ดินสิงหนคร'],
    ['ขอดูบ้านขายแถวหาดใหญ่หน่อยครับ', 'บ้านขายหาดใหญ่'],
    ['อยากซื้อบ้าน ในหาดใหญ่', 'บ้านขายหาดใหญ่'],
    ['หาบ้านเช่าหาดใหญ่ค่ะ', 'บ้านเช่าหาดใหญ่'],
  ]) {
    const { sent, result } = await customerReply(phrase, searchableProperties);
    assert.equal(result.successfulReplies, 1);
    const bubbles = sent[0].messages[0].contents.contents;
    assert.equal(bubbles.length, 1, phrase);
    assert.equal(bubbles[0].body.contents[1].text, expectedTitle, phrase);
  }
});

test('explicit seller requests and website consignment markers still open the seller flow', async () => {
  for (const phrase of ['ต้องการขายที่ดิน สิงหนคร', 'อยากขายบ้าน', 'ฝากขายบ้าน', '[CP-WEB-FORM:813f2b90-36a7-488a-baf7-e7a79cd7c475] ข้อมูลผู้ติดต่อ']) {
    let reads = 0;
    let writes = 0;
    const { sent } = await customerReply(phrase, searchableProperties, { firestore: {
      listFirestoreDocuments: async () => { reads += 1; return searchableProperties; },
      createFirestoreDocument: async () => { writes += 1; return { ok: true }; },
    } });
    assert.equal(reads, 0, phrase);
    assert.equal(writes, phrase.startsWith('[CP-WEB-FORM:') ? 0 : 1, phrase);
    assert.equal(sent[0].messages[0].contents.body.contents.at(-1).action.uri, 'https://site.example.com/sell');
  }
});

test('property codes find a specific listing and general listing commands return published results', async () => {
  const { sent } = await customerReply('ขอดูรหัสทรัพย์ CK-813F2B', searchableProperties);
  assert.equal(sent[0].messages[0].contents.contents.length, 1);
  assert.equal(sent[0].messages[0].contents.contents[0].body.contents[1].text, 'ที่ดินสิงหนคร');
  for (const phrase of ['ดูทรัพย์', 'ค้นหาทรัพย์', 'รายการทรัพย์', 'ทั้งหมด']) {
    const reply = await customerReply(phrase, searchableProperties);
    assert.equal(reply.sent[0].messages[0].contents.contents.length, 4, phrase);
  }
});

test('unmatched locations or property codes never return unrelated homes', async () => {
  for (const phrase of ['บ้านขายเชียงใหม่', 'ที่ดิน ตรัง', 'CK-999999']) {
    const { sent, result } = await customerReply(phrase, searchableProperties);
    assert.equal(result.successfulReplies, 1);
    assert.equal(sent[0].messages.length, 1);
    assert.equal(sent[0].messages[0].type, 'text');
    assert.match(sent[0].messages[0].text, /ยังไม่พบทรัพย์ที่ตรงกับคำค้น/);
    assert.match(sent[0].messages[0].text, /https:\/\/site\.example\.com\/properties/);
  }
});

test('a place beginning with บ้าน stays a location and Thai place names are not shortened by filler removal', async () => {
  const properties = [
    { id: 'banpru-land', title: 'ที่ดินใกล้สวน', published: true, property_type: 'land', status: 'sale', district: 'หาดใหญ่', subdistrict: 'บ้านพรุ' },
    { id: 'hatyai-house', title: 'บ้านใจกลางเมือง', published: true, property_type: 'house', status: 'sale', district: 'หาดใหญ่', subdistrict: 'คอหงส์' },
    { id: 'similar-word', title: 'โครงการดใหญ่', published: true, property_type: 'house', status: 'sale', district: 'สะเดา' },
  ];
  const land = await customerReply('ขอดูที่ดิน บ้านพรุ', properties);
  assert.equal(land.sent[0].messages[0].contents.contents.length, 1);
  assert.equal(land.sent[0].messages[0].contents.contents[0].body.contents[1].text, 'ที่ดินใกล้สวน');
  const house = await customerReply('บ้านขาย หาดใหญ่', properties);
  assert.equal(house.sent[0].messages[0].contents.contents.length, 1);
  assert.equal(house.sent[0].messages[0].contents.contents[0].body.contents[1].text, 'บ้านใจกลางเมือง');
});

test('a long customer query cannot overflow Flex alternative text or split an emoji', async () => {
  const { sent, result } = await customerReply(`CK-813F2B ${'🙂'.repeat(2400)}`, searchableProperties);
  assert.equal(result.successfulReplies, 1);
  const message = sent[0].messages[0];
  assert.ok(message.altText.length <= 400);
  assert.equal(message.altText.includes('\uFFFD'), false);
  assert.equal(message.contents.contents.length, 1);
});

test('unavailable property storage and an empty published catalog produce different honest replies', async () => {
  const empty = await customerReply('ดูทรัพย์', []);
  assert.match(empty.sent[0].messages[0].text, /ยังไม่มีรายการทรัพย์ที่เผยแพร่/);
  const unavailable = await customerReply('ดูทรัพย์', [], { firestore: {
    listFirestoreDocuments: async () => { throw Error('private storage details'); },
    createFirestoreDocument: async () => ({ ok: true }),
  } });
  assert.match(unavailable.sent[0].messages[0].text, /ขัดข้องชั่วคราว/);
  assert.match(unavailable.sent[0].messages[0].text, /https:\/\/site\.example\.com\/properties/);
  assert.equal(unavailable.result.unavailableSearches, 1);
  assert.deepEqual(unavailable.result.errorCodes, ['PROPERTY_STORAGE_UNAVAILABLE']);
  assert.equal(JSON.stringify(unavailable.sent).includes('ได้รับข้อความ'), false);
  assert.equal(JSON.stringify(unavailable.result).includes('private storage details'), false);
});

test('every reply in a batch precedes potentially slow inquiry writes', async () => {
  const order = [];
  const api = load('app/api/line/webhook/route.ts', {
    env: { LINE_CHANNEL_SECRET: 'test-secret', LINE_CHANNEL_ACCESS_TOKEN: 'test-token' },
    firestore: {
      listFirestoreDocuments: async () => searchableProperties,
      createFirestoreDocument: async () => { order.push('write'); assert.deepEqual(order.slice(0, 2), ['reply', 'reply']); return { ok: true }; },
    },
    fetch: async (_url, init) => { assert.ok(init.signal instanceof AbortSignal); order.push('reply'); return Response.json({}); },
  });
  const body = JSON.stringify({ events: [
    { type: 'follow', replyToken: 'follow-reply', source: { userId: 'Uone' } },
    { type: 'message', replyToken: 'message-reply', source: { userId: 'Utwo' }, message: { type: 'text', text: 'ดูทรัพย์' } },
  ] });
  const signature = createHmac('sha256', 'test-secret').update(body).digest('base64');
  const response = await api.POST(new Request('https://example.com/api/line/webhook', { method: 'POST', headers: { 'x-line-signature': signature }, body }));
  assert.equal((await response.json()).successfulReplies, 2);
  assert.deepEqual(order, ['reply', 'reply', 'write', 'write']);
});

test('reply rejection diagnostics classify LINE failures without logging credentials or customer data', async () => {
  for (const [status, message, expectedCode] of [
    [401, 'private-token private-secret private-customer-text real-reply-token', 'LINE_TOKEN_REJECTED'],
    [400, 'Invalid reply token real-reply-token', 'LINE_REPLY_TOKEN_EXPIRED'],
    [400, 'A message (private-customer-text) is invalid', 'LINE_MESSAGE_INVALID'],
    [429, 'Rate limit exceeded', 'LINE_RATE_LIMITED'],
    [503, 'Service unavailable', 'LINE_REPLY_UNAVAILABLE'],
  ]) {
    const logs = [];
    const api = load('app/api/line/webhook/route.ts', {
      env: { LINE_CHANNEL_SECRET: 'private-secret', LINE_CHANNEL_ACCESS_TOKEN: 'private-token' },
      firestore: { listFirestoreDocuments: async () => searchableProperties },
      fetch: async () => Response.json({ message }, { status }),
      log: (...args) => logs.push(args),
    });
    const response = await api.POST(signedRequest('private-customer-text', 'private-secret'));
    const result = await response.json();
    assert.equal(result.failedReplies, 1);
    assert.deepEqual(result.errorCodes, [expectedCode]);
    for (const sensitive of ['private-token', 'private-secret', 'private-customer-text', 'real-reply-token']) {
      assert.equal(JSON.stringify({ logs, result }).includes(sensitive), false, sensitive);
    }
  }
});

test('follower registration runs after replies, deduplicates customers and reports storage failure safely', async () => {
  const order = [];
  const customerId = `U${'a'.repeat(32)}`;
  const api = load('app/api/line/webhook/route.ts', {
    env: { LINE_CHANNEL_SECRET: 'test-secret', LINE_CHANNEL_ACCESS_TOKEN: 'test-token' },
    firestore: {
      listFirestoreDocuments: async () => searchableProperties,
      createFirestoreDocument: async () => ({ ok: true }),
      patchFirestoreDocument: async (collection, id, fields) => {
        order.push('follower');
        assert.deepEqual(order, ['reply', 'reply', 'follower']);
        assert.equal(collection, 'line_followers');
        assert.equal(id, customerId);
        assert.equal(fields.user_id, customerId);
        assert.equal(fields.is_active, true);
        throw Error(`Private storage error ${customerId}`);
      },
    },
    fetch: async () => { order.push('reply'); return Response.json({}); },
  });
  const body = JSON.stringify({ events: [
    { type: 'follow', replyToken: 'follow-reply', source: { userId: customerId } },
    { type: 'message', replyToken: 'message-reply', source: { userId: customerId }, message: { type: 'text', text: 'ดูทรัพย์' } },
  ] });
  const signature = createHmac('sha256', 'test-secret').update(body).digest('base64');
  const response = await api.POST(new Request('https://example.com/api/line/webhook', {
    method: 'POST', headers: { 'x-line-signature': signature }, body,
  }));
  const result = await response.json();
  assert.equal(result.successfulReplies, 2);
  assert.equal(result.failedReplies, 0);
  assert.equal(result.failedFollowerWrites, 1);
  assert.deepEqual(result.errorCodes, ['FOLLOWER_STORAGE_UNAVAILABLE']);
  assert.equal(JSON.stringify(result).includes(customerId), false);
});

test('staff simulation never registers real-looking follower IDs', async () => {
  const api = load('app/api/line/webhook/route.ts', {
    firestore: { patchFirestoreDocument: async () => { throw Error('Unexpected follower write'); } },
  });
  const response = await api.POST(new Request('https://example.com/api/line/webhook', {
    method: 'POST', headers: { 'x-line-simulation': 'true' },
    body: JSON.stringify({ events: [{ type: 'follow', replyToken: 'test_follow', source: { userId: `U${'a'.repeat(32)}` } }] }),
  }));
  const result = await response.json();
  assert.equal(result.simulatedReplies, 1);
  assert.equal(result.failedFollowerWrites, 0);
});

test('reply timeouts have a stable code and failed inbox writes remain visible after a successful reply', async () => {
  const timedOut = await customerReply('ดูทรัพย์', searchableProperties, { fetch: async () => { throw Object.assign(Error('private details'), { name: 'TimeoutError' }); } });
  assert.deepEqual(timedOut.result.errorCodes, ['LINE_REPLY_TIMEOUT']);
  const inboxFailure = await customerReply('ดูทรัพย์', searchableProperties, { firestore: {
    listFirestoreDocuments: async () => searchableProperties,
    createFirestoreDocument: async () => ({ ok: false, status: 403 }),
  } });
  assert.equal(inboxFailure.result.successfulReplies, 1);
  assert.equal(inboxFailure.result.failedInquiryWrites, 1);
  assert.deepEqual(inboxFailure.result.errorCodes, ['INQUIRY_STORAGE_UNAVAILABLE']);
});

test('malformed signed event payloads are rejected before writes or reply calls', async () => {
  for (const payload of [null, { events: {} }, { events: [null] }, { events: [{ type: 'message', message: { type: 'text', text: 123 } }] }]) {
    const api = load('app/api/line/webhook/route.ts', {
      env: { LINE_CHANNEL_SECRET: 'test-secret' },
      firestore: { createFirestoreDocument: async () => { throw Error('Unexpected write'); } },
    });
    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', 'test-secret').update(body).digest('base64');
    const response = await api.POST(new Request('https://example.com/api/line/webhook', { method: 'POST', headers: { 'x-line-signature': signature }, body }));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'LINE_EVENT_PAYLOAD_INVALID');
  }
});

test('LINE property carousel preserves the selected HTTPS cover instead of another gallery photo', async () => {
  const sent = await propertyReply([{
    id: 'home-one', title: 'Public home', published: true, slug: 'home-one',
    cover_image: ' https://photos.example.com/selected-cover.jpg ',
    images: ['https://photos.example.com/another-photo.jpg'],
  }]);
  const bubble = sent.messages[0].contents.contents[0];
  assert.equal(bubble.hero.url, 'https://photos.example.com/selected-cover.jpg');
});

test('uploaded cover uses the webhook host image endpoint while details use the public website', async () => {
  const uploadedCover = 'data:image/webp;base64,UklGRg==';
  const sent = await propertyReply([{
    id: 'home one', title: 'Uploaded home', published: true, slug: 'home one',
    cover_image: uploadedCover, images: ['https://photos.example.com/other-photo.jpg'],
  }]);
  const bubble = sent.messages[0].contents.contents[0];
  const imageVersion = createHash('sha256').update(uploadedCover).digest('hex').slice(0, 16);
  assert.equal(bubble.hero.url, `https://api.example.com/api/line/property-image?id=home%20one&v=${imageVersion}`);
  assert.equal(bubble.footer.contents[0].action.uri, 'https://site.example.com/property-site/properties/CK-HOME%20ONE');
  assert.equal(JSON.stringify(sent).includes(uploadedCover), false);
  assert.equal(JSON.stringify(sent).includes('data:image'), false);
});

test('changing an uploaded property cover changes its LINE image URL while identical photos remain stable', async () => {
  const makePhoto = async (background) => `data:image/webp;base64,${(await sharp({ create: { width: 32, height: 24, channels: 3, background } }).webp().toBuffer()).toString('base64')}`;
  const originalPhoto = await makePhoto({ r: 240, g: 20, b: 30 });
  const changedPhoto = await makePhoto({ r: 40, g: 140, b: 90 });
  const sent = await propertyReply([originalPhoto, changedPhoto, originalPhoto].map((cover_image, index) => ({
    id: 'same-property', title: `Photo ${index}`, published: true, slug: 'same-property', cover_image, images: [],
  })));
  const imageUrls = sent.messages[0].contents.contents.map(bubble => bubble.hero.url);
  assert.notEqual(imageUrls[0], imageUrls[1]);
  assert.equal(imageUrls[0], imageUrls[2]);
  for (const imageUrl of imageUrls) {
    assert.match(imageUrl, /^https:\/\/api\.example\.com\/api\/line\/property-image\?id=same-property&v=[0-9a-f]{16}$/);
  }
});

test('property carousel falls back to the first usable uploaded gallery image', async () => {
  const sent = await propertyReply([{
    id: 'gallery-home', title: 'Gallery home', published: true, slug: 'gallery-home',
    cover_image: 'blob:local-preview',
    images: ['javascript:alert(1)', ' https://photos.example.com/actual-gallery.png ', 'https://photos.example.com/later.jpg'],
  }]);
  assert.equal(sent.messages[0].contents.contents[0].hero.url, 'https://photos.example.com/actual-gallery.png');
});

test('malformed HTTPS covers are skipped and Unicode gallery URLs are encoded for LINE', async () => {
  const sent = await propertyReply([
    { id: 'malformed-one', title: 'One', published: true, slug: 'one', cover_image: 'https:photos.example.com/bad.jpg', images: ['https://photos.example.com/บ้าน.jpg'] },
    { id: 'malformed-two', title: 'Two', published: true, slug: 'two', cover_image: 'https:/photos.example.com/bad.jpg', images: ['https://photos.example.com/บ้าน.jpg'] },
  ]);
  const bubbles = sent.messages[0].contents.contents;
  assert.equal(bubbles.length, 2);
  for (const bubble of bubbles) {
    assert.equal(bubble.hero.url, 'https://photos.example.com/%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99.jpg');
  }
});

test('property cards without a usable photo omit the hero instead of substituting a sample home', async () => {
  const sent = await propertyReply([{
    id: 'no-photo', title: 'Property without a photo', published: true, slug: 'no-photo',
    cover_image: 'http://photos.example.com/insecure.jpg', images: [],
  }]);
  const bubble = sent.messages[0].contents.contents[0];
  assert.equal(Object.hasOwn(bubble, 'hero'), false);
  assert.equal(JSON.stringify(bubble).includes('unsplash'), false);
  assert.equal(bubble.footer.contents[0].action.uri, 'https://site.example.com/property-site/properties/CK-NO-PHOTO');
});

test('public property image endpoint converts the selected uploaded WebP to bounded JPEG', async () => {
  const original = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: { r: 40, g: 140, b: 90 } } }).webp().toBuffer();
  const cover = `data:image/webp;base64,${original.toString('base64')}`;
  let read;
  const api = load('app/api/line/property-image/route.ts', {
    firestore: { getFirestoreDocument: async (...args) => {
      read = args;
      return propertyDocument({ published: true, cover_image: cover, images: ['https://photos.example.com/other.jpg'] });
    } },
  });
  const response = await api.GET(new Request('https://api.example.com/api/line/property-image?id=uploaded-home'));
  assert.equal(response.status, 200);
  assert.equal(read[0], 'properties');
  assert.equal(read[1], 'uploaded-home');
  assert.equal(response.headers.get('content-type'), 'image/jpeg');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const output = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.width, 1024);
  assert.equal(metadata.height, 768);
  assert.ok(output.length < 1024 * 1024);
  const { data } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
  assert.ok(Math.abs(data[0] - 40) < 10);
  assert.ok(Math.abs(data[1] - 140) < 10);
  assert.ok(Math.abs(data[2] - 90) < 10);
});

test('public image endpoint does not expose drafts or missing property documents', async () => {
  for (const document of [
    () => propertyDocument({ published: false, cover_image: 'https://photos.example.com/private.jpg' }),
    () => propertyDocument({ cover_image: 'https://photos.example.com/unpublished.jpg' }),
    () => new Response(null, { status: 403 }),
    () => new Response(null, { status: 404 }),
  ]) {
    const api = load('app/api/line/property-image/route.ts', { firestore: { getFirestoreDocument: async () => document() } });
    const response = await api.GET(new Request('https://api.example.com/api/line/property-image?id=private-home'));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('location'), null);
  }
});

test('public image endpoint rejects unsupported and malformed embedded photos', async () => {
  for (const photo of [
    'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    'data:image/png;base64,not-base64!',
    'data:image/webp;base64,bm90IGFuIGltYWdl',
  ]) {
    const api = load('app/api/line/property-image/route.ts', {
      firestore: { getFirestoreDocument: async () => propertyDocument({ published: true, cover_image: photo, images: [] }) },
    });
    assert.equal((await api.GET(new Request('https://api.example.com/api/line/property-image?id=bad-image'))).status, 404);
  }
});

test('public image endpoint requires a property ID and cannot proxy an arbitrary URL', async () => {
  let reads = 0;
  const api = load('app/api/line/property-image/route.ts', {
    fetch: async () => { throw Error('Image endpoint must not fetch arbitrary URLs'); },
    firestore: { getFirestoreDocument: async () => {
      reads += 1;
      return propertyDocument({ published: true, cover_image: 'https://photos.example.com/actual-cover.jpg' });
    } },
  });
  const missingId = await api.GET(new Request('https://api.example.com/api/line/property-image?url=https://attacker.example.com/image.jpg'));
  assert.equal(missingId.status, 400);
  assert.equal(reads, 0);
  const invalidId = await api.GET(new Request('https://api.example.com/api/line/property-image?id=..%2Fprivate'));
  assert.equal(invalidId.status, 400);
  assert.equal(reads, 0);
  const knownProperty = await api.GET(new Request('https://api.example.com/api/line/property-image?id=public-home&url=https://attacker.example.com/image.jpg'));
  assert.equal(knownProperty.status, 307);
  assert.equal(knownProperty.headers.get('location'), 'https://photos.example.com/actual-cover.jpg');
  assert.equal(reads, 1);
});

test('unavailable image storage returns a retryable error instead of a substitute photo', async () => {
  const api = load('app/api/line/property-image/route.ts', {
    firestore: { getFirestoreDocument: async () => new Response(null, { status: 503 }) },
  });
  const response = await api.GET(new Request('https://api.example.com/api/line/property-image?id=public-home'));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('location'), null);
});

test('legacy property image URL uses the published-listing guard instead of exposing draft photos', async () => {
  const api = load('app/api/properties/[id]/image/route.ts', {
    firestore: { getFirestoreDocument: async (collection, id) => {
      assert.equal(collection, 'properties');
      assert.equal(id, 'draft-home');
      return propertyDocument({ published: false, cover_image: 'https://photos.example.com/private.jpg' });
    } },
  });
  const response = await api.GET(new Request('https://api.example.com/api/properties/draft-home/image?index=0'), { params: Promise.resolve({ id: 'draft-home' }) });
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('location'), null);
});

test('legacy image URL serves the selected gallery photo as JPEG and defaults to the chosen cover', async () => {
  const makePhoto = async (background) => `data:image/webp;base64,${(await sharp({ create: { width: 64, height: 48, channels: 3, background } }).webp().toBuffer()).toString('base64')}`;
  const cover = await makePhoto({ r: 240, g: 20, b: 30 });
  const firstGalleryPhoto = await makePhoto({ r: 20, g: 40, b: 230 });
  const selectedGalleryPhoto = await makePhoto({ r: 40, g: 140, b: 90 });
  const api = load('app/api/properties/[id]/image/route.ts', {
    firestore: { getFirestoreDocument: async (collection, id) => {
      assert.equal(collection, 'properties');
      assert.equal(id, 'public-home');
      return propertyDocument({ published: true, cover_image: cover, images: [firstGalleryPhoto, selectedGalleryPhoto] });
    } },
  });
  for (const [query, expectedColor] of [['?index=1', [40, 140, 90]], ['', [240, 20, 30]]]) {
    const response = await api.GET(new Request(`https://api.example.com/api/properties/public-home/image${query}`), { params: Promise.resolve({ id: 'public-home' }) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/jpeg');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const output = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.format, 'jpeg');
    assert.equal(metadata.width, 64);
    assert.equal(metadata.height, 48);
    const { data } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
    for (let channel = 0; channel < expectedColor.length; channel += 1) {
      assert.ok(Math.abs(data[channel] - expectedColor[channel]) < 10);
    }
  }
});

test('Firestore property search constrains results to published documents', async () => {
  let query;
  const api = load('lib/firestore-rest.ts', {
    fetch: async (_url, init) => {
      query = JSON.parse(init.body).structuredQuery;
      return Response.json([{ document: { name: 'projects/test-project/databases/(default)/documents/properties/home', fields: { published: { booleanValue: true } } } }]);
    },
  });
  const results = await api.listFirestoreDocuments('properties', 20, { publishedOnly: true });
  assert.equal(query.where.fieldFilter.field.fieldPath, 'published');
  assert.equal(query.where.fieldFilter.op, 'EQUAL');
  assert.equal(query.where.fieldFilter.value.booleanValue, true);
  assert.equal(results[0].published, true);
});
