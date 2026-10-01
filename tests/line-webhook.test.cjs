const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac, webcrypto } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, { env = {}, fetch = async () => { throw Error('Unexpected request'); }, firestore = {} } = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = vm.createContext({
    module, exports: module.exports, Request, Response, URL, URLSearchParams, Headers, AbortSignal,
    TextEncoder, crypto: webcrypto, btoa: text => Buffer.from(text, 'binary').toString('base64'),
    fetch, process: { env }, console: { log() {}, warn() {}, error() {} },
    require(name) {
      if (name === '@/lib/api-response') return { jsonResponse: (body, init) => Response.json(body, init) };
      if (name === '@/lib/server-auth') return { requireStaff: async () => null };
      if (name === '@/lib/firestore-rest') return {
        createFirestoreDocument: async () => ({ ok: true }),
        listFirestoreDocuments: firestore.listFirestoreDocuments || (async () => []),
      };
      if (name === '../../firebase-applet-config.json') return { default: { projectId: 'test-project', firestoreDatabaseId: '(default)', apiKey: 'test-key' } };
      throw Error(name);
    },
  });
  vm.runInContext(source, context);
  return module.exports;
}

function signedRequest(text, secret = 'test-secret') {
  const body = JSON.stringify({ events: [{ type: 'message', replyToken: 'real-reply-token', source: { userId: 'Utest' }, message: { type: 'text', text } }] });
  const signature = createHmac('sha256', secret).update(body).digest('base64');
  return new Request('https://example.com/api/line/webhook', { method: 'POST', headers: { 'x-line-signature': signature }, body });
}

test('webhook reports missing LINE credentials instead of readiness', async () => {
  const api = load('app/api/line/webhook/route.ts');
  const response = await api.GET(new Request('https://example.com/api/line/webhook'));
  const result = await response.json();
  assert.equal(result.status, 'configuration_required');
  assert.equal(result.isChannelAccessTokenConfigured, false);
  assert.equal(result.isChannelSecretConfigured, false);
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
