const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/components/admin/AdminMonthlyActivity.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const moduleContext = { exports: {}, require };
vm.runInNewContext(compiled, moduleContext);
const { getMonthlyActivity } = moduleContext.exports;

test('dashboard months follow the Thai calendar across a year boundary', () => {
  const rows = getMonthlyActivity([], [], new Date('2026-01-31T18:00:00Z'));
  assert.deepEqual(Array.from(rows, row => row.key), ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
});

test('dashboard counts persisted creation dates and excludes invalid, future, and older records', () => {
  const rows = getMonthlyActivity([
    { created_at: '2025-08-31T16:59:59Z' },
    { created_at: '2025-08-31T17:00:00Z' },
    { created_at: '2026-01-31T17:30:00Z' },
    { created_at: '2026-02-01T10:00:00Z' },
    { created_at: 'invalid' },
  ], [{ created_at: '2025-12-31T17:30:00Z' }], new Date('2026-01-31T18:00:00Z'));
  assert.equal(rows[0].properties, 1);
  assert.equal(rows[5].properties, 1);
  assert.equal(rows[4].inquiries, 1);
  assert.equal(rows.reduce((sum, row) => sum + row.properties, 0), 2);
  assert.equal(rows.reduce((sum, row) => sum + row.inquiries, 0), 1);
});

test('an empty backend yields zero activity in every month', () => {
  const rows = getMonthlyActivity([], [], new Date('2026-10-09T12:00:00Z'));
  assert.equal(rows.length, 6);
  assert.ok(rows.every(row => row.properties === 0 && row.inquiries === 0));
});
