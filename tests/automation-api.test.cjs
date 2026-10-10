const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load({ staff = true, ai = null } = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/app/api/ai/automate/route.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, Response,
    require(name) {
      if (name === 'next/server') return { NextResponse: { json: (body, init) => Response.json(body, init) } };
      if (name === '@/lib/server-auth') return { requireStaff: async () => staff ? null : Response.json({ error: 'Unauthorized' }, { status: 401 }) };
      if (name === '@/lib/gemini') return { getGeminiClient: () => ai };
      throw Error(name);
    },
  });
  return module.exports;
}
test('marketing AI denies anonymous callers before parsing any customer data', async () => {
  const response = await load({ staff: false }).POST({ json() { throw Error('must not read'); } });
  assert.equal(response.status, 401);
});
test('marketing provider errors remain failures without leaking provider details', async () => {
  const ai = { models: { async generateContent() { throw Error('private-prompt secret-key provider-detail'); } } };
  const response = await load({ ai }).POST({ json: async () => ({ action: 'generate-social-post', payload: { channel: 'facebook', tone: 'normal', property: { title: 'Actual property', price: 100, features: [] } } }) });
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.doesNotMatch(JSON.stringify(body), /private-prompt|secret-key|provider-detail/);
});
