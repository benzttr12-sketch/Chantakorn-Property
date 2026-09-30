const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, { env = {}, fetch = async () => { throw Error('Unexpected request'); } } = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = vm.createContext({ module, exports: module.exports, Request, Response, URL, fetch,
    console: { error() {}, warn() {} }, process: { env },
    require(name) {
      if (name === '@/lib/api-response') return { jsonResponse: Response.json.bind(Response) };
      if (name === '@/lib/server-auth') return { requireStaff: async () => null };
      if (name === '@/lib/firestore-rest') return {};
      if (name === '@google/genai') return { GoogleGenAI: class {} };
      throw Error(name);
    },
  });
  vm.runInContext(source, context);
  return module.exports;
}
const env = { LINE_CHANNEL_ACCESS_TOKEN: 'test-token', LINE_TARGET_USER_ID: 'U' + '1'.repeat(32), NEXT_PUBLIC_SITE_URL: 'https://example.com/Property' };
const request = body => new Request('https://worker.example/api/line/notify', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

test('LINE refuses to broadcast customer information when the private recipient is missing', async () => {
  const api = load('app/api/line/notify/route.ts', { env: { ...env, LINE_TARGET_USER_ID: '' } });
  const response = await api.POST(request({ inquiry_type: 'inquiry', name: 'Test' }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).success, false);
});
test('LINE rejection is an error, never simulated success', async () => {
  const api = load('app/api/line/notify/route.ts', { env, fetch: async () => Response.json({ message: 'Invalid token' }, { status: 401 }) });
  const response = await api.POST(request({ inquiry_type: 'inquiry' }));
  assert.equal(response.status, 502);
  const result = await response.json();
  assert.equal(result.success, false);
  assert.equal(result.isRealSent, false);
});
test('LINE sends only to the configured owner and preserves static-site property links', async () => {
  let sent;
  const api = load('app/api/line/notify/route.ts', { env, fetch: async (url, init) => {
    sent = { url, body: JSON.parse(init.body) };
    return Response.json({}, { headers: { 'x-line-request-id': 'request-123' } });
  } });
  const response = await api.POST(request({ title: 'Test property', slug: 'home one', cover_image: 'data:image/png;base64,test', overrideTargetId: 'U' + '2'.repeat(32) }));
  assert.equal(response.status, 200);
  assert.equal(sent.url, 'https://api.line.me/v2/bot/message/push');
  assert.equal(sent.body.to, env.LINE_TARGET_USER_ID);
  assert.equal(sent.body.messages[1].contents.hero, undefined);
  assert.equal(sent.body.messages[1].contents.footer.contents[0].action.uri, 'https://example.com/Property/properties/detail/?slug=home%20one');
  assert.equal((await response.json()).requestId, 'request-123');
});
test('Gemini uses Flash-Lite directly and never retries with a fallback model', async () => {
  const api = load('lib/gemini.ts');
  let calls = 0;
  assert.equal(api.GEMINI_PRIMARY_MODEL, 'gemini-3.5-flash-lite');
  await assert.rejects(api.generateGeminiContent({ models: { generateContent: async () => { calls++; throw Error('503 UNAVAILABLE'); } } }, { model: api.GEMINI_PRIMARY_MODEL, contents: 'hello' }), /503/);
  assert.equal(calls, 1);
});
test('a large property produces a small LINE request without private notes or embedded photos', () => {
  const api = load('lib/line-property-payload.ts');
  const payload = api.buildLinePropertyPayload({ title: 'Property', price: 1000000, slug: 'home',
    cover_image: 'data:image/png;base64,' + 'x'.repeat(20000), images: ['x'.repeat(50000)], internal_notes: 'Private note' });
  assert.ok(JSON.stringify(payload).length < 16000);
  assert.equal(payload.images, undefined);
  assert.equal(payload.internal_notes, undefined);
  assert.equal(payload.cover_image, undefined);
});
