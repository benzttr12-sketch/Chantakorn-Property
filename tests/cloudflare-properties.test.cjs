const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const observed = '2026-10-20T00:00:00.000Z';
const newer = '2026-10-20T00:01:00.000Z';
const imageId = '7537cedc-3fbf-4df9-9741-82757f583628';
const sample = { id: 'ck-123456', title: 'Original', images: [], features: [], updated_at: observed };
const source = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/lib/cloudflare-properties.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function load(handler, staff = true) {
  const calls = [];
  const module = { exports: {} };
  const context = vm.createContext({
    console, URL, URLSearchParams, Headers, Blob, Uint8Array, atob,
    process: { env: {
      NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND: 'cloudflare',
      NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN: 'https://staging-api.example.invalid',
    } },
    fetch: async (url, options) => {
      const call = { path: new URL(url).pathname, params: new URL(url).searchParams, ...options };
      calls.push(call);
      assert.equal(call.headers.get('Authorization'), staff ? 'Bearer signed-test-token' : null);
      assert.equal(call.cache, staff ? 'no-store' : 'default');
      return handler(call);
    },
  });
  const requireModule = name => {
    if (name !== '@/lib/firebase/client') throw new Error(name);
    return { auth: { authStateReady: async () => {}, currentUser: { getIdToken: async () => 'signed-test-token' } } };
  };
  vm.runInContext(`(function(require,module,exports){${source}\n})`, context)(requireModule, module, module.exports);
  return { adapter: module.exports, calls };
}

const json = (value, status = 200) => Response.json(value, { status });

test('compatibility catalog rejects malformed pagination rather than returning incomplete results', async () => {
  for (const admin of [false, true]) {
    for (const body of [
      { data: [sample] }, { data: [sample], next_cursor: '' },
      { data: [sample], next_cursor: false }, { data: [sample], next_cursor: 'x'.repeat(513) },
      { data: Array(admin ? 81 : 31).fill(sample), next_cursor: null },
    ]) {
      const { adapter, calls } = load(() => json(body), admin);
      await assert.rejects(adapter.cloudflareListProperties(admin), /หน้าถัดไป/);
      assert.equal(calls.length, 1);
    }
  }
});

test('compatibility catalog follows pages and stops only at explicit null', async () => {
  for (const admin of [false, true]) {
    const { adapter, calls } = load(call => {
      assert.equal(call.params.get('limit'), admin ? '80' : '30');
      return json({ data: [sample], next_cursor: call.params.has('cursor') ? null : 'next' });
    }, admin);
    assert.equal((await adapter.cloudflareListProperties(admin)).length, 2);
    assert.equal(calls.length, 2);
  }
});

test('compatibility catalog stops cursor cycles and rejects catalogs beyond ten pages', async () => {
  for (const admin of [false, true]) {
    const cyclic = load(() => json({ data: [sample], next_cursor: 'repeat' }), admin);
    await assert.rejects(cyclic.adapter.cloudflareListProperties(admin), /cursor ซ้ำ/);
    assert.equal(cyclic.calls.length, 2);
    let n = 0;
    const large = load(() => json({ data: [sample], next_cursor: `next-${++n}` }), admin);
    await assert.rejects(large.adapter.cloudflareListProperties(admin), /Pagination/);
    assert.equal(large.calls.length, 10);
  }
});

test('an old editor cannot overwrite a newer listing or upload images before detecting the conflict', async () => {
  const { adapter, calls } = load(call => {
    assert.equal(call.method, undefined);
    return json({ data: { ...sample, title: 'Saved by another staff member', updated_at: newer } });
  });
  await assert.rejects(adapter.cloudflareUpdateProperty(sample.id, {
    title: 'Old form', images: ['data:image/jpeg;base64,/9j/'],
  }, observed), /ประกาศมีการแก้ไขแล้ว/);
  assert.equal(calls.length, 1);
});

