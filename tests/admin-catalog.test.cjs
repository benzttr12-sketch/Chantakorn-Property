const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/lib/admin-catalog.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
const { collectAdminCatalogPages } = (() => {
  const module = { exports: {} };
  vm.runInContext(`(function(require,module,exports){${source}\n})`, vm.createContext({}))
    (() => { throw new Error('Unexpected require'); }, module, module.exports);
  return module.exports;
})();

const page = (data, nextCursor) => ({ data, nextCursor });

test('collects every native Admin page in order and stops at an explicit null cursor', async () => {
  const pages = [page(['a', 'b'], 'next-1'), page(['c'], 'next-2'), page(['d'], null)];
  const seen = [];
  const rows = await collectAdminCatalogPages(async cursor => {
    seen.push(cursor);
    return pages[seen.length - 1];
  });
  assert.deepEqual([...rows], ['a', 'b', 'c', 'd']);
  assert.deepEqual(seen, [null, 'next-1', 'next-2']);
});

test('refuses cursor cycles instead of looping forever', async () => {
  const seen = [];
  await assert.rejects(collectAdminCatalogPages(async cursor => {
    seen.push(cursor);
    return page(['x'], 'same-cursor');
  }), /cursor ซ้ำ/);
  assert.equal(seen.length, 2);
});

test('fails visibly at the row and page ceilings instead of truncating', async () => {
  let pages = 0;
  await assert.rejects(collectAdminCatalogPages(async () => page(['a', 'b'], `next-${++pages}`), {
    rowLimit: 3,
  }), /เกินขีดจำกัดของหน้าภาพรวม/);
  assert.equal(pages, 2);
  pages = 0;
  await assert.rejects(collectAdminCatalogPages(async () => page(['a'], `next-${++pages}`), {
    maxPages: 3,
  }), /เกินขีดจำกัดของหน้าภาพรวม/);
  assert.equal(pages, 3);
});

test('rejects malformed pages and invalid bounds before scanning', async () => {
  await assert.rejects(collectAdminCatalogPages(async () => ({ data: 'nope', nextCursor: null })),
    /หน้าถัดไปไม่ถูกต้อง/);
  for (const options of [{ maxPages: 0 }, { maxPages: 1.5 }, { rowLimit: 0 }, { rowLimit: -1 }])
    await assert.rejects(collectAdminCatalogPages(async () => page([], null), options), /ไม่ถูกต้อง/);
});
