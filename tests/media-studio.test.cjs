const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load({ staff = true, ai = null, env = {}, onClient = () => {} } = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/app/api/ai/property-media-studio/route.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, Request, Response, process: { env },
    require(name) {
      if (name === '@/lib/api-response') return { jsonResponse: (body, init) => Response.json(body, init) };
      if (name === '@/lib/server-auth') return { requireStaff: async () => staff ? null : Response.json({ error: 'Unauthorized' }, { status: 401 }) };
      if (name === '@/lib/gemini') return { getGeminiClient() { onClient(); return ai; } };
      throw Error(name);
    },
  });
  return module.exports;
}

const request = (body) => new Request('https://site.example/api/ai/property-media-studio', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const valid = { action: 'edit_image', prompt: 'ที่ดินเปล่า ขนาด 100 ตร.วา', editStyle: 'Modern Luxury' };

test('media tools deny anonymous users before parsing data or opening a provider client', async () => {
  let calls = 0;
  const api = load({ staff: false, onClient: () => { calls += 1; } });
  const response = await api.POST({ json: () => { throw Error('Must not parse anonymous data'); } });
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test('media tools reject malformed actions and invalid briefs without provider calls', async () => {
  let calls = 0;
  const api = load({ onClient: () => { calls += 1; } });
  for (const body of [null, { action: 'other', prompt: 'brief' }, { ...valid, prompt: '' }, { ...valid, prompt: 123 }, { ...valid, prompt: 'x'.repeat(4001) }, { ...valid, editStyle: {} }]) {
    assert.equal((await api.POST(request(body))).status, 400);
  }
  assert.equal(calls, 0);
});

test('video generation reports unavailable instead of unrelated stock footage or simulated success', async () => {
  let calls = 0;
  const api = load({ onClient: () => { calls += 1; } });
  const response = await api.POST(request({ ...valid, action: 'generate_video' }));
  const result = await response.json();
  assert.equal(response.status, 503);
  assert.equal(result.success, false);
  assert.equal(result.code, 'VIDEO_NOT_CONFIGURED');
  assert.equal(result.videoUrl, undefined);
  assert.equal(result.imageUrl, undefined);
  assert.equal(result.isSimulation, undefined);
  assert.equal(calls, 0);
  assert.match(response.headers.get('Cache-Control'), /no-store/);
});

test('missing AI configuration reports unavailable and never returns a fabricated staging plan', async () => {
  const response = await load().POST(request(valid));
  const result = await response.json();
  assert.equal(response.status, 503);
  assert.equal(result.success, false);
  assert.equal(result.code, 'AI_NOT_CONFIGURED');
  assert.equal(result.stagingDescription, undefined);
  assert.equal(result.imageUrl, undefined);
});

test('successful AI work returns the actual text plan and does not misrepresent original images as generated', async () => {
  let input;
  const ai = { models: { async generateContent(value) { input = value; return { text: '  แผนจริงจากผู้ให้บริการ  ' }; } } };
  const response = await load({ ai }).POST(request({ ...valid, imageUrl: 'https://site.example/original.jpg' }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.success, true);
  assert.equal(result.outputType, 'staging_plan');
  assert.equal(result.stagingDescription, 'แผนจริงจากผู้ให้บริการ');
  assert.equal(result.imageUrl, undefined);
  assert.equal(result.videoUrl, undefined);
  assert.equal(result.isSimulation, undefined);
  assert.equal(input.model, 'gemini-3.8-flash');
  assert.equal(input.config.httpOptions.timeout, 20000);
  assert.ok(input.contents.includes(valid.prompt));
  assert.ok(input.contents.includes('ข้อความเท่านั้น'));
  assert.ok(input.contents.includes('อย่าเติมข้อเท็จจริง'));
});

test('configured text model is forwarded to the provider', async () => {
  let actualModel;
  const ai = { models: { async generateContent(input) { actualModel = input.model; return { text: 'แผน' }; } } };
  assert.equal((await load({ ai, env: { GEMINI_TEXT_MODEL: 'configured-text-model' } }).POST(request(valid))).status, 200);
  assert.equal(actualModel, 'configured-text-model');
});

test('provider failures return a visible retryable error without leaking prompt, key or provider details', async () => {
  const ai = { models: { async generateContent() { throw Error('secret-api-key private-customer-prompt provider-internal-url'); } } };
  const response = await load({ ai }).POST(request(valid));
  const result = await response.json();
  assert.equal(response.status, 502);
  assert.equal(result.success, false);
  assert.equal(result.code, 'AI_PROVIDER_FAILED');
  assert.doesNotMatch(JSON.stringify(result), /secret-api-key|private-customer-prompt|provider-internal-url/);
  assert.equal(result.stagingDescription, undefined);
});

test('an empty provider response is a failure, never a success notification', async () => {
  const ai = { models: { async generateContent() { return { text: '  ' }; } } };
  const response = await load({ ai }).POST(request(valid));
  const result = await response.json();
  assert.equal(response.status, 502);
  assert.equal(result.success, false);
  assert.equal(result.stagingDescription, undefined);
});
