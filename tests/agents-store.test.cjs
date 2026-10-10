const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load({ backend = 'firebase', configured = true, supabase = null, rows = [], profiles = [] } = {}) {
  const state = { rows, profiles, readError: null, writeError: null, writeWait: null, writes: [], events: [], storage: new Map(), storageError: null };
  const cache = new Map();
  const context = vm.createContext({ console, Event,
    CustomEvent: class extends Event { constructor(name, options) { super(name); this.detail = options?.detail; } },
    window: { localStorage: {
      getItem: key => state.storage.get(key) ?? null,
      setItem: (key, value) => { if (state.storageError) throw state.storageError; state.storage.set(key, value); },
    }, dispatchEvent: event => state.events.push(event) },
  });
  const firestore = {
    collection: (_db, name) => ({ name }), doc: (_db, name, id) => ({ name, id }),
    async getDocs(reference) {
      if (state.readError) throw state.readError;
      const records = reference.name === 'profiles' ? state.profiles : state.rows;
      return { empty: records.length === 0, docs: records.map(record => ({ id: record.id, data: () => ({ ...record }) })) };
    },
    async setDoc(reference, value) { state.writes.push({ action: 'save', reference, value }); if (state.writeWait) await state.writeWait; if (state.writeError) throw state.writeError; },
    async deleteDoc(reference) { state.writes.push({ action: 'delete', reference }); if (state.writeError) throw state.writeError; },
  };
  function moduleAt(relative) {
    if (cache.has(relative)) return cache.get(relative);
    const module = { exports: {} };
    const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    function requireModule(name) {
      if (name === '@/lib/backend') return { dataBackend: backend };
      if (name === '@/lib/firebase/client') return { db: configured ? {} : null };
      if (name === '@/lib/supabase/client') return { supabase };
      if (name === 'firebase/firestore') return firestore;
      if (name === '@/data/agents') return { AGENTS: [{ id: 'demo-agent', name: 'Demo', languages: [], experienceYears: 0, closedDeals: 0, rating: 0 }] };
      if (name === '@/data/sample-properties') return { SAMPLE_PROPERTIES: [] };
      if (name === '@/lib/store/agents-store') return moduleAt('lib/store/agents-store.ts');
      if (name === '@/lib/store/property-history-store') return {};
      if (name === '@/lib/store/activity-store') return { logSystemActivity: async () => {} };
      if (name === '@/lib/format-code') return { formatPropertyCode: value => value };
      if (name === '@/lib/staff-api') return {};
      throw Error(name);
    }
    vm.runInContext(`(function(require,module,exports){${compiled}\n})`, context)(requireModule, module, module.exports);
    cache.set(relative, module.exports);
    return module.exports;
  }
  return { store: moduleAt('lib/store/agents-store.ts'), properties: moduleAt('lib/store/properties-store.ts'), state };
}

const agent = { id: 'agent-real', name: 'Agent', phone: '0123456789', email: '', photo_url: '', line_id: '', title: '', facebook: '', bio: '', specialty: '', zone: '', languages: [], experienceYears: 0, closedDeals: 0, rating: 0 };
const plain = value => JSON.parse(JSON.stringify(value));

test('empty cloud agents and profiles stay empty without demo seeds or database writes during reads', async () => {
  const { store, properties, state } = load();
  assert.deepEqual(plain(await store.fetchAgents()), []);
  assert.deepEqual(plain(await properties.fetchUsers()), []);
  assert.equal(state.writes.length, 0);
  assert.equal(state.storage.size, 0);
  await assert.rejects(store.resetAgentsToDefault(), /โหมดทดลอง/);
  assert.equal(state.writes.length, 0);
});

test('configured cloud errors or missing configuration never use browser-local agents or members', async () => {
  for (const backend of ['firebase', 'supabase']) {
    const { store, properties, state } = load({ backend, configured: false });
    state.storage.set('chantakorn_featured_agents_v1', JSON.stringify([agent]));
    await assert.rejects(store.fetchAgents(), /ยังไม่ได้ตั้งค่า/);
    await assert.rejects(properties.fetchUsers(), /ยังไม่ได้ตั้งค่า/);
    await assert.rejects(store.updateAgent(agent.id, agent), /ยังไม่ได้ตั้งค่า/);
    assert.equal(state.writes.length, 0);
    assert.equal(state.storage.size, 1);
  }
});

test('agent success and cache publication wait until cloud persistence finishes', async () => {
  const { store, state } = load({ rows: [agent] });
  await store.fetchAgents();
  const previousEvents = state.events.length;
  let release;
  state.writeWait = new Promise(resolve => { release = resolve; });
  const saving = store.updateAgent(agent.id, { name: 'Updated real name' });
  await Promise.resolve();
  assert.equal(store.getAgents()[0].name, agent.name);
  assert.equal(state.events.length, previousEvents);
  release();
  assert.equal((await saving)[0].name, 'Updated real name');
  assert.equal(state.events.length, previousEvents + 1);
});

