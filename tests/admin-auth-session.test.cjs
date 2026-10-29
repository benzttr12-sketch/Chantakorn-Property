const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load({ role = 'ADMIN', verified = true, readError = false, current = true, backend = 'firebase', redirect = false, redirectError, popupError, popupWait, startRedirectError, missingProfile = false, signOutWait, signOutError, credentialWait, verificationWait } = {}) {
  const user = { uid: 'staff-id', email: 'staff@example.com', emailVerified: verified, displayName: 'Team member' };
  let fields = { id: user.uid, full_name: 'Team member', role, avatar_url: '' };
  const state = { reads: 0, failReads: readError, writes: [], writeTargets: [], authUpdates: [], verificationCalls: 0, events: [], storage: new Map([['chantakorn_auth_user', JSON.stringify({ id: 'forged', full_name: 'Forged', role: 'ADMIN' })]]) };
  state.redirectCalls = 0;
  state.popupCalls = 0;
  state.startRedirectCalls = 0;
  state.signOutCalls = 0;
  state.signOutWait = signOutWait;
  state.signOutError = signOutError;
  const auth = { currentUser: current ? user : null, authStateReady: async () => undefined };
  const credentialResult = () => {
    const resultUser = state.nextCredentialUser || user;
    auth.currentUser = resultUser;
    state.onCredentialUserAssigned?.(resultUser);
    return { user: resultUser };
  };
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
        updateProfile: async (target, updates) => { state.authUpdates.push({ uid: target.uid, updates }); await state.authUpdateWait?.(); Object.assign(target, updates); },
        signInWithEmailAndPassword: async () => { await credentialWait?.(); return credentialResult(); },
        createUserWithEmailAndPassword: async () => { await credentialWait?.(); return credentialResult(); },
        sendEmailVerification: async () => { state.verificationCalls++; await verificationWait?.(); },
        signOut: async () => {
          state.signOutCalls++;
          await state.signOutWait?.();
          if (state.signOutError) throw state.signOutError;
          auth.currentUser = null;
        },
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
          return credentialResult();
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
          const snapshotFields = { ...fields };
          await state.readWait?.();
          if (state.failReads) throw new Error('Server unavailable');
          return { exists: () => !missingProfile, data: () => snapshotFields };
        },
        setDoc: async (ref, updates) => { state.writes.push(updates); state.writeTargets.push(ref.id); await state.writeWait?.(); fields = { ...fields, ...updates }; },
      };
      throw new Error(name);
    },
  });
  return { api: moduleUnderTest.exports, state, auth };
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
const sessionChanged = error => error?.code === 'auth/session-changed';
const tick = () => new Promise(resolve => setImmediate(resolve));

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

test('a profile read finishing after sign-out cannot return, cache or announce the old account', async () => {
  const { api, state, auth } = load();
  const read = deferred(); state.readWait = () => read.promise;
  const pending = api.getCurrentUserProfile();
  await tick(); auth.currentUser = null; read.resolve();
  await assert.rejects(pending, sessionChanged);
  assert.equal(api.getStoredUser(), null);
  assert.equal(state.events.length, 0);
});

test('old reads cannot overwrite a newer account, including a new Firebase User with the same UID', async () => {
  for (const uid of ['other-account', 'staff-id']) {
    const { api, state, auth } = load();
    const previousUser = auth.currentUser;
    const read = deferred(); state.readWait = () => read.promise;
    const pending = api.getCurrentUserProfile();
    await tick();
    const nextUser = { ...previousUser, uid, displayName: 'Current account' };
    auth.currentUser = nextUser;
    state.readWait = undefined;
    const current = await api.syncFirebaseUserProfile(nextUser);
    const notifications = state.events.length;
    read.resolve();
    await assert.rejects(pending, sessionChanged);
    assert.equal(api.getStoredUser(), current);
    assert.equal(state.events.length, notifications);
  }
});

test('logout clears cached identity and invalidates reads before Firebase sign-out finishes', async () => {
  const signOut = deferred();
  const { api, state } = load({ signOutWait: () => signOut.promise });
  await api.getCurrentUserProfile();
  const read = deferred(); state.readWait = () => read.promise;
  const pending = api.getCurrentUserProfile(); await tick();
  const logout = api.logoutUser();
  assert.equal(api.getStoredUser(), null);
  assert.equal(state.events.at(-1).detail, null);
  assert.equal(await api.getCurrentUserProfile(), null);
  const notifications = state.events.length;
  read.resolve();
  await assert.rejects(pending, sessionChanged);
  assert.equal(state.events.length, notifications);
  signOut.resolve(); await logout;
  assert.equal(api.getStoredUser(), null);
});

