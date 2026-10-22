const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadModules({ staticExport = false, basePath = '', propertyBackend = 'firebase' } = {}) {
  const sourceRoot = path.resolve(__dirname, '../src');
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(compiled, {
      module, exports: module.exports,
      process: { env: { NEXT_PUBLIC_STATIC_EXPORT: String(staticExport), NEXT_PUBLIC_BASE_PATH: basePath, NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND: propertyBackend } },
      require(name) {
        if (!name.startsWith('.') && !name.startsWith('@/')) return require(name);
        const target = name.startsWith('@/')
          ? path.join(sourceRoot, name.slice(2))
          : path.resolve(path.dirname(filename), name);
        return load(`${target}.ts`);
      },
    }, { filename });
    return module.exports;
  }
  return {
    links: load(path.join(sourceRoot, 'lib/property-link.ts')),
    utils: load(path.join(sourceRoot, 'lib/utils.ts')),
    componentLinks: load(path.join(sourceRoot, 'components/properties/property-link.ts')),
    line: load(path.join(sourceRoot, 'lib/line-inquiry.ts')),
  };
}

const property = {
  id: 'ck-rp6nqm',
  slug: 'ขายที่ดิน-447-ตรวติดถนนคอนกรีด-ใกล้-มทักษิณสงขลา-จสงขลา-6377',
  title: 'ขายที่ดิน 44.7 ตรว. ใกล้ ม.ทักษิณสงขลา',
  property_type: 'land', status: 'sale', price: 1800000,
  province: 'สงขลา', district: 'เมืองสงขลา', land_size: 44.7,
  images: [], features: [], published: true,
};

function propertyUrls(text) {
  return text.match(/https?:\/\/[^\s]+\/properties\/[^\s]+/g) || [];
}

test('shared and compatibility helpers use the property code independently of a Thai title slug', () => {
  const { links, utils, componentLinks } = loadModules();
  for (const helper of [links.propertyHref, utils.propertyHref, componentLinks.propertyHref]) {
    assert.equal(helper(property), '/properties/CK-RP6NQM');
    assert.equal(helper({ ...property, slug: 'ชื่อประกาศที่เปลี่ยนใหม่' }), '/properties/CK-RP6NQM');
  }
});

test('slug-only and legacy string links remain encoded and usable for older callers', () => {
  const { links } = loadModules();
  const expected = `/properties/${encodeURIComponent(property.slug)}`;
  assert.equal(links.propertyHref({ slug: property.slug }), expected);
  assert.equal(links.propertyHref(property.slug), expected);
  assert.equal(links.propertyHref('legacy-home-123'), '/properties/legacy-home-123');
});

test('static hosting links use the detail fallback for property codes and legacy slugs', () => {
  const { links } = loadModules({ staticExport: true });
  assert.equal(links.propertyHref(property), '/properties/detail/?slug=CK-RP6NQM');
  assert.equal(links.propertyHref({ slug: property.slug }), `/properties/detail/?slug=${encodeURIComponent(property.slug)}`);
  assert.equal(links.propertyHref(property.slug), `/properties/detail/?slug=${encodeURIComponent(property.slug)}`);
});

test('absolute property URLs trim the origin and retain the configured hosting prefix once', () => {
  const normal = loadModules().links;
  assert.equal(normal.propertyUrl(property, 'https://preview.example/'), 'https://preview.example/properties/CK-RP6NQM');

  const prefixed = loadModules({ basePath: '/Chantakorn-Property' }).links;
  const expected = 'https://preview.example/Chantakorn-Property/properties/CK-RP6NQM';
  assert.equal(prefixed.propertyUrl(property, 'https://preview.example///'), expected);
  assert.equal(prefixed.propertyUrl(property, 'https://preview.example/Chantakorn-Property/'), expected);
  assert.equal(prefixed.propertyUrl(property, 'https://preview.example/explicit-prefix/'), 'https://preview.example/explicit-prefix/properties/CK-RP6NQM');
});

test('customer marketing snippets and LINE inquiry messages contain the same short property URL', () => {
  const { utils, line } = loadModules();
  for (const content of [
    utils.formatPropertySnippet(property, { origin: 'https://preview.example' }),
    line.generatePropertyLineMessage(property, 'https://preview.example'),
  ]) {
    assert.deepEqual(propertyUrls(content), ['https://preview.example/properties/CK-RP6NQM']);
    assert.ok(content.includes(property.title));
    assert.ok(content.includes('CK-RP6NQM'));
    assert.ok(!content.includes(encodeURIComponent(property.slug)));
  }
});

test('static marketing snippets and LINE messages retain the site prefix and detail fallback', () => {
  const { utils, line } = loadModules({ staticExport: true, basePath: '/Chantakorn-Property' });
  for (const origin of ['https://preview.example/', 'https://preview.example/Chantakorn-Property/']) {
    for (const content of [
      utils.formatPropertySnippet(property, { origin }),
      line.generatePropertyLineMessage(property, origin),
    ]) {
      assert.deepEqual(propertyUrls(content), ['https://preview.example/Chantakorn-Property/properties/detail/?slug=CK-RP6NQM']);
    }
  }
});

test('D1 links preserve the full lookup identity instead of truncating UUIDs', () => {
  const { links } = loadModules({ propertyBackend: 'cloudflare' });
  const id = '00000000-0000-4000-8000-000000000001';
  assert.equal(links.propertyHref({ id }), '/properties/' + id);
  assert.equal(links.propertyHref({ id, code: 'CK-1234567890AB' }), '/properties/CK-1234567890AB');
  const exported = loadModules({ propertyBackend: 'cloudflare', staticExport: true }).links;
  assert.equal(exported.propertyHref({ id }), '/properties/detail/?slug=' + id);
});
