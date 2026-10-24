const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, { env = {}, catalog, fetch, server } = {}) {
  const cache = new Map();
  const warnings = [];
  function moduleAt(relative) {
    if (cache.has(relative)) return cache.get(relative);
    const module = { exports: {} };
    const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', relative + '.ts'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(source, { module, exports: module.exports, URL, URLSearchParams, AbortSignal, fetch,
      console: { warn: code => warnings.push(code) }, process: { env },
      require(name) {
        if (name === '@/lib/sitemap-catalog' && catalog) return { sitemapCatalog: catalog };
        if (name === '@/lib/server-firestore') return { serverFirestore: server || (() => { throw new Error('No real credentials in tests'); }) };
        if (name.startsWith('@/')) return moduleAt(name.slice(2));
        throw new Error('Unexpected import ' + name);
      },
    });
    cache.set(relative, module.exports);
    return module.exports;
  }
  return { module: moduleAt(file), warnings };
}

test('fresh catalog produces only real public landing pages, never demo or user pages', async () => {
  const { module } = load('app/sitemap', { catalog: async () => [] });
  const rows = await module.default();
  assert.equal(rows.length, 8);
  assert.ok(rows.every(row => !row.url.includes('/properties/') && !row.url.includes('favorites') && !row.lastModified));
  assert.equal(rows[0].url, 'https://chantakornproperty.com');
});

test('sitemap projects published undeleted records, preserves D1 codes and avoids duplicate URLs', async () => {
  const row = { id: '00000000-0000-4000-8000-000000000001', code: 'CK-1234567890AB', published: true, updated_at: '2026-10-20T00:00:00.000Z' };
  const { module } = load('app/sitemap', { env: { NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND: 'cloudflare', NEXT_PUBLIC_BASE_PATH: '/site' },
    catalog: async () => [row, row, { ...row, published: false }, { ...row, deleted_at: '2026-10-20' }, { ...row, id: '../admin' }],
  });
  const rows = await module.default();
  assert.equal(rows.length, 9);
  assert.equal(rows.at(-1).url, 'https://chantakornproperty.com/site/properties/CK-1234567890AB');
  assert.equal(rows.at(-1).lastModified, row.updated_at);
});

test('catalog errors retain static pages and log only a diagnostic code', async () => {
  const { module, warnings } = load('app/sitemap', { catalog: async () => { throw new Error('sensitive details'); } });
  assert.equal((await module.default()).length, 8);
  assert.deepEqual(warnings, ['SITEMAP_CATALOG_UNAVAILABLE']);
});

test('Cloudflare sitemap follows bounded public pages without authentication or redirects', async () => {
  const calls = [];
  const { module } = load('lib/sitemap-catalog', { env: { NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND: 'cloudflare', NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN: 'https://api.example.test' },
    fetch: async (url, options) => {
      calls.push(url.toString());
      assert.equal(url.pathname, '/v1/properties'); assert.equal(url.searchParams.get('limit'), '30');
      assert.equal(options.redirect, 'error'); assert.equal(options.headers, undefined);
      if (calls.length === 1) return Response.json({ data: [{ id: 'a' }], next_cursor: 'next' });
      assert.equal(url.searchParams.get('cursor'), 'next');
      return Response.json({ data: [{ id: 'b' }], next_cursor: null });
    },
  });
  assert.equal((await module.sitemapCatalog()).length, 2); assert.equal(calls.length, 2);
});

test('Cloudflare sitemap rejects repeated cursor instead of returning a partial catalog', async () => {
  const { module } = load('lib/sitemap-catalog', { env: { NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND: 'cloudflare', NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN: 'https://api.example.test' },
    fetch: async () => Response.json({ data: [], next_cursor: 'loop' }),
  });
  await assert.rejects(module.sitemapCatalog(), /Repeated sitemap cursor/);
});

test('local preview avoids cloud reads and robots points to the canonical sitemap', async () => {
  const { module } = load('lib/sitemap-catalog', { env: { NEXT_PUBLIC_DATA_BACKEND: 'local' } });
  assert.equal((await module.sitemapCatalog()).length, 0);
  const robots = load('app/robots', { env: { NEXT_PUBLIC_BASE_PATH: '/site' } }).module.default();
  assert.equal(robots.sitemap, 'https://chantakornproperty.com/site/sitemap.xml');
});