test('failed logout never restores an invalidated read or old cache; a fresh check can recover', async () => {
  const failure = new Error('Sign-out storage unavailable');
  const { api, state } = load({ signOutError: failure });
  await api.getCurrentUserProfile();
  const read = deferred(); state.readWait = () => read.promise;
  const pending = api.getCurrentUserProfile(); await tick();
  await assert.rejects(api.logoutUser(), error => error === failure);
  assert.equal(api.getStoredUser(), null);
  read.resolve(); await assert.rejects(pending, sessionChanged);
  assert.equal(api.getStoredUser(), null);
  state.readWait = undefined;
  assert.equal((await api.getCurrentUserProfile()).role, 'ADMIN');
});

test('a stale missing-profile read cannot start profile creation after the account changes', async () => {
  const { api, state, auth } = load({ missingProfile: true });
  const read = deferred(); state.readWait = () => read.promise;
  const pending = api.getCurrentUserProfile(); await tick();
  auth.currentUser = { ...auth.currentUser, uid: 'other-account' };
  read.resolve(); await assert.rejects(pending, sessionChanged);
  assert.equal(state.writes.length, 0);
  assert.equal(api.getStoredUser(), null);
});

test('a delayed profile creation cannot publish an identity after sign-out', async () => {
  const { api, state, auth } = load({ missingProfile: true });
  const write = deferred(); state.writeWait = () => write.promise;
  const pending = api.getCurrentUserProfile(); await tick();
  assert.deepEqual(state.writeTargets, ['staff-id']);
  auth.currentUser = null; write.resolve();
  await assert.rejects(pending, sessionChanged);
  assert.equal(api.getStoredUser(), null);
  assert.equal(state.events.length, 0);
});

test('a delayed profile save never updates the replacement Auth user or announces a stale profile', async () => {
  const { api, state, auth } = load();
  await api.getCurrentUserProfile();
  const write = deferred(); state.writeWait = () => write.promise;
  const pending = api.updateCurrentUserProfile({ full_name: 'Saved for previous account' });
  await tick();
  auth.currentUser = { ...auth.currentUser, uid: 'other-account' };
  const notifications = state.events.length;
  write.resolve(); await assert.rejects(pending, sessionChanged);
  assert.deepEqual(state.writeTargets, ['staff-id']);
  assert.equal(state.authUpdates.length, 0);
  assert.equal(state.events.length, notifications);
  assert.equal(api.getStoredUser(), null);
});

test('stored profile display data stops matching immediately when Firebase signs out or replaces its User', async () => {
  for (const replacement of [null, { uid: 'other-account' }, { uid: 'staff-id' }]) {
    const { api, auth } = load();
    await api.getCurrentUserProfile();
    assert.equal(api.getStoredUser().role, 'ADMIN');
    auth.currentUser = replacement;
    assert.equal(api.getStoredUser(), null);
  }
});

test('credentials completing after logout cannot return or announce an obsolete sign-in attempt', async () => {
  for (const method of ['google', 'email', 'register']) {
    const credential = deferred();
    const { api, state, auth } = load({ current: false, popupWait: () => credential.promise, credentialWait: () => credential.promise });
    const pending = method === 'google' ? api.signInWithGoogle()
      : method === 'email' ? api.loginWithEmail('fixture@example.test', 'fixture-password')
      : api.registerWithEmail('fixture@example.test', 'fixture-password', 'Fixture user', '');
    await api.logoutUser();
    const notifications = state.events.length;
    credential.resolve(); await assert.rejects(pending, sessionChanged);
    assert.equal(auth.currentUser, null);
    assert.equal(await api.getCurrentUserProfile(), null);
    assert.equal(api.getStoredUser(), null);
    assert.equal(state.reads, 0);
    assert.equal(state.writes.length, 0);
    assert.equal(state.verificationCalls, 0);
    assert.equal(state.events.length, notifications);
  }
});

