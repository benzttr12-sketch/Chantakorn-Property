const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');

function loadStore({ backend = 'local', supabase = null, firebase = false, firebaseError = null, demoAuth = false } = {}) {
  const sourceRoot = path.resolve(__dirname, '../src');
  const cache = new Map();
  const storage = new Map();
  const context = vm.createContext({
    console, crypto: webcrypto, Event,
    process: { env: { NEXT_PUBLIC_DATA_BACKEND: backend, NEXT_PUBLIC_ENABLE_DEMO_AUTH: String(demoAuth) } },
    window: {
      localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
      },
      dispatchEvent() {},
    },
  });
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const requireModule = name => {
      if (name === '@/lib/supabase/client') return { supabase, isSupabaseConfigured: Boolean(supabase) };
      if (name === '@/lib/firebase/client') return { db: firebase ? {} : null, isFirebaseConfigured: firebase };
      if (name === 'firebase/firestore') return {
        collection: () => ({}), query: () => ({}), where: () => ({}), doc: () => ({}),
        getDocs: async () => { if (firebaseError) throw firebaseError; return { docs: [] }; },
        setDoc: async () => { if (firebaseError) throw firebaseError; },
      };
      const target = name.startsWith('@/') ? path.join(sourceRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
      return load(`${target}.ts`);
    };
    vm.runInContext(`(function(require,module,exports){${compiled}\n})`, context)(requireModule, module, module.exports);
    return module.exports;
  }
  return { store: load(path.join(sourceRoot, 'lib/store/properties-store.ts')), flags: load(path.join(sourceRoot, 'lib/backend.ts')), storage };
}

function queryResult(result) {
  return { select() { return this; }, eq() { return this; }, order() { return this; }, then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); } };
}

test('local drafts remain manageable while excluded from public lists and slug lookup', async () => {
  const { store } = loadStore();
  const first = store.getLocalProperties()[0];
  await store.updateProperty(first.id, { published: false });
  assert.equal((await store.fetchAdminProperties()).some(item => item.id === first.id), true);
  assert.equal((await store.fetchProperties()).some(item => item.id === first.id), false);
  assert.equal(await store.fetchPropertyBySlug(first.slug), null);
});

test('a newly created local listing can be published, viewed, and deleted', async () => {
  const { store } = loadStore();
  const property = await store.createProperty({ ...store.getLocalProperties()[0], slug: 'regression-test', published: false });
  assert.equal(await store.fetchPropertyBySlug(property.slug), null);
  await store.updateProperty(property.id, { published: true });
  assert.equal((await store.fetchPropertyBySlug(property.slug)).id, property.id);
  await store.deleteProperty(property.id);
  assert.equal(await store.fetchPropertyBySlug(property.slug), null);
});

test('Firebase empty and failed responses never fall back to local data', async () => {
  const empty = loadStore({ backend: 'firebase', firebase: true });
  assert.equal((await empty.store.fetchProperties()).length, 0);
  const failed = loadStore({ backend: 'firebase', firebase: true, firebaseError: new Error('backend unavailable') });
  await assert.rejects(failed.store.fetchProperties(), /backend unavailable/);
  await assert.rejects(failed.store.submitInquiry({ name: 'Test', phone: '0000000000', message: 'Test only', inquiry_type: 'inquiry', status: 'new' }), /backend unavailable/);
  assert.equal(failed.storage.size, 0);
});

test('malformed storage does not break browsing; zero price and location filters are respected', async () => {
  const { store, storage } = loadStore();
  storage.set('chantakorn_properties', '{broken');
  assert.ok((await store.fetchProperties()).length > 0);
  assert.equal((await store.fetchProperties({ maxPrice: 0 })).length, 0);
  assert.equal((await store.fetchProperties({ province: 'not-a-province' })).length, 0);
  storage.set('chantakorn_properties', '[null,{},42]');
  assert.equal((await store.fetchProperties()).length, 0);
});

test('duplicate local slugs reject without overwriting the existing property', async () => {
  const { store } = loadStore();
  const first = store.getLocalProperties()[0];
  await assert.rejects(store.createProperty(first), /Slug/);
  await assert.rejects(store.updateProperty('missing', { title: 'Changed' }), /ไม่พบ/);
  assert.equal((await store.fetchPropertyBySlug(first.slug)).title, first.title);
});

test('an empty remote catalog remains empty and remote errors never use sample data', async () => {
  const empty = loadStore({ backend: 'supabase', supabase: { from: () => queryResult({ data: [], error: null }) } });
  assert.equal((await empty.store.fetchProperties()).length, 0);
  const failed = loadStore({ backend: 'supabase', supabase: { from: () => queryResult({ data: null, error: new Error('permission denied') }) } });
  await assert.rejects(failed.store.fetchProperties(), /permission denied/);
});

test('failed live property writes reject and do not mutate browser data', async () => {
  const { store, storage } = loadStore({ backend: 'supabase', supabase: { rpc: async () => ({ data: null, error: new Error('write denied') }) } });
  await assert.rejects(store.createProperty(store.getLocalProperties()[0]), /write denied/);
  assert.equal(storage.has('chantakorn_properties'), false);
});

test('anonymous inquiry creation succeeds without requesting private inbox read access', async () => {
  let inserted;
  const { store } = loadStore({ backend: 'supabase', supabase: { from: () => ({ insert: async row => { inserted = row; return { error: null }; } }) } });
  const result = await store.submitInquiry({ name: 'Visitor', phone: '0810000000', message: 'Please contact me', inquiry_type: 'inquiry', status: 'closed' });
  assert.equal(inserted.id, result.id);
  assert.equal(inserted.status, 'new');
});

test('local inquiry is never reported delivered and real backends cannot enable demo authentication', async () => {
  const local = loadStore({ demoAuth: true });
  assert.equal(local.flags.isDemoAuthEnabled, true);
  await assert.rejects(local.store.submitInquiry({ name: 'Visitor', phone: '0810000000', message: 'Hello', inquiry_type: 'inquiry', status: 'new' }), /LINE/);
  assert.equal(loadStore().flags.isDemoAuthEnabled, false);
  assert.equal(loadStore({ backend: 'firebase', firebase: true, demoAuth: true }).flags.isDemoAuthEnabled, false);
  const missing = loadStore({ backend: 'supabase', demoAuth: true });
  assert.equal(missing.flags.isDemoAuthEnabled, false);
  await assert.rejects(missing.store.fetchProperties(), /ตั้งค่า/);
});
