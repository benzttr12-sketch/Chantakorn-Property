const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = () => new Promise(resolve => setImmediate(resolve));
const profile = (id, role = 'USER') => ({ id, role, full_name: `Member ${id}`, email: `${id}@example.invalid`, avatar_url: '' });
const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flat(Infinity).flatMap(nodes)];
const text = node => node == null ? '' : typeof node !== 'object' ? String(node) : (node.children || []).flat(Infinity).map(text).join('');

function component(relative, helpers = {}) {
  const hooks = [], effects = [], cleanups = [], destinations = [], listeners = new Map(), timers = new Map();
  let cursor = 0, stateWrites = 0, authListener, timerId = 0;
  const router = { replace: value => destinations.push(['replace', value]), push: value => destinations.push(['push', value]) };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: initial => {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], next => { stateWrites++; hooks[index] = typeof next === 'function' ? next(hooks[index]) : next; }];
    },
    useRef: initial => { const index = cursor++; return hooks[index] ||= { current: initial }; },
    useEffect: effect => { const index = cursor++; if (!hooks[index]) { hooks[index] = true; effects.push(effect); } },
  };
  const mocks = {
    react: { ...react, default: react, __esModule: true },
    'next/link': 'Link',
    'next/navigation': { useRouter: () => router, usePathname: () => '/profile' },
    'lucide-react': new Proxy({}, { get: (_object, name) => String(name) }),
    '@/lib/backend': { dataBackend: 'firebase' },
    '@/lib/firebase/client': { auth: {} },
    '@/lib/store/properties-store': { getFavoriteIds: () => [] },
    'firebase/auth': { onAuthStateChanged: (_auth, listener) => { authListener = listener; return () => {}; } },
    '@/lib/auth-helpers': { getStoredUser: () => null, getCurrentUserProfile: async () => null, ...helpers },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports,
    window: {
      scrollY: 0,
      addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: name => listeners.delete(name),
    },
    setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
    require: name => { if (Object.hasOwn(mocks, name)) return mocks[name]; throw new Error(name); },
  });
  return {
    render: () => { cursor = 0; return module.exports.default({}); },
    mount: () => { for (const effect of effects.splice(0)) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); } },
    unmount: () => { for (const cleanup of cleanups.splice(0)) cleanup(); },
    auth: user => authListener(user),
    event: (name, event) => listeners.get(name)?.(event),
    destinations,
    writes: () => stateWrites,
    runTimers: () => { for (const callback of timers.values()) callback(); timers.clear(); },
  };
}

test('Google redirect landing on signup restores staff and member destinations without starting another sign-in', async () => {
  for (const [role, destination] of [['ADMIN', '/admin'], ['AGENT', '/admin'], ['USER', '/favorites']]) {
    const session = deferred();
    const page = component('app/register/page.tsx', {
      getCurrentUserProfile: options => { assert.equal(options.surfaceRedirectError, true); return session.promise; },
      signInWithGoogle: () => { throw new Error('Unexpected duplicate Google flow'); },
    });
    assert.ok(nodes(page.render()).filter(node => node.type === 'button').every(node => node.props.disabled));
    page.mount();
    session.resolve(profile('restored', role));
    await tick();
    assert.deepEqual(page.destinations, [['replace', destination]]);
  }
});

test('signup allows Google retry after session restoration fails and uses replace on success', async () => {
  const page = component('app/register/page.tsx', {
    getCurrentUserProfile: async () => { throw new Error('Session unavailable'); },
    signInWithGoogle: async () => profile('fresh', 'ADMIN'),
  });
  page.render(); page.mount(); await tick();
  const tree = page.render();
  assert.ok(text(tree).includes('Session unavailable'));
  const google = nodes(tree).find(node => node.type === 'button' && node.props.type === 'button');
  assert.equal(google.props.disabled, false);
  await google.props.onClick();
  assert.deepEqual(page.destinations, [['replace', '/admin']]);
});

test('signup ignores a delayed redirect result after leaving the page', async () => {
  const session = deferred();
  const page = component('app/register/page.tsx', { getCurrentUserProfile: () => session.promise });
  page.render(); page.mount(); page.unmount();
  const writes = page.writes();
  session.resolve(profile('old', 'ADMIN')); await tick();
  assert.deepEqual(page.destinations, []);
  assert.equal(page.writes(), writes);
});

test('email registration preserves its success message and delayed destination, and cancels navigation on unmount', async () => {
  for (const leave of [false, true]) {
    const page = component('app/register/page.tsx', { registerWithEmail: async () => profile('new') });
    page.render(); page.mount(); await tick();
    const form = nodes(page.render()).find(node => node.type === 'form');
    await form.props.onSubmit({ preventDefault() {} });
    assert.ok(text(page.render()).includes('สมัครสมาชิกสำเร็จเรียบร้อยแล้ว'));
    assert.deepEqual(page.destinations, []);
    if (leave) page.unmount();
    page.runTimers();
    assert.deepEqual(page.destinations, leave ? [] : [['push', '/favorites']]);
  }
});

for (const relative of ['components/layout/Header.tsx', 'components/profile/ProfileEditor.tsx']) {
  test(`${relative} does not restore a signed-out account after its profile read finishes`, async () => {
    const oldRead = deferred();
    const page = component(relative, { syncFirebaseUserProfile: () => oldRead.promise });
    page.render(); page.mount();
    const pending = page.auth({ uid: 'old' });
    await page.auth(null);
    oldRead.resolve(profile('old', 'ADMIN')); await pending;
    const tree = page.render();
    assert.ok(!text(tree).includes('Member old'));
    assert.ok(!nodes(tree).some(node => node.type === 'input' && node.props.value === 'Member old'));
  });

  test(`${relative} keeps the new account when older reads resolve or reject later`, async () => {
    for (const failOld of [false, true]) {
      const oldRead = deferred(), newRead = deferred();
      const page = component(relative, { syncFirebaseUserProfile: user => user.uid === 'old' ? oldRead.promise : newRead.promise });
      page.render(); page.mount();
      const older = page.auth({ uid: 'old' });
      const newer = page.auth({ uid: 'new' });
      newRead.resolve(profile('new')); await newer;
      if (failOld) oldRead.reject(new Error('Old account lookup failed'));
      else oldRead.resolve(profile('old', 'ADMIN'));
      await older;
      const tree = page.render();
      assert.ok(text(tree).includes('Member new') || nodes(tree).some(node => node.type === 'input' && node.props.value === 'Member new'));
      assert.ok(!text(tree).includes('Member old'));
      assert.ok(!nodes(tree).some(node => node.type === 'input' && node.props.value === 'Member old'));
    }
  });

  test(`${relative} ignores profile completion after unmount`, async () => {
    const read = deferred();
    const page = component(relative, { syncFirebaseUserProfile: () => read.promise });
    page.render(); page.mount();
    const pending = page.auth({ uid: 'old' });
    page.unmount();
    const writes = page.writes();
    read.resolve(profile('old', 'ADMIN')); await pending;
    assert.equal(page.writes(), writes);
  });
}

test('Header does not trust an arbitrary auth-change event to grant its display role', () => {
  const page = component('components/layout/Header.tsx');
  page.render(); page.mount();
  page.event('chantakorn_auth_change', { detail: profile('forged', 'ADMIN') });
  assert.ok(!text(page.render()).includes('Member forged'));
});
