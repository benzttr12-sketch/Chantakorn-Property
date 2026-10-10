const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const code = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/lib/admin-operations.ts'), 'utf8'),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  },
).outputText;
const moduleContext = { exports: {} };
vm.runInNewContext(code, moduleContext);
const { parseAdminPrice, toggleVisibleSelection, runSelectedOperations } = moduleContext.exports;

test('admin price validates the entire value and rejects malformed or unbounded numbers', () => {
  assert.equal(parseAdminPrice('6,100,000'), 6100000);
  assert.equal(parseAdminPrice(' 1234.50 '), 1234.5);
  assert.equal(parseAdminPrice('0'), 0);
  for (const input of [
    '',
    '-1',
    '123abc',
    '1e6',
    'Infinity',
    '1,00,000',
    '1,234,',
    '1.234',
    '9007199254740992',
  ]) {
    assert.equal(parseAdminPrice(input), null, input);
  }
});

test('select all tracks visible IDs rather than unrelated selection counts', () => {
  assert.deepEqual(Array.from(toggleVisibleSelection(['hidden'], ['visible'])), [
    'hidden',
    'visible',
  ]);
  assert.deepEqual(Array.from(toggleVisibleSelection(['hidden', 'one', 'two'], ['one', 'two'])), [
    'hidden',
  ]);
  assert.deepEqual(Array.from(toggleVisibleSelection(['one'], ['one', 'two'])), ['one', 'two']);
  assert.deepEqual(Array.from(toggleVisibleSelection(['hidden'], [])), ['hidden']);
});

test('bulk operation waits for all results and preserves failures for a safe retry', async () => {
  const completed = [];
  const result = await runSelectedOperations(['saved', 'missing', 'network'], async (id) => {
    if (id === 'network') throw new Error('offline');
    if (id === 'missing') return false;
    await new Promise((resolve) => setTimeout(resolve, 5));
    completed.push(id);
    return { id };
  });
  assert.deepEqual(completed, ['saved']);
  assert.deepEqual(Array.from(result.succeeded), ['saved']);
  assert.deepEqual(Array.from(result.failed), ['missing', 'network']);
});
