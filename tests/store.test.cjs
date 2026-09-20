const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');

const plain = value => JSON.parse(JSON.stringify(value));

function loadStore({ backend = 'local', firebase = backend === 'firebase', documents = {}, failOn = [] } = {}) {
  const sourceRoot = path.resolve(__dirname, '../src');
  const cache = new Map();
  const storage = new Map();
  const records = new Map(Object.entries(plain(documents)));
  const calls = [];
  const events = [];
  const blocked = new Set(failOn);
  const context = vm.createContext({
    console, crypto: webcrypto, Event,
    window: {
      localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
      },
      dispatchEvent(event) { events.push(event.type); },
    },
  });
  function record(operation, reference, value) {
    calls.push({ operation, path: reference.path, constraints: reference.constraints, value });
    if (blocked.has(operation)) throw new Error('backend unavailable');
  }
  function assertDefined(value) {
    if (value === undefined) throw new Error('Firestore does not accept undefined');
    if (value && typeof value === 'object') Object.values(value).forEach(assertDefined);
  }
  function documentSnapshot(documentPath) {
    return {
      id: documentPath.split('/').at(-1),
      exists: () => records.has(documentPath),
      data: () => records.has(documentPath) ? plain(records.get(documentPath)) : undefined,
    };
  }
  const firestore = {
    collection: (_db, collection) => ({ path: collection }),
    doc: (_db, collection, id) => ({ path: `${collection}/${id}` }),
    where: (field, operator, value) => ({ field, operator, value }),
    query: (reference, ...constraints) => ({ ...reference, constraints }),
    getDocs: async reference => {
      record('getDocs', reference);
      const docs = [...records.entries()].filter(([documentPath, data]) => {
        if (documentPath.split('/')[0] !== reference.path) return false;
        return (reference.constraints || []).every(constraint => {
          assert.equal(constraint.operator, '==');
          return data[constraint.field] === constraint.value;
        });
      }).map(([documentPath]) => documentSnapshot(documentPath));
      return { docs, empty: docs.length === 0 };
    },
    getDocFromServer: async reference => {
      record('getDocFromServer', reference);
      return documentSnapshot(reference.path);
    },
    setDoc: async (reference, value) => {
      record('setDoc', reference, value);
      assertDefined(value);
      records.set(reference.path, plain(value));
    },
    updateDoc: async (reference, changes) => {
      record('updateDoc', reference, changes);
      assertDefined(changes);
      if (!records.has(reference.path)) throw new Error('document does not exist');
      records.set(reference.path, { ...records.get(reference.path), ...plain(changes) });
    },
    deleteDoc: async reference => {
      record('deleteDoc', reference);
      records.delete(reference.path);
    },
  };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const requireModule = name => {
      if (name === '@/lib/firebase/client') return { db: firebase ? {} : null };
      if (name === '@/lib/backend') return { dataBackend: backend };
      if (name === 'firebase/firestore') return firestore;
      const target = name.startsWith('@/') ? path.join(sourceRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
      return load(`${target}.ts`);
    };
    vm.runInContext(`(function(require,module,exports){${compiled}\n})`, context)(requireModule, module, module.exports);
    return module.exports;
  }
  return { store: load(path.join(sourceRoot, 'lib/store/properties-store.ts')), storage, records, calls, events, blocked };
}

function property(overrides = {}) {
  return {
    id: 'property-1', title: 'House', slug: 'house', description: 'Garden home',
    property_type: 'house', status: 'sale', price: 2500000, province: 'Songkhla',
    district: 'Hat Yai', latitude: 7.0084, longitude: 100.4705,
    bedrooms: 3, bathrooms: 2, parking: 1, land_size: 50, usable_area: 160,
    furniture: 'partial', features: ['garden'], cover_image: 'https://example.com/house.jpg',
    images: ['https://example.com/house.jpg'], featured: false, published: true,
    created_at: '2026-01-01T00:00:00.000Z', ...overrides,
  };
}

const inquiry = {
  name: 'Visitor', phone: '0810000000', message: 'Please contact me',
  inquiry_type: 'inquiry', status: 'new',
};
const profile = { id: 'user-1', full_name: 'Agent', email: 'agent@example.com', role: 'USER', created_at: '2026-01-01T00:00:00.000Z' };

function documents() {
  return {
    'properties/property-1': property(),
    'inquiries/inquiry-1': { ...inquiry, id: 'inquiry-1', created_at: '2026-01-01T00:00:00.000Z' },
    'profiles/user-1': profile,
  };
}

test('published query excludes drafts from public browsing and slug lookup', async () => {
  const { store, calls } = loadStore({ backend: 'firebase', documents: {
    'properties/property-1': property(),
    'properties/draft': property({ id: 'draft', slug: 'draft', published: false }),
  } });
  assert.equal((await store.fetchProperties()).length, 1);
  assert.equal(await store.fetchPropertyBySlug('draft'), null);
  assert.equal((await store.fetchAdminProperties()).length, 2);
  assert.deepEqual(plain(calls[0].constraints), [{ field: 'published', operator: '==', value: true }]);
});

