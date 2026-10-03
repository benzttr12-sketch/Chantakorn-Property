const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac, webcrypto } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const sharp = require('sharp');

function load(file, { env = {}, fetch = async () => { throw Error('Unexpected request'); }, firestore = {}, requireStaff = async () => null } = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = vm.createContext({
    module, exports: module.exports, Request, Response, URL, URLSearchParams, Headers, AbortSignal, Buffer,
    TextEncoder, crypto: webcrypto, btoa: text => Buffer.from(text, 'binary').toString('base64'),
    fetch, process: { env }, console: { log() {}, info() {}, warn() {}, error() {} },
    require(name) {
      if (name === '@/lib/api-response') return { jsonResponse: (body, init) => Response.json(body, init) };
      if (name === '@/lib/server-auth') return { requireStaff };
      if (name === '@/lib/line-property-image') return load('lib/line-property-image.ts');
      if (name === '@/app/api/line/property-image/route') return load('app/api/line/property-image/route.ts', { env, fetch, firestore, requireStaff });
      if (name === 'sharp') return { default: sharp };
      if (name === 'node:buffer') return require(name);
      if (name === '@/lib/firestore-rest') return {
        createFirestoreDocument: firestore.createFirestoreDocument || (async () => ({ ok: true })),
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
        { title: 'Public home', published: true, slug: 'home one', status: 'sale', price: 1000000 },
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
  assert.equal(bubbles[0].footer.contents[0].action.uri, 'https://example.com/site/properties/detail/?slug=home%20one');
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
  assert.equal(bubble.hero.url, 'https://api.example.com/api/line/property-image?id=home%20one');
  assert.equal(bubble.footer.contents[0].action.uri, 'https://site.example.com/property-site/properties/detail/?slug=home%20one');
  assert.equal(JSON.stringify(sent).includes(uploadedCover), false);
  assert.equal(JSON.stringify(sent).includes('data:image'), false);
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
  assert.equal(bubble.footer.contents[0].action.uri, 'https://site.example.com/property-site/properties/detail/?slug=no-photo');
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
