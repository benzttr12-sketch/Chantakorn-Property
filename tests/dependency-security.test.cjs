const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { mkdtempSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

// Exercise the parser resolved by Next itself, including its formerly nested copy.
const nextRequire = createRequire(require.resolve('next/package.json'));
const postcss = nextRequire('postcss');

test('Next CSS processing does not disclose external maps without a trusted base', async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'chantakorn-postcss-'));
  const mapFile = path.join(fixture, 'private.map');
  const marker = 'PRIVATE_TEST_SOURCE_CONTENT';
  writeFileSync(mapFile, JSON.stringify({ version: 3, sources: ['private.js'], sourcesContent: [marker], names: [], mappings: '' }));
  try {
    for (const location of [mapFile.replaceAll('\\', '/'), path.relative(process.cwd(), mapFile).replaceAll('\\', '/')]) {
      const result = await postcss([]).process(`a{color:red}\n/*# sourceMappingURL=${location} */`, { map: { inline: false } });
      assert.ok(!JSON.stringify(result.map?.toJSON() || {}).includes(marker));
      assert.match(result.css, /color:red/);
    }
  } finally {
    // Delete only the directory created by this test under the system temporary directory.
    assert.equal(path.dirname(path.resolve(fixture)), path.resolve(tmpdir()));
    assert.ok(path.basename(fixture).startsWith('chantakorn-postcss-'));
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('Next CSS stringify escapes style-tag breakouts while preserving normal CSS', () => {
  for (const endTag of ['</style>', '</StYlE>']) {
    const css = postcss.parse(`a{--label:"${endTag}";color:#C9A227}`).toString();
    assert.ok(!/<\/style\b/i.test(css));
    assert.match(css, /color:#C9A227/);
  }
});

test('inline maps from a legitimate CSS producer remain supported', async () => {
  const map = { version: 3, sources: ['original.css'], sourcesContent: ['a{color:red}'], names: [], mappings: 'AAAA' };
  const encoded = Buffer.from(JSON.stringify(map)).toString('base64');
  const result = await postcss([]).process(`a{color:red}\n/*# sourceMappingURL=data:application/json;base64,${encoded} */`, { from: 'compiled.css', to: 'output.css', map: { inline: false } });
  assert.ok(result.map);
  assert.ok(result.map.toJSON().sources.some(source => source.endsWith('original.css')));
});

test('conditional styles resolve modern outline and gradient conflicts', () => {
  const load = require('./load-ts.cjs')();
  const { cn } = load('lib/utils.ts');
  assert.equal(cn('outline-hidden', 'outline-none'), 'outline-none');
  assert.equal(cn('shadow-lg', false && 'shadow-xl', 'shadow-xs'), 'shadow-xs');
  assert.equal(cn('bg-linear-to-r/srgb', 'bg-linear-to-b/srgb'), 'bg-linear-to-b/srgb');
});

test('the migrated stylesheet emits brand colors, gradients and staff controls', async () => {
  const source = path.resolve(__dirname, '../src/app/globals.css');
  const result = await postcss([require('@tailwindcss/postcss')({ optimize: false })]).process(readFileSync(source, 'utf8'), { from: source });
  const css = postcss.parse(result.css);
  const declaration = (selector, property) => {
    let value;
    css.walkRules(selector, rule => rule.walkDecls(property, decl => { value = decl.value; }));
    return value;
  };
  assert.equal(declaration('.bg-navy-950', 'background-color'), '#020812');
  assert.equal(declaration('.text-gold-500', 'color'), '#C9A227');
  assert.equal(declaration('.border-gray-200', 'border-color'), '#e5e7eb');
  assert.match(declaration('.bg-linear-to-r\\/srgb', '--tw-gradient-position'), /to right in srgb/);
  assert.ok(declaration('.no-scrollbar', 'scrollbar-width') === 'none');
  assert.ok(declaration('.admin-primary', 'min-height'));
  assert.ok(!/@(?:apply|utility|config)\b/.test(result.css));
});

test('lint retains client-component and image constraints after removing vulnerable globbing', async () => {
  const { ESLint } = require('eslint');
  const lint = new ESLint({ cwd: path.resolve(__dirname, '..') });
  const [unsafe] = await lint.lintText('"use client"; export default async function Page() { return <img src="/x.jpg" alt="photo" />; }', { filePath: 'src/app/dependency-security-fixture.tsx' });
  assert.ok(unsafe.messages.some(message => message.ruleId === '@next/next/no-async-client-component'));
  assert.ok(unsafe.messages.some(message => message.ruleId === '@next/next/no-img-element' && message.severity === 2));
  const [ordinary] = await lint.lintText('import Image from "next/image"; export default function Page() { return <Image src="/x.jpg" width={20} height={20} alt="photo" />; }', { filePath: 'src/app/dependency-security-fixture.tsx' });
  assert.equal(ordinary.errorCount, 0);
  assert.equal(ordinary.warningCount, 0);
});
