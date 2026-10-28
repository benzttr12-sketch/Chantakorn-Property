const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '../scripts/build-pages.mjs'), 'utf8')
  .replace(/^(?:import [^\r\n]+;\r?\n)+/, '');

function fixture(t, { buildStatus = 0, catalogFailure = false, restoreFailure = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chantakorn-pages-test-'));
  // Every fixture cleanup is bounded to the unique directory created above.
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('chantakorn-pages-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  function checked(value) {
    const absolute = path.resolve(value);
    const relative = path.relative(root, absolute);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
      throw Object.assign(new Error('Simulated different filesystem outside workspace'), { code: 'EXDEV' });
    return absolute;
  }
  const files = {
    'src/app/api/health/route.ts': 'export const GET = () => new Response("original API");\n',
    'src/app/properties/[slug]/page.tsx': "'use client';\nexport default function Page() { return 'original detail'; }\n",
    'src/lib/generated-static-routes.ts': 'export const BUILT_PROPERTY_ROUTES: readonly string[] = [];\n',
    'src/data/sample-properties.ts': "export const SAMPLE_PROPERTIES = [{\n  id: 'sample-id',\n  slug: 'sample-slug',\n}];\n",
  };
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  let builds = 0;
  const moved = [];
  const context = {
    ...path,
    resolve: (...parts) => path.resolve(root, ...parts),
    existsSync: fs.existsSync,
    readFileSync: fs.readFileSync,
    realpathSync: fs.realpathSync,
    mkdirSync: (target, options) => fs.mkdirSync(checked(target), options),
    mkdtempSync: prefix => fs.mkdtempSync(checked(prefix)),
    renameSync: (from, to) => {
      // This makes the original /tmp backup strategy reproduce CI's EXDEV.
      checked(from); checked(to);
      if (restoreFailure && from.endsWith(`${path.sep}generated-static-routes.ts`) && from.includes(`${path.sep}.tools${path.sep}`))
        throw new Error('Synthetic route restoration failure');
      moved.push([from, to]);
      fs.renameSync(from, to);
    },
    unlinkSync: target => fs.unlinkSync(checked(target)),
    rmdirSync: target => fs.rmdirSync(checked(target)),
    writeFileSync: (target, ...args) => fs.writeFileSync(checked(target), ...args),
    // Only the legacy script uses tmpdir; it points outside this fake mount.
    tmpdir: os.tmpdir,
    process: { cwd: () => root, execPath: process.execPath, pid: process.pid,
      env: catalogFailure ? { DEPLOY_PROPERTY_BACKEND: 'cloudflare', DEPLOY_CLOUDFLARE_API_ORIGIN: 'https://catalog.example.test' } : {} },
    console: { log() {} },
    URL, AbortSignal, AggregateError,
    fetch: async () => { throw new Error('Synthetic catalog failure'); },
    spawnSync: (_node, args, options) => {
      builds++;
      assert.deepEqual(Array.from(args), ['node_modules/next/dist/bin/next', 'build']);
      assert.equal(options.cwd, root);
      assert.equal(options.env.STATIC_EXPORT, 'true');
      assert.equal(options.env.NEXT_PUBLIC_DATA_BACKEND, 'local');
      assert.equal(fs.existsSync(path.join(root, 'src/app/api')), false);
      const wrapper = fs.readFileSync(path.join(root, 'src/app/properties/[slug]/page.tsx'), 'utf8');
      assert.match(wrapper, /generateStaticParams/);
      assert.match(wrapper, /pages-build-client/);
      const routes = fs.readFileSync(path.join(root, 'src/lib/generated-static-routes.ts'), 'utf8');
      assert.ok(routes.includes('sample-id') && routes.includes('sample-slug'));
      fs.mkdirSync(path.join(root, '.next-pages'));
      return { status: buildStatus };
    },
  };
  return {
    root, files, moved, builds: () => builds,
    run: () => vm.runInNewContext(`(async () => {\n${script}\n})()`, context),
    assertRestored() {
      for (const [name, content] of Object.entries(files))
        assert.equal(fs.readFileSync(path.join(root, name), 'utf8'), content, name);
      assert.equal(fs.existsSync(path.join(root, 'src/app/properties/[slug]/pages-build-client.tsx')), false);
      assert.deepEqual(fs.readdirSync(path.join(root, '.tools')), []);
    },
  };
}

test('Pages build stages on the workspace filesystem, preserves static fixtures and restores original sources', async t => {
  const build = fixture(t);
  await build.run();
  assert.equal(build.builds(), 1);
  assert.ok(build.moved.some(([, target]) => target.includes(`${path.sep}.tools${path.sep}pages-build-`)));
  build.assertRestored();
  assert.equal(fs.existsSync(path.join(build.root, '.next-pages/.nojekyll')), true);
});

test('failed Next static build restores API routes, dynamic page and generated route module', async t => {
  const build = fixture(t, { buildStatus: 2 });
  await assert.rejects(build.run(), /Static export failed with exit code 2/);
  build.assertRestored();
  assert.equal(fs.existsSync(path.join(build.root, '.next-pages/.nojekyll')), false);
});

test('catalog failure before generated files exist still restores the original API and detail page', async t => {
  const build = fixture(t, { catalogFailure: true });
  await assert.rejects(build.run(), /Synthetic catalog failure/);
  assert.equal(build.builds(), 0);
  build.assertRestored();
});

test('one restoration failure preserves its backup and does not prevent API restoration', async t => {
  const build = fixture(t, { restoreFailure: true });
  await assert.rejects(build.run(), /Pages build source restoration failed/);
  assert.equal(fs.readFileSync(path.join(build.root, 'src/app/api/health/route.ts'), 'utf8'), build.files['src/app/api/health/route.ts']);
  assert.equal(fs.readFileSync(path.join(build.root, 'src/app/properties/[slug]/page.tsx'), 'utf8'), build.files['src/app/properties/[slug]/page.tsx']);
  const [staging] = fs.readdirSync(path.join(build.root, '.tools'));
  assert.ok(staging.startsWith('pages-build-'));
  assert.equal(fs.readFileSync(path.join(build.root, '.tools', staging, 'generated-static-routes.ts'), 'utf8'), build.files['src/lib/generated-static-routes.ts']);
});