test('empty Firebase collections remain empty and reads never seed data', async () => {
  const { store, storage, calls, records } = loadStore({ backend: 'firebase' });
  storage.set('chantakorn_properties', JSON.stringify([property()]));
  storage.set('chantakorn_users', JSON.stringify([profile]));
  storage.set('chantakorn_inquiries', JSON.stringify([inquiry]));
  for (const read of [store.fetchProperties, store.fetchAdminProperties, store.fetchInquiries, store.fetchUsers]) {
    assert.equal((await read()).length, 0);
  }
  assert.equal(await store.fetchPropertyBySlug('house'), null);
  assert.ok(calls.every(call => call.operation === 'getDocs'));
  assert.equal(records.size, 0);
});

test('Firebase read failures propagate without displaying local records or fabricated users', async () => {
  const { store, storage, calls, records } = loadStore({ backend: 'firebase', failOn: ['getDocs'] });
  storage.set('chantakorn_properties', JSON.stringify([property()]));
  storage.set('chantakorn_users', JSON.stringify([profile]));
  storage.set('chantakorn_inquiries', JSON.stringify([inquiry]));
  const before = [...storage];
  for (const read of [store.fetchProperties, store.fetchAdminProperties, store.fetchInquiries, store.fetchUsers, () => store.fetchPropertyBySlug('house')]) {
    await assert.rejects(read(), /backend unavailable/);
  }
  assert.deepEqual([...storage], before);
  assert.equal(records.size, 0);
  assert.ok(calls.every(call => call.operation === 'getDocs'));
});

test('Firebase property creation, partial editing, publication, and deletion use real records', async () => {
  const { store, records, calls, storage } = loadStore({ backend: 'firebase' });
  const created = await store.createProperty(property({ published: false, address: undefined }));
  assert.equal(await store.fetchPropertyBySlug(created.slug), null);
  assert.equal(records.get(`properties/${created.id}`).address, undefined);
  // A different editor may have changed price since this form was opened.
  records.get(`properties/${created.id}`).price = 2700000;
  calls.length = 0;
  const updated = await store.updateProperty(created.id, {
    title: 'Updated house', published: true, images: [], address: undefined,
    id: 'forged-id', created_at: 'forged-date',
  });
  assert.equal(updated.id, created.id);
  assert.equal(updated.created_at, created.created_at);
  assert.equal(updated.price, 2700000);
  assert.deepEqual(plain(updated.images), []);
  assert.deepEqual(calls.map(call => call.operation), ['updateDoc', 'getDocFromServer']);
  assert.equal('price' in calls[0].value, false);
  assert.equal('id' in calls[0].value, false);
  assert.equal('created_at' in calls[0].value, false);
  assert.equal((await store.fetchPropertyBySlug(created.slug)).title, 'Updated house');
  assert.equal(await store.deleteProperty(created.id), true);
  assert.equal(await store.fetchPropertyBySlug(created.slug), null);
  assert.equal(storage.size, 0);
});

test('failed property, inquiry, and profile writes reject without browser fallback', async () => {
  const { store, records, storage } = loadStore({
    backend: 'firebase', documents: documents(), failOn: ['setDoc', 'updateDoc', 'deleteDoc'],
  });
  storage.set('chantakorn_inquiries', JSON.stringify([{ ...inquiry, id: 'inquiry-1' }]));
  storage.set('chantakorn_users', JSON.stringify([profile]));
  const beforeStorage = [...storage];
  const beforeRecords = plain([...records]);
  const writes = [
    () => store.createProperty(property()),
    () => store.updateProperty('property-1', { title: 'Changed' }),
    () => store.deleteProperty('property-1'),
    () => store.submitInquiry(inquiry),
    () => store.updateInquiryStatus('inquiry-1', 'closed'),
    () => store.updateUserProfile('user-1', { full_name: 'Changed' }),
    () => store.updateUserRole('user-1', 'ADMIN'),
  ];
  for (const write of writes) await assert.rejects(write(), /backend unavailable/);
  assert.deepEqual([...storage], beforeStorage);
  assert.deepEqual(plain([...records]), beforeRecords);
});

test('editing missing records never creates partial property, inquiry, or profile documents', async () => {
  const { store, records } = loadStore({ backend: 'firebase' });
  for (const write of [
    () => store.updateProperty('missing', { title: 'Changed' }),
    () => store.updateInquiryStatus('missing', 'closed'),
    () => store.updateUserProfile('missing', { full_name: 'Changed' }),
    () => store.updateUserRole('missing', 'ADMIN'),
  ]) await assert.rejects(write(), /does not exist/);
  assert.equal(records.size, 0);
});

