const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load({ role = 'ADMIN', verified = true, readError = false, current = true, backend = 'firebase', redirect = false, redirectError, popupError, popupWait, startRedirectError } = {}) {
  const user = { uid: 'staff-id', email: 'staff@example.com', emailVerified: verified, displayName: 'Team member' };
  let fields = { id: user.uid, full_name: 'Team member', role, avatar_url: '' };
  const state = { reads: 0, failReads: readError, writes: [], events: [], storage: new Map([['chantakorn_auth_user', JSON.stringify({ id: 'forged', full_name: 'Forged', role: 'ADMIN' })]]) };
  state.redirectCalls = 0;
  state.popupCalls = 0;
  state.startRedirectCalls = 0;
  const auth = { currentUser: current ? user : null, authStateReady: async () => undefined };
  const moduleUnderTest = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/auth-helpers.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, {
    module: moduleUnderTest, exports: moduleUnderTest.exports,
    window: { localStorage: { getItem: key => state.storage.get(key), removeItem: key => state.storage.delete(key) }, dispatchEvent: event => state.events.push(event) },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    require(name) {
      if (name === '@/lib/firebase/client') return { auth, db: {}, googleProvider: {} };
      if (name === '@/lib/backend') return { dataBackend: backend };
      if (name === 'firebase/auth') return {
        updateProfile: async () => undefined,
        getRedirectResult: async () => {
          state.redirectCalls++;
          if (redirectError) throw redirectError;
          if (redirect) auth.currentUser = user;
          return redirect ? { user } : null;
        },
        signInWithPopup: async () => {
          state.popupCalls++;
          await popupWait?.();
          if (popupError) throw popupError;
          auth.currentUser = user;
          return { user };
        },
        signInWithRedirect: async () => {
          state.startRedirectCalls++;
          if (startRedirectError) throw startRedirectError;
          return new Promise(() => {});
        },
      };
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

test('public local preview cannot authenticate or reset a browser-stored demo account', async () => {
  const { api, state } = load({ backend: 'local' });
  assert.equal(await api.getCurrentUserProfile(), null);
  assert.equal(api.getStoredUser(), null);
  assert.equal(state.reads, 0);
  await assert.rejects(api.loginWithEmail('preview@example.test', 'preview-password'), /Firebase/);
  await assert.rejects(api.registerWithEmail('preview@example.test', 'preview-password', 'Preview', ''), /Firebase/);
  await assert.rejects(api.requestPasswordReset('preview@example.test'), /Firebase/);
});

test('login redirect failures retain their Firebase error and cannot look like a signed-out success', async () => {
  const failure = Object.assign(new Error('Redirect rejected'), { code: 'auth/unauthorized-domain' });
  const { api, state } = load({ current: false, redirectError: failure });
  await assert.rejects(api.getCurrentUserProfile({ surfaceRedirectError: true }), error => error === failure);
  assert.equal(state.redirectCalls, 1);
  assert.equal(state.reads, 0);
  assert.equal(state.events.length, 0);
  assert.equal(state.writes.length, 0);
});

test('redirect completion handles both no redirect and a verified identity with a server role', async () => {
  const absent = load({ current: false });
  assert.equal(await absent.api.getCurrentUserProfile({ surfaceRedirectError: true }), null);
  assert.equal(absent.state.reads, 0);
  const pending = load({ current: false, redirect: true, role: 'AGENT' });
  const profile = await pending.api.getCurrentUserProfile({ surfaceRedirectError: true });
  assert.equal(profile.id, 'staff-id'); assert.equal(profile.role, 'AGENT');
  assert.equal(pending.state.reads, 1);
});

test('ordinary session readers can recover a valid signed-in session after an unrelated redirect failure', async () => {
  const { api, state } = load({ redirectError: new Error('Old redirect state') });
  assert.equal((await api.getCurrentUserProfile()).role, 'ADMIN');
  assert.equal(state.reads, 1);
});

test('Google popup completes through Firebase and still derives staff permission from the server', async () => {
  const { api, state } = load({ role: 'USER' });
  const profile = await api.signInWithGoogle();
  assert.equal(profile.role, 'USER');
  assert.equal(state.popupCalls, 1);
  assert.equal(state.startRedirectCalls, 0);
  assert.equal(state.reads, 1);
});

test('Google opens only one popup for concurrent clicks and permits another attempt after completion', async () => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const { api, state } = load({ popupWait: () => wait });
  const first = api.signInWithGoogle(), second = api.signInWithGoogle();
  assert.equal(first, second);
  assert.equal(state.popupCalls, 1);
  release();
  assert.equal((await first).role, 'ADMIN');
  await api.signInWithGoogle();
  assert.equal(state.popupCalls, 2);
});

test('only blocked or unsupported popups fall back to redirect, preserving redirect failures', async () => {
  for (const code of ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment']) {
    const redirectFailure = new Error('Redirect could not start');
    const { api, state } = load({ popupError: Object.assign(new Error(code), { code }), startRedirectError: redirectFailure });
    await assert.rejects(api.signInWithGoogle(), error => error === redirectFailure);
    assert.equal(state.popupCalls, 1);
    assert.equal(state.startRedirectCalls, 1);
    assert.equal(state.reads, 0);
  }
});

test('popup cancellation, network and configuration errors never trigger redirect loops', async () => {
  for (const code of ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/network-request-failed', 'auth/internal-error', 'auth/unauthorized-domain', 'auth/operation-not-allowed']) {
    const failure = Object.assign(new Error(code), { code });
    const { api, state } = load({ popupError: failure });
    await assert.rejects(api.signInWithGoogle(), error => error === failure);
    assert.equal(state.startRedirectCalls, 0);
    assert.equal(state.reads, 0);
  }
  const profileFailure = load({ readError: true });
  await assert.rejects(profileFailure.api.signInWithGoogle(), /Server unavailable/);
  assert.equal(profileFailure.state.startRedirectCalls, 0);
});

test('concurrent session readers consume redirect once and cannot reuse its user after sign-out', async () => {
  const { api, state, auth } = load({ current: false, redirect: true });
  const profiles = await Promise.all([api.getCurrentUserProfile(), api.getCurrentUserProfile()]);
  assert.deepEqual(profiles.map(profile => profile.role), ['ADMIN', 'ADMIN']);
  assert.equal(state.redirectCalls, 1);
  auth.currentUser = null;
  assert.equal(await api.getCurrentUserProfile(), null);
  assert.equal(api.getStoredUser(), null);
  assert.equal(state.redirectCalls, 1);
});

test('successful popup clears a stale redirect failure for future session reads', async () => {
  const failure = Object.assign(new Error('Old redirect failed'), { code: 'auth/internal-error' });
  const { api, auth } = load({ current: false, redirectError: failure });
  await assert.rejects(api.getCurrentUserProfile({ surfaceRedirectError: true }), error => error === failure);
  await api.signInWithGoogle();
  auth.currentUser = null;
  assert.equal(await api.getCurrentUserProfile({ surfaceRedirectError: true }), null);
});
