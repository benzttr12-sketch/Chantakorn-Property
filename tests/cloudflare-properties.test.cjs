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

function load(handler) {
  const calls = [];
  const module = { exports: {} };
  const context = vm.createContext({
    console, URL, URLSearchParams, Headers, Blob, Uint8Array, atob,
    process: { env: {
      NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND: 'cloudflare',
      NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN: 'https://staging-api.example.invalid',
    } },
    fetch: async (url, options) => {
      const call = { path: new URL(url).pathname, ...options };
      calls.push(call);
      assert.equal(call.headers.get('Authorization'), 'Bearer signed-test-token');
      assert.equal(call.cache, 'no-store');
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