test('obsolete credential observers stay blocked until cleanup finishes, before the credential Promise returns', async () => {
  for (const method of ['google', 'email', 'register']) {
    const credential = deferred(), cleanup = deferred();
    const { api, state, auth } = load({ current: false, popupWait: () => credential.promise, credentialWait: () => credential.promise });
    let observer;
    state.onCredentialUserAssigned = user => { observer = api.syncFirebaseUserProfile(user).catch(error => error); };
    const pending = method === 'google' ? api.signInWithGoogle()
      : method === 'email' ? api.loginWithEmail('fixture@example.test', 'fixture-password')
      : api.registerWithEmail('fixture@example.test', 'fixture-password', 'Fixture user', '');
    const rejection = assert.rejects(pending, sessionChanged);
    await api.logoutUser();
    state.signOutWait = () => cleanup.promise;
    credential.resolve(); await tick();
    assert.ok(auth.currentUser, 'the fixture holds SDK cleanup pending');
    assert.ok(sessionChanged(await observer));
    assert.equal(state.signOutCalls, 2);
    assert.equal(await api.getCurrentUserProfile(), null);
    assert.equal(api.getStoredUser(), null);
    await assert.rejects(api.loginWithEmail('fixture@example.test', 'fixture-password'), sessionChanged);
    assert.equal(state.reads, 0);
    assert.equal(state.events.some(event => event.detail?.role === 'ADMIN'), false);
    cleanup.resolve(); await rejection;
    assert.equal(auth.currentUser, null);
    assert.equal(await api.getCurrentUserProfile(), null);
  }
});

test('failed obsolete-credential cleanup leaves that SDK User blocked and permits a fresh explicit attempt', async () => {
  const credential = deferred();
  const { api, state, auth } = load({ current: false, popupWait: () => credential.promise });
  const pending = api.signInWithGoogle();
  await api.logoutUser();
  state.signOutError = new Error('Cleanup storage unavailable');
  credential.resolve(); await assert.rejects(pending, sessionChanged);
  const rejectedUser = auth.currentUser;
  assert.ok(rejectedUser);
  assert.equal(await api.getCurrentUserProfile(), null);
  await assert.rejects(api.syncFirebaseUserProfile(rejectedUser), sessionChanged);
  assert.equal(api.getStoredUser(), null);
  assert.equal(state.events.some(event => event.detail?.role === 'ADMIN'), false);
  state.signOutError = undefined;
  state.nextCredentialUser = { ...rejectedUser };
  assert.equal((await api.signInWithGoogle()).role, 'ADMIN');
  assert.notEqual(auth.currentUser, rejectedUser);
});

test('obsolete credentials do not sign out a newer replacement User', async () => {
  const credential = deferred();
  const { api, state, auth } = load({ current: false, popupWait: () => credential.promise });
  let replacement;
  state.onCredentialUserAssigned = user => {
    replacement = { ...user, uid: 'replacement-account' };
    auth.currentUser = replacement;
  };
  const pending = api.signInWithGoogle();
  await api.logoutUser();
  credential.resolve(); await assert.rejects(pending, sessionChanged);
  assert.equal(state.signOutCalls, 1);
  assert.equal(auth.currentUser, replacement);
  assert.equal((await api.getCurrentUserProfile()).id, replacement.uid);
});

test('an obsolete blocked popup cannot start a redirect after logout', async () => {
  const popup = deferred();
  const { api, state } = load({ popupWait: () => popup.promise,
    popupError: Object.assign(new Error('Blocked popup'), { code: 'auth/popup-blocked' }),
    startRedirectError: new Error('Unexpected redirect'),
  });
  const pending = api.signInWithGoogle();
  await api.logoutUser();
  popup.resolve(); await assert.rejects(pending, sessionChanged);
  assert.equal(state.startRedirectCalls, 0);
});

test('registration cannot report success after logout while verification is pending', async () => {
  const verification = deferred();
  const { api, state } = load({ verificationWait: () => verification.promise });
  const pending = api.registerWithEmail('fixture@example.test', 'fixture-password', 'Fixture user', '');
  await tick(); assert.equal(state.verificationCalls, 1);
  await api.logoutUser();
  const notifications = state.events.length;
  verification.resolve(); await assert.rejects(pending, sessionChanged);
  assert.equal(api.getStoredUser(), null);
  assert.equal(state.events.length, notifications);
});

test('Auth profile updates keep the captured User and reject a replacement while the update is pending', async () => {
  const { api, state, auth } = load();
  await api.getCurrentUserProfile();
  const previousUser = auth.currentUser;
  const update = deferred(); state.authUpdateWait = () => update.promise;
  const pending = api.updateCurrentUserProfile({ full_name: 'Changed previous account' });
  await tick(); assert.equal(state.authUpdates.length, 1);
  const replacement = { ...previousUser, displayName: 'Current account' };
  auth.currentUser = replacement;
  const notifications = state.events.length;
  update.resolve(); await assert.rejects(pending, sessionChanged);
  assert.equal(previousUser.displayName, 'Changed previous account');
  assert.equal(replacement.displayName, 'Current account');
  assert.equal(api.getStoredUser(), null);
  assert.equal(state.events.length, notifications);
});
