const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const tick = () => new Promise(resolve => setImmediate(resolve));
const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flat(Infinity).flatMap(nodes)];
const text = node => node == null ? '' : typeof node !== 'object' ? String(node) : (node.children || []).flat(Infinity).map(text).join('');

function layout({ role = 'ADMIN', failLogout = false } = {}) {
  const hooks = [], effects = [], destinations = [], listeners = new Map();
  let cursor = 0, authListener, signingOut = false;
  const router = { replace: value => destinations.push(value) };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: initial => {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], next => { hooks[index] = typeof next === 'function' ? next(hooks[index]) : next; }];
    },
    useRef: initial => { const index = cursor++; return hooks[index] ||= { current: initial }; },
    useEffect: effect => { const index = cursor++; if (!hooks[index]) { hooks[index] = true; effects.push(effect); } },
  };
  const mocks = {
    react: { ...react, default: react, __esModule: true },
    'next/link': 'Link', 'next/image': 'Image',
    'next/navigation': { useRouter: () => router, usePathname: () => '/admin/properties' },
    'lucide-react': new Proxy({}, { get: (_object, name) => String(name) }),
    '@/lib/backend': { dataBackend: 'firebase' },
    '@/lib/firebase/client': { auth: {} },
    '@/lib/store/properties-store': { fetchInquiries: async () => [] },
    '@/components/admin/AdminNavigation': { default: 'Navigation', getAdminPageTitle: () => 'Properties' },
    'firebase/auth': { onAuthStateChanged: (_auth, listener) => { authListener = listener; return () => {}; } },
    '@/lib/auth-helpers': {
      getCurrentUserProfile: async () => signingOut ? null : { id: 'fixture', role, full_name: 'Staff' },
      logoutUser: async () => {
        signingOut = true;
        listeners.get('chantakorn_auth_change')?.();
        await tick();
        if (failLogout) { signingOut = false; throw new Error('Network unavailable'); }
        authListener(null);
      },
    },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/app/admin/layout.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports,
    window: {
      location: { pathname: '/admin/properties', search: '?filter=draft' },
      addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: name => listeners.delete(name),
    },
    require: name => { if (Object.hasOwn(mocks, name)) return mocks[name]; throw new Error(name); },
  });
  return {
    render: () => { cursor = 0; return module.exports.default({ children: 'Protected content' }); },
    mount: () => { for (const effect of effects.splice(0)) effect(); },
    auth: user => authListener(user), destinations,
  };
}

test('a signed-out staff route asks for authentication and preserves the original destination', () => {
  const page = layout(); page.render(); page.mount(); page.auth(null);
  assert.deepEqual(page.destinations, ['/login?reason=auth_required&redirect=%2Fadmin%2Fproperties%3Ffilter%3Ddraft']);
  assert.ok(!text(page.render()).includes('Protected content'));
});

test('staff logout goes to the website without an auth-listener redirect racing it', async () => {
  const page = layout(); page.render(); page.mount(); page.auth({ uid: 'fixture' }); await tick();
  const logout = nodes(page.render()).find(node => node.type === 'button' && node.props['aria-label'] === 'ออกจากระบบ');
  assert.ok(logout);
  await logout.props.onClick();
  assert.deepEqual(page.destinations, ['/']);
});

test('failed logout exposes recovery instead of stranding staff on a checking spinner', async () => {
  const page = layout({ failLogout: true }); page.render(); page.mount(); page.auth({ uid: 'fixture' }); await tick();
  const logout = nodes(page.render()).find(node => node.type === 'button' && node.props['aria-label'] === 'ออกจากระบบ');
  await logout.props.onClick();
  const tree = page.render();
  assert.deepEqual(page.destinations, []);
  assert.match(text(tree), /ออกจากระบบไม่สำเร็จ/);
  assert.ok(nodes(tree).some(node => node.type === 'button' && /ลองใหม่/.test(text(node))));
});

test('a member denied at Admin can open staff login without a logout detour', async () => {
  const page = layout({ role: 'USER' }); page.render(); page.mount(); page.auth({ uid: 'fixture' }); await tick();
  const tree = page.render();
  const switchAccount = nodes(tree).find(node => node.type === 'Link' && /เลือกบัญชีเจ้าหน้าที่/.test(text(node)));
  assert.equal(switchAccount.props.href, '/login?reason=admin_required&redirect=%2Fadmin%2Fproperties');
  assert.ok(!text(tree).includes('Protected content'));
});

test('Google sign-in explicitly offers account choice while retaining the configured first-party handler', () => {
  let parameters, initialized;
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/firebase/client.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const config = { apiKey: 'fixture', projectId: 'fixture', authDomain: 'fixture.firebaseapp.com' };
  vm.runInNewContext(source, {
    module, exports: module.exports, process: { env: {} }, console,
    window: { location: { hostname: 'chantakornproperty.com' } },
    require: name => {
      if (name === 'firebase/app') return { getApps: () => [], initializeApp: value => { initialized = value; return {}; } };
      if (name === 'firebase/auth') return { getAuth: () => ({}), GoogleAuthProvider: class { setCustomParameters(value) { parameters = value; } } };
      if (name === 'firebase/firestore') return { getFirestore: () => ({}) };
      if (name === '../../../firebase-applet-config.json') return { default: config };
      throw new Error(name);
    },
  });
  assert.equal(parameters.prompt, 'select_account');
  assert.equal(initialized.authDomain, 'chantakornproperty.com');
});