test('failed save or delete leaves the confirmed agent cache intact and never shows local success', async () => {
  const { store, state } = load({ rows: [agent] });
  await store.fetchAgents();
  state.writeError = Error('permission-denied');
  const events = state.events.length;
  await assert.rejects(store.updateAgent(agent.id, { name: 'Failed update' }), /permission-denied/);
  await assert.rejects(store.deleteAgent(agent.id), /permission-denied/);
  assert.equal(store.getAgents()[0].name, agent.name);
  assert.equal(state.events.length, events);
  assert.equal(state.storage.size, 0);
});

test('read failures remain failures even when a previous confirmed cache exists', async () => {
  const { store, state } = load({ rows: [agent] });
  await store.fetchAgents();
  state.readError = Error('network unavailable');
  await assert.rejects(store.fetchAgents(), /network unavailable/);
  assert.equal(store.getAgents()[0].name, agent.name);
});

test('profile projection uses real profile fields without writes or invented photos, ratings, experience or deals', async () => {
  const profile = { id: 'real-member', full_name: 'Actual member', email: 'member@example.invalid', role: 'AGENT' };
  const { properties, store, state } = load({ profiles: [profile], rows: [{ ...agent, user_id: profile.id }] });
  await store.fetchAgents();
  await properties.fetchUsers();
  const projected = store.getAgents()[0];
  assert.equal(projected.user_id, profile.id);
  assert.equal(projected.name, profile.full_name);
  assert.equal(projected.photo_url, '');
  assert.equal(projected.phone, agent.phone);
  assert.equal(projected.rating, 0);
  assert.equal(projected.experienceYears, 0);
  assert.equal(projected.closedDeals, 0);
  assert.equal(state.writes.length, 0);
});

test('member reads do not create unsaved featured agents or resurrect a deleted agent', async () => {
  const profile = { id: 'real-member', full_name: 'Actual member', role: 'AGENT' };
  const { properties, store, state } = load({ profiles: [profile] });
  await properties.fetchUsers();
  assert.deepEqual(plain(store.getAgents()), []);
  await store.updateAgent(`agent-${profile.id}`, { name: profile.full_name, user_id: profile.id });
  await store.deleteAgent(`agent-${profile.id}`);
  const writesAfterDeletion = state.writes.length;
  await properties.fetchUsers();
  assert.deepEqual(plain(store.getAgents()), []);
  assert.equal(state.writes.length, writesAfterDeletion);
});

test('local agent compatibility persists only when selected and storage failure never advances cache', async () => {
  const { store, state } = load({ backend: 'local' });
  await store.updateAgent(agent.id, agent);
  assert.equal(state.storage.size, 1);
  assert.equal(state.writes.length, 0);
  state.storageError = Error('quota exceeded');
  await assert.rejects(store.updateAgent(agent.id, { name: 'Unstored' }), /quota exceeded/);
  assert.equal(store.getAgents()[0].name, agent.name);
  const cached = store.getAgents();
  cached[0].name = 'Mutated caller copy';
  assert.equal(store.getAgents()[0].name, agent.name);
});

test('Supabase agents retain extended metadata and database failures propagate without a local fallback', async () => {
  let failed = false;
  let persisted;
  const supabase = { from(table) {
    assert.equal(table, 'agents');
    return { select() { return this; }, order: async () => ({ data: [{ ...agent, metadata: { closedDeals: 7, zone: 'Actual zone' } }], error: failed ? Error('denied') : null }),
      upsert(row) { persisted = row; return { select: async () => ({ data: [{ id: row.id }], error: failed ? Error('denied') : null }) }; },
      delete() { return { eq() { return { select: async () => ({ data: [{ id: agent.id }], error: failed ? Error('denied') : null }) }; } }; },
    };
  } };
  const { store, state } = load({ backend: 'supabase', supabase });
  assert.equal((await store.fetchAgents())[0].closedDeals, 7);
  await store.updateAgent(agent.id, { specialty: 'Confirmed specialty' });
  assert.equal(persisted.metadata.specialty, 'Confirmed specialty');
  assert.equal(persisted.metadata.closedDeals, 7);
  failed = true;
  await assert.rejects(store.updateAgent(agent.id, { name: 'Rejected' }), /denied/);
  await assert.rejects(store.deleteAgent(agent.id), /denied/);
  await assert.rejects(store.fetchAgents(), /denied/);
  assert.equal(store.getAgents()[0].name, agent.name);
  assert.equal(state.storage.size, 0);
});

test('invalid agent metrics and identifiers are rejected before database writes', async () => {
  const { store, state } = load();
  await assert.rejects(store.updateAgent('invalid/id', agent), /รหัส/);
  await assert.rejects(store.updateAgent(agent.id, { ...agent, rating: Infinity }), /ตรวจสอบ/);
  assert.equal(state.writes.length, 0);
});

test('an existing compressed uploaded avatar can be promoted without being replaced by a stock photo', async () => {
  const { store, state } = load();
  const uploaded = `data:image/jpeg;base64,${'a'.repeat(5000)}`;
  const result = await store.updateAgent(agent.id, { ...agent, photo_url: uploaded });
  assert.equal(result[0].photo_url, uploaded);
  assert.equal(state.writes[0].value.photo_url, uploaded);
});
