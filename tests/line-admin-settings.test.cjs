const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const moduleUnderTest = { exports: {} };
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/line-admin-settings.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(source, { module: moduleUnderTest, exports: moduleUnderTest.exports });
const { saveLinePreferences } = moduleUnderTest.exports;
const preferences = { autoNotifyNewProperty: false, autoNotifyConsignment: true };

test('LINE preference changes require server acknowledgement and send only preferences', async () => {
  let payload;
  await saveLinePreferences(async (url, init) => {
    assert.equal(url, '/api/line/notify');
    assert.equal(init.method, 'POST');
    payload = JSON.parse(init.body);
    return Response.json({ success: true });
  }, preferences);
  assert.deepEqual(payload, { action: 'save_settings', ...preferences });
});

test('failed preference persistence stays a failure even if transport or payload appears successful', async () => {
  await assert.rejects(saveLinePreferences(async () => Response.json({ success: false, error: 'Write denied' }), preferences), /Write denied/);
  await assert.rejects(saveLinePreferences(async () => Response.json({ success: true }, { status: 502 }), preferences), /บันทึกการตั้งค่าไม่สำเร็จ/);
  await assert.rejects(saveLinePreferences(async () => Response.json({}), preferences), /บันทึกการตั้งค่าไม่สำเร็จ/);
});

test('network and malformed responses never acknowledge saved LINE preferences', async () => {
  await assert.rejects(saveLinePreferences(async () => { throw new Error('Network unavailable'); }, preferences), /Network unavailable/);
  await assert.rejects(saveLinePreferences(async () => new Response('invalid json'), preferences));
});