test('updates and deletes require an observed canonical revision before accessing the API', async () => {
  const { adapter, calls } = load(() => { throw new Error('Unexpected request'); });
  for (const revision of [undefined, '', 'invalid', '2026-10-20']) {
    await assert.rejects(adapter.cloudflareUpdateProperty(sample.id, { price: 100 }, revision), /โหลดประกาศใหม่/);
    await assert.rejects(adapter.cloudflareDeleteProperty(sample.id, revision), /โหลดประกาศใหม่/);
  }
  assert.equal(calls.length, 0);
});

test('a successful edit sends the revision originally observed by the caller', async () => {
  const { adapter, calls } = load(call => {
    if (!call.method) return json({ data: sample });
    assert.equal(call.method, 'PATCH');
    assert.deepEqual(JSON.parse(call.body), { updates: { price: 900000 }, expected_updated_at: observed });
    return json({ data: { ...sample, price: 900000, updated_at: newer } });
  });
  const result = await adapter.cloudflareUpdateProperty(sample.id, { price: 900000 }, observed);
  assert.equal(result.price, 900000);
  assert.equal(result.updated_at, newer);
  assert.equal(calls.length, 2);
});

test('an edit racing with an image upload keeps its old revision and surfaces 409 without retrying', async () => {
  const { adapter, calls } = load(call => {
    if (!call.method) return json({ data: sample });
    if (call.method === 'POST') {
      assert.equal(call.path, '/v1/media/properties/' + sample.id);
      return json({ media_id: imageId, media_path: '/v1/media/properties/' + imageId }, 201);
    }
    assert.equal(call.method, 'PATCH');
    assert.equal(JSON.parse(call.body).expected_updated_at, observed);
    return json({ error: 'This listing has changed; reload before editing' }, 409);
  });
  await assert.rejects(adapter.cloudflareUpdateProperty(sample.id, {
    title: 'Old form', images: ['data:image/jpeg;base64,/9j/'],
  }, observed), /listing has changed/);
  assert.deepEqual(calls.map(call => call.method || 'GET'), ['GET', 'POST', 'PATCH']);
});

test('a stale delete sends the observed revision directly and never refreshes it to bypass a conflict', async () => {
  const { adapter, calls } = load(call => {
    assert.equal(call.method, 'DELETE');
    assert.deepEqual(JSON.parse(call.body), { expected_updated_at: observed });
    return json({ error: 'Property not found or revision changed' }, 409);
  });
  await assert.rejects(adapter.cloudflareDeleteProperty(sample.id, observed), /revision changed/);
  assert.equal(calls.length, 1);
});

test('public page makes one bounded anonymous request with filters and cancellation', async () => {
  const controller = new AbortController();
  const { adapter, calls } = load(call => {
    assert.equal(call.params.get('limit'), '24');
    assert.equal(call.params.get('cursor'), 'page-two');
    assert.equal(call.params.get('sortBy'), 'price_asc');
    assert.equal(call.params.get('type'), null);
    assert.equal(call.params.get('bedrooms'), null);
    assert.equal(call.params.get('featured'), 'false');
    assert.deepEqual(JSON.parse(call.params.get('features')), ['สวน']);
    assert.equal(call.signal, controller.signal);
    return json({ data: [sample], next_cursor: 'page-three' });
  }, false);
  const page = await adapter.cloudflarePropertyPage({ type: 'all', bedrooms: 'any', featured: false,
    sortBy: 'price_asc', features: ['สวน'] }, 'page-two', controller.signal);
  assert.equal(calls.length, 1); assert.equal(page.nextCursor, 'page-three');
});

test('public page rejects repeated cursors and oversized pages without fetching more', async () => {
  for (const body of [{ data: [sample], next_cursor: 'same' }, { data: Array(25).fill(sample), next_cursor: null }]) {
    const { adapter, calls } = load(() => json(body), false);
    await assert.rejects(adapter.cloudflarePropertyPage({}, 'same'), /หน้าถัดไป/);
    assert.equal(calls.length, 1);
  }
});
