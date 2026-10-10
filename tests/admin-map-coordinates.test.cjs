const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/components/admin/InvestmentZoneDistributionMap.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const moduleContext = { exports: {}, require: () => ({}) };
vm.runInNewContext(compiled, moduleContext);
const { hasPropertyMapCoordinates } = moduleContext.exports;

test('map accepts recorded finite coordinates, including legacy numeric strings', () => {
  assert.equal(hasPropertyMapCoordinates({ latitude: 7.225, longitude: 100.565 }), true);
  assert.equal(hasPropertyMapCoordinates({ latitude: '7.225', longitude: '100.565' }), true);
  assert.equal(hasPropertyMapCoordinates({ latitude: 0, longitude: 100 }), true);
});

test('map excludes placeholder coordinates explicitly marked unavailable', () => {
  assert.equal(hasPropertyMapCoordinates({ latitude: 7.0084, longitude: 100.4705, coordinates_available: false }), false);
  assert.equal(hasPropertyMapCoordinates({ latitude: 0, longitude: 0 }), false);
});

test('map rejects missing, empty, nonfinite and out-of-range coordinates without fallback pins', () => {
  for (const values of [
    { longitude: 100.565 },
    { latitude: null, longitude: 100.565 },
    { latitude: '', longitude: 100.565 },
    { latitude: '  ', longitude: 100.565 },
    { latitude: 'invalid', longitude: 100.565 },
    { latitude: Infinity, longitude: 100.565 },
    { latitude: 91, longitude: 100.565 },
    { latitude: 7.225, longitude: -181 },
  ]) assert.equal(hasPropertyMapCoordinates(values), false, JSON.stringify(values));
});
