const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadAddresses() {
  const source = fs.readFileSync('src/data/songkhla-addresses.ts', 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const execute = vm.runInNewContext(`(function(module,exports){${compiled}
})`, {});
  execute(module, module.exports);
  return module.exports;
}

test('Songkhla address catalogue contains all 16 districts and 127 subdistricts', () => {
  const { SONGKHLA_ADDRESSES, SONGKHLA_DISTRICTS, subdistrictsForSongkhlaDistrict } = loadAddresses();
  assert.equal(SONGKHLA_ADDRESSES.length, 16);
  assert.equal(SONGKHLA_DISTRICTS.length, 16);
  assert.equal(new Set(SONGKHLA_DISTRICTS).size, 16);
  assert.equal(SONGKHLA_ADDRESSES.flatMap(row => row.subdistricts).length, 127);
  assert.deepEqual([...subdistrictsForSongkhlaDistrict('หาดใหญ่')], [
    'หาดใหญ่', 'ควนลัง', 'คูเต่า', 'คอหงส์', 'คลองแห', 'คลองอู่ตะเภา',
    'ฉลุง', 'ทุ่งใหญ่', 'ทุ่งตำเสา', 'ท่าข้าม', 'น้ำน้อย', 'บ้านพรุ', 'พะตง',
  ]);
});