test('anonymous inquiry submission writes once without reading the private inbox', async () => {
  const { store, calls, records } = loadStore({ backend: 'firebase', failOn: ['getDocs', 'getDocFromServer'] });
  const result = await store.submitInquiry({ ...inquiry, status: 'closed', line_id: undefined });
  assert.equal(result.status, 'new');
  assert.equal(records.get(`inquiries/${result.id}`).status, 'new');
  assert.equal('line_id' in records.get(`inquiries/${result.id}`), false);
  assert.deepEqual(calls.map(call => call.operation), ['setDoc']);
});

test('inquiry status updates preserve message and query only the edited document', async () => {
  const { store, calls } = loadStore({ backend: 'firebase', documents: documents() });
  const result = await store.updateInquiryStatus('inquiry-1', 'contacted');
  assert.equal(result.status, 'contacted');
  assert.equal(result.message, inquiry.message);
  assert.deepEqual(calls.map(call => call.operation), ['updateDoc', 'getDocFromServer']);
  assert.ok(calls.every(call => call.path === 'inquiries/inquiry-1'));
});

test('profile edits preserve account identity and role changes use a separate operation', async () => {
  const { store, records } = loadStore({ backend: 'firebase', documents: documents() });
  await store.updateUserProfile('user-1', {
    full_name: 'Updated agent', phone: undefined, id: 'other', email: 'other@example.com',
    created_at: 'forged', role: 'ADMIN', avatar_url: 'https://example.com/other.jpg',
  });
  const saved = records.get('profiles/user-1');
  assert.equal(saved.full_name, 'Updated agent');
  assert.equal(saved.id, profile.id);
  assert.equal(saved.email, profile.email);
  assert.equal(saved.created_at, profile.created_at);
  assert.equal(saved.role, 'USER');
  assert.equal('avatar_url' in saved, false);
  assert.equal('phone' in saved, false);
  await store.updateUserRole('user-1', 'AGENT');
  assert.equal(records.get('profiles/user-1').role, 'AGENT');
});

test('local preview and missing Firebase configuration cannot perform staff work or deliver inquiries', async () => {
  for (const options of [{ backend: 'local' }, { backend: 'firebase', firebase: false }]) {
    const { store, storage, calls } = loadStore(options);
    for (const operation of [
      () => store.fetchAdminProperties(), () => store.fetchInquiries(), () => store.fetchUsers(),
      () => store.createProperty(property()), () => store.updateProperty('property-1', { title: 'Changed' }),
      () => store.deleteProperty('property-1'), () => store.updateInquiryStatus('inquiry-1', 'closed'),
      () => store.updateUserProfile('user-1', { full_name: 'Changed' }), () => store.updateUserRole('user-1', 'ADMIN'),
    ]) await assert.rejects(operation(), /ตั้งค่า/);
    await assert.rejects(store.submitInquiry(inquiry), /LINE|ตั้งค่า/);
    if (options.backend === 'firebase') await assert.rejects(store.fetchProperties(), /ตั้งค่า/);
    assert.equal(storage.size, 0);
    assert.equal(calls.length, 0);
  }
});

test('malformed preview data remains safe; drafts, zero price, text and sort filters are respected', async () => {
  const { store, storage } = loadStore();
  storage.set('chantakorn_properties', '{broken');
  assert.ok((await store.fetchProperties()).length > 0);
  storage.set('chantakorn_properties', JSON.stringify([
    property({ id: 'free', slug: 'free', price: 0 }),
    property({ id: 'paid', slug: 'paid', price: 100 }),
    property({ id: 'draft', slug: 'draft', published: false }),
    null, {}, 42,
  ]));
  assert.equal((await store.fetchProperties({ maxPrice: 0 })).length, 1);
  assert.equal((await store.fetchProperties({ minPrice: 0, province: 'songkhla', searchQuery: 'GARDEN' })).length, 2);
  assert.equal((await store.fetchProperties({ province: 'elsewhere' })).length, 0);
  assert.equal((await store.fetchProperties({ sortBy: 'price_desc' }))[0].id, 'paid');
  assert.equal(await store.fetchPropertyBySlug('draft'), null);
});

test('favorites are validated and remain local even with Firebase selected', () => {
  const { store, storage, calls, events } = loadStore({ backend: 'firebase' });
  storage.set('chantakorn_favorites', '[null,42,"property-1"]');
  assert.deepEqual(plain(store.getFavoriteIds()), ['property-1']);
  assert.equal(store.toggleFavoriteId('property-2'), true);
  assert.equal(store.toggleFavoriteId('property-1'), false);
  assert.deepEqual(plain(store.getFavoriteIds()), ['property-2']);
  assert.deepEqual(events, ['favorites-updated', 'favorites-updated']);
  assert.equal(calls.length, 0);
});
