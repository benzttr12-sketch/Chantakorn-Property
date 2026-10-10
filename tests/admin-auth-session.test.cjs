const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load({ role = 'ADMIN', verified = true, readError = false, current = true } = {}) {
  const user = { uid: 'staff-id', email: 'staff@example.com', emailVerified: verified, displayName: 'Team member' };
  let fields = { id: user.uid, full_name: 'Team member', role, avatar_url: '' };
  const state = { reads: 0, failReads: readError, writes: [], events: [], storage: new Map([['chantakorn_auth_user', JSON.stringify({ id: 'forged', full_name: 'Forged', role: 'ADMIN' })]]) };
  const auth = { currentUser: current ? user : null, authStateReady: async () => undefined };
  const moduleUnderTest = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/auth-helpers.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, {
    module: moduleUnderTest, exports: moduleUnderTest.exports,
    window: { localStorage: { getItem: key => state.storage.get(key), removeItem: key => state.storage.delete(key) }, dispatchEvent: event => state.events.push(event) },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    require(name) {
      if (name === '@/lib/firebase/client') return { auth, db: {}, googleProvider: {} };
      if (name === '@/lib/backend') return { dataBackend: 'firebase', isDemoAuthEnabled: false };
      if (name === '@/lib/supabase/client') return { supabase: null };
      if (name === 'firebase/auth') return { updateProfile: async () => undefined };
      if (name === 'firebase/firestore') return {
        doc: (_db, collection, id) => ({ collection, id }),
        getDocFromServer: async () => {
          state.reads++;
          if (state.failReads) throw new Error('Server unavailable');
          return { exists: () => true, data: () => ({ ...fields }) };
        },
        setDoc: async (_ref, updates) => { state.writes.push(updates); fields = { ...fields, ...updates }; },
      };
      throw new Error(name);
    },
  });
  return { api: moduleUnderTest.exports, state, auth };
}

test('admin identity comes from the current session and server role, never forged browser profile', async () => {
  const { api, state } = load();
  assert.equal(api.getStoredUser(), null);
  const profile = await api.getCurrentUserProfile();
  assert.equal(profile.id, 'staff-id');
  assert.equal(profile.role, 'ADMIN');
  assert.equal(state.reads, 1);
  assert.equal(state.storage.has('chantakorn_auth_user'), false);
});

test('unverified email and unknown or ordinary roles cannot become staff profiles', async () => {
  for (const options of [{ verified: false }, { role: 'USER' }, { role: 'OWNER' }]) {
    assert.equal((await load(options).api.getCurrentUserProfile()).role, 'USER');
  }
});

test('server profile failure rejects fresh authorization even with an earlier valid in-memory profile', async () => {
  const { api, state } = load();
  await api.getCurrentUserProfile();
  state.failReads = true;
  await assert.rejects(api.getCurrentUserProfile(), /Server unavailable/);
  assert.equal(state.reads, 2);
});

test('unchanged profile reads do not repeatedly notify or remount admin forms', async () => {
  const { api, state } = load();
  await api.getCurrentUserProfile();
  await api.getCurrentUserProfile();
  assert.equal(state.reads, 2);
  assert.equal(state.events.length, 1);
});

test('profile saving notifies the new display data and excludes role changes', async () => {
  const { api, state } = load();
  await api.getCurrentUserProfile();
  await api.updateCurrentUserProfile({ full_name: 'Updated team name', role: 'USER' });
  assert.equal(state.writes.length, 1);
  assert.equal(state.writes[0].role, undefined);
  assert.equal(state.events.at(-1).detail.full_name, 'Updated team name');
  assert.equal(state.events.at(-1).detail.role, 'ADMIN');
  const notifications = state.events.length;
  await api.getCurrentUserProfile();
  assert.equal(state.events.length, notifications);
});

test('signing out clears verified identity instead of using an earlier staff profile', async () => {
  const { api, auth } = load();
  await api.getCurrentUserProfile();
  auth.currentUser = null;
  assert.equal(await api.getCurrentUserProfile(), null);
  assert.equal(api.getStoredUser(), null);
});
