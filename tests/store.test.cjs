const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');

function loadStore({ backend = 'local', firebase = false, firebaseError = null, firebaseDocuments = [] } = {}) {
  const sourceRoot = path.resolve(__dirname, '../src');
  const cache = new Map();
  const storage = new Map();
  const mediaDocuments = [], deletions = [], submissions = [];
  const deletedField = Symbol('deleted-field');
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  const context = vm.createContext({
    console, crypto: webcrypto, Event, atob, URL, Headers, TextEncoder,
    fetch: async (url, init) => {
      if (firebaseError) throw firebaseError;
      if (url === '/api/properties') return Response.json({ properties: firebaseDocuments.filter(row => row.published) });
      if (url === '/api/inquiries') {
        const submitted = JSON.parse(init.body);
        submissions.push(submitted);
        return Response.json({ inquiry: { ...submitted, created_at: new Date().toISOString() } });
      }
      throw new Error('Unexpected API request');
    },
    process: { env: { NEXT_PUBLIC_DATA_BACKEND: backend, NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND: 'firebase' } },
    localStorage,
    window: {
      location: { origin: 'https://example.com' },
      localStorage,
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
      if (name === '@/lib/firebase/client') return { db: firebase ? {} : null, isFirebaseConfigured: firebase, auth: null, googleProvider: {} };
      if (name === 'firebase/auth') return {
        signInWithPopup: async () => ({ user: {} }),
        signOut: async () => {},
        signInWithEmailAndPassword: async () => ({ user: {} }),
        createUserWithEmailAndPassword: async () => ({ user: {} }),
        updateProfile: async () => {},
        getAuth: () => ({ currentUser: null }),
        GoogleAuthProvider: class {},
      };
      if (name === 'firebase/app') return {
        initializeApp: () => ({}),
        getApps: () => [],
        getApp: () => ({}),
      };
      if (name === 'firebase/firestore') return {
        collection: (_db, collection) => ({ collection }), query: (ref,...constraints) => ({ ...ref,constraints }), where: (field,op,value) => ({field,op,value}), doc: (_db, collection, id) => ({ collection, id }),
        getDocs: async (reference) => { if (firebaseError) throw firebaseError; const rows=reference?.collection==='property_media'?mediaDocuments.filter(item=>item.property_id===reference.constraints?.[0]?.value):firebaseDocuments; return { docs: rows.map(item => ({ id: item.id, data: () => ({ ...item }) })) }; },
        getDocFromServer: async () => ({ exists: () => false, data: () => ({}) }),
        deleteField: () => deletedField,
        setDoc: async (reference, value, options) => {
          if (firebaseError) throw firebaseError;
          if (reference.collection === 'properties') {
            const index = firebaseDocuments.findIndex(item => item.id === reference.id);
            const next = { ...(options?.merge && index >= 0 ? firebaseDocuments[index] : {}), ...value };
            for (const key of Object.keys(next)) if (next[key] === deletedField) delete next[key];
            if (index >= 0) firebaseDocuments[index] = next;
            else firebaseDocuments.push(next);
          }
          if(reference.collection === 'property_media') mediaDocuments.push({...value,id:reference.id});
        },
        deleteDoc: async reference => { if(firebaseError)throw firebaseError; deletions.push(reference); },
        getFirestore: () => ({}),
      };
      if (!name.startsWith('.') && !name.startsWith('@/')) {
        try {
          return require(name);
        } catch {}
      }
      const target = name.startsWith('@/') ? path.join(sourceRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
      return load(`${target}.ts`);
    };
    vm.runInContext(`(function(require,module,exports){${compiled}\n})`, context)(requireModule, module, module.exports);
    return module.exports;
  }
  return { store: load(path.join(sourceRoot, 'lib/store/properties-store.ts')), compare: load(path.join(sourceRoot, 'lib/store/compare-store.ts')), flags: load(path.join(sourceRoot, 'lib/backend.ts')), formatCode: load(path.join(sourceRoot, 'lib/format-code.ts')).formatPropertyCode, storage, deletions, mediaDocuments, submissions };
}

test('local drafts remain manageable while excluded from public lists and every public lookup key', async () => {
  const { store, formatCode } = loadStore();
  const first = store.getLocalProperties()[0];
  await store.updateProperty(first.id, { published: false });
  assert.equal((await store.fetchAdminProperties()).some(item => item.id === first.id), true);
  assert.equal((await store.fetchProperties()).some(item => item.id === first.id), false);
  for (const key of [first.slug, first.id, formatCode(first.id)]) {
    assert.equal(await store.fetchPropertyBySlug(key), null);
  }
});

test('published listings resolve by short code, full id, and legacy Thai slug on both backends', async () => {
  const sample = loadStore().store.getLocalProperties()[0];
  const property = {
    ...sample,
    id: 'c89f3a5b-9d41-477e-8c3b-1e249f0a218d',
    slug: 'ขายที่ดิน-447-ใกล้-มทักษิณสงขลา-6377',
    published: true,
  };
  for (const backend of ['local', 'firebase']) {
    const { store, storage } = loadStore({ backend, firebase: true, firebaseDocuments: [property] });
    if (backend === 'local') storage.set('chantakorn_properties', JSON.stringify([property]));
    for (const key of [property.slug, property.id, 'CK-C89F3A', 'ck-c89f3a']) {
      const found = await store.fetchPropertyBySlug(key);
      assert.equal(found?.id, property.id, `${backend}: ${key}`);
      assert.equal(found?.title, property.title);
    }
    assert.equal(await store.fetchPropertyBySlug('missing-property-key'), null);
  }
});

test('a Firebase draft stays hidden through its short code, full id, and old slug', async () => {
  const sample = loadStore().store.getLocalProperties()[0];
  const draft = {
    ...sample,
    id: 'c89f3a5b-9d41-477e-8c3b-1e249f0a218d',
    slug: 'private-draft-6377',
    published: false,
  };
  const { store } = loadStore({ backend: 'firebase', firebase: true, firebaseDocuments: [draft] });
  assert.equal((await store.fetchAdminProperties()).some(item => item.id === draft.id), true);
  for (const key of [draft.slug, draft.id, 'CK-C89F3A']) {
    assert.equal(await store.fetchPropertyBySlug(key), null);
  }
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

test('failed live property writes reject and do not mutate browser data', async () => {
  const fixture = loadStore().store.getLocalProperties()[0];
  const { store, storage } = loadStore({ backend: 'firebase', firebase: true, firebaseError: new Error('write denied') });
  await assert.rejects(store.createProperty(fixture), /write denied/);
  assert.equal(storage.has('chantakorn_properties'), false);
});

test('anonymous inquiry creation succeeds without requesting private inbox read access', async () => {
  const { store, submissions } = loadStore({ backend: 'firebase', firebase: true });
  const result = await store.submitInquiry({ name: 'Visitor', phone: '0810000000', message: 'Please contact me', inquiry_type: 'inquiry', status: 'closed' });
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0].id, result.id);
  assert.equal(submissions[0].status, 'new');
});

test('local inquiries and an unconfigured Firebase connection never report delivery or use sample data', async () => {
  const local = loadStore();
  await assert.rejects(local.store.submitInquiry({ name: 'Visitor', phone: '0810000000', message: 'Hello', inquiry_type: 'inquiry', status: 'new' }), /LINE/);
  const missing = loadStore({ backend: 'firebase' });
  await assert.rejects(missing.store.fetchProperties(), /ยังไม่ได้ตั้งค่า/);
  await assert.rejects(missing.store.submitInquiry({ name: 'Visitor', phone: '0810000000', message: 'Hello', inquiry_type: 'inquiry', status: 'new' }), /ยังไม่ได้ตั้งค่า/);
  assert.equal(missing.storage.size, 0);
});

test('an explicit backend selection wins over automatic configuration detection', () => {
  const explicitLocal = loadStore({ backend: 'local', firebase: true });
  assert.equal(explicitLocal.flags.dataBackend, 'local');

  const explicitFirebase = loadStore({ backend: 'firebase', firebase: true });
  assert.equal(explicitFirebase.flags.dataBackend, 'firebase');
  assert.throws(() => loadStore({ backend: 'unsupported', firebase: true }));
});

test('comparison respects a supplied empty catalog and retains browser-selected IDs', () => {
  const { store, compare, storage } = loadStore();
  const fixture = store.getLocalProperties()[0];
  storage.set('chantakorn_compare_ids', JSON.stringify([fixture.id]));
  assert.equal(compare.getCompareProperties([fixture])[0].id, fixture.id);
  assert.equal(compare.getCompareProperties([]).length, 0);
  assert.equal(compare.getCompareProperties()[0].id, fixture.id);
  assert.equal(compare.getCompareIds()[0], fixture.id);
});

test('security-sensitive Firebase paths have regression guards', () => {
  const root = path.resolve(__dirname, '..');
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  const authHelpers = fs.readFileSync(path.join(root, 'src/lib/auth-helpers.ts'), 'utf8');
  const adminLayout = fs.readFileSync(path.join(root, 'src/app/admin/layout.tsx'), 'utf8');

  assert.doesNotMatch(rules, /allow\s+write:\s*if\s+true/);
  assert.match(rules, /request\.resource\.data\.role\s*==\s*'USER'/);
  assert.match(rules, /allow delete:\s*if false/);
  assert.doesNotMatch(authHelpers, /ADMIN_EMAILS|endsWith\(['"]@chantakornproperty\.com/);
  assert.doesNotMatch(adminLayout, /localStorage/);
  assert.match(adminLayout, /await getCurrentUserProfile\(\)/);
  assert.match(authHelpers, /await getDocFromServer\(userDocRef\)/);
  assert.doesNotMatch(adminLayout, /getStoredUser|\bgetDoc\(/);
});

test('unrelated Firebase edits never turn missing coordinates into a real parcel pin', async () => {
  const sample = loadStore().store.getLocalProperties()[0];
  const records = [{ ...sample, id: 'missing-coordinates', latitude: null, longitude: null }];
  const { store } = loadStore({ backend: 'firebase', firebase: true, firebaseDocuments: records });
  assert.equal((await store.fetchAdminProperties())[0].coordinates_available, false);
  await store.updateProperty('missing-coordinates', { price: 1000000 });
  assert.equal(records[0].coordinates_available, false);
  assert.equal((await store.fetchAdminProperties())[0].coordinates_available, false);
  await store.updateProperty('missing-coordinates', { latitude: 7.21, longitude: 100.56 });
  const result = (await store.fetchAdminProperties())[0];
  assert.equal(result.coordinates_available, true);
  assert.equal(result.latitude, 7.21);
  assert.equal(result.longitude, 100.56);
});
test('an optional build year stays absent, retains actual values and clears only when explicitly requested', async () => {
  const sample = loadStore().store.getLocalProperties()[0];
  const records = [{ ...sample, id: 'year-review', year_built: 2019, furniture: 'เฟอร์นิเจอร์ของเจ้าของ' }];
  const { store } = loadStore({ backend: 'firebase', firebase: true, firebaseDocuments: records });
  await store.updateProperty('year-review', { title: 'ปรับชื่อประกาศ' });
  assert.equal(records[0].year_built, 2019);
  await store.updateProperty('year-review', { year_built: undefined });
  assert.equal(Object.hasOwn(records[0], 'year_built'), false);
  assert.equal(records[0].furniture, 'เฟอร์นิเจอร์ของเจ้าของ');
  assert.equal((await store.fetchAdminProperties())[0].year_built, undefined);
  await store.updateProperty('year-review', { year_built: 2022 });
  assert.equal(records[0].year_built, 2022);
  const { year_built: _year, ...withoutYear } = sample;
  const created = await store.createProperty({ ...withoutYear, slug: 'no-invented-year', year_built: undefined, published: false });
  assert.equal(Object.hasOwn(records.find(record => record.id === created.id), 'year_built'), false);
});

test('deleting a Firebase listing cleans its individually saved photos only after the parent succeeds', async () => {
  const sample=loadStore().store.getLocalProperties()[0];
  const h=loadStore({backend:'firebase',firebase:true});
  const photo=`data:image/jpeg;base64,${Buffer.alloc(450000,5).toString('base64')}`;
  const created=await h.store.createProperty({...sample,published:false,images:[photo],cover_image:photo});
  assert.equal(h.mediaDocuments.length,1);
  await h.store.deleteProperty(created.id);
  assert.equal(h.deletions[0].collection,'properties');
  assert.equal(h.deletions[1].collection,'property_media');
  assert.equal(h.deletions[1].id,h.mediaDocuments[0].id);
});
