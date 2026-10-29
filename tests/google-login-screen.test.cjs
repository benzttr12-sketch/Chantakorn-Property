const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function screen({ role = 'ADMIN', failure, existing, redirect, reason } = {}) {
  const hooks = [], effects = [], destinations = [];
  let cursor = 0, popupCalls = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: initial => {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], next => { hooks[index] = next; }];
    },
    useRef: initial => { const index = cursor++; return hooks[index] ||= { current: initial }; },
    useEffect: effect => { const index = cursor++; if (!hooks[index]) { hooks[index] = true; effects.push(effect); } },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/app/login/page.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const mocks = {
    react: { ...react, default: react, __esModule: true },
    'next/link': 'Link',
    'next/navigation': {
      useRouter: () => ({ replace: value => destinations.push(value) }),
      useSearchParams: () => new URLSearchParams({ ...(redirect ? { redirect } : {}), ...(reason ? { reason } : {}) }),
    },
    'lucide-react': new Proxy({}, { get: (_object, name) => String(name) }),
    '@/lib/backend': { dataBackend: 'firebase' },
    '@/lib/auth-helpers': {
      getCurrentUserProfile: async options => { assert.equal(options.surfaceRedirectError, true); return existing || null; },
      signInWithGoogle: async () => { popupCalls++; if (failure) throw failure; return { role }; },
      loginWithEmail: async () => ({ role }),
    },
  };
  vm.runInNewContext(source + '\nexports.testLoginForm = LoginForm;', {
    module, exports: module.exports, URLSearchParams,
    window: { location: { hostname: 'chantakornproperty.com' } },
    document: { createElement() { throw new Error('Unexpected external GIS script'); } },
    console: { error() {} },
    require: name => { if (Object.hasOwn(mocks, name)) return mocks[name]; throw new Error(name); },
  });
  const render = () => { cursor = 0; return module.exports.testLoginForm(); };
  const flush = async () => {
    for (const effect of effects.splice(0)) effect();
    await new Promise(resolve => setImmediate(resolve));
  };
  return { render, flush, destinations, calls: () => popupCalls };
}
const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flat(Infinity).flatMap(nodes)];
const text = node => node == null ? '' : typeof node !== 'object' ? String(node) : (node.children || []).flat(Infinity).map(text).join('');
const googleButton = tree => nodes(tree).find(node => node.props.id === 'google-signin-btn');

test('one Google button waits for session restoration and then uses the Firebase flow', async () => {
  const page = screen();
  assert.equal(googleButton(page.render()).props.disabled, true);
  await page.flush();
  const tree = page.render();
  assert.equal(nodes(tree).filter(node => node.props.id === 'google-signin-btn').length, 1);
  assert.equal(googleButton(tree).props.disabled, false);
  await googleButton(tree).props.onClick();
  assert.equal(page.calls(), 1);
  assert.deepEqual(page.destinations, ['/admin']);
});

test('staff and member logins return to their proper destination using replace', async () => {
  for (const [role, target] of [['AGENT', '/admin'], ['USER', '/profile']]) {
    const page = screen({ role }); page.render(); await page.flush();
    await googleButton(page.render()).props.onClick();
    assert.deepEqual(page.destinations, [target]);
  }
  const alreadySignedIn = screen({ existing: { role: 'ADMIN' } });
  alreadySignedIn.render(); await alreadySignedIn.flush();
  assert.deepEqual(alreadySignedIn.destinations, ['/admin']);
  assert.equal(alreadySignedIn.calls(), 0);
});

test('popup cancellation shows actionable text and leaves the form available without navigation', async () => {
  const page = screen({ failure: Object.assign(new Error('Firebase raw message'), { code: 'auth/popup-closed-by-user' }) });
  page.render(); await page.flush();
  await googleButton(page.render()).props.onClick();
  assert.equal(page.destinations.length, 0);
  const result = page.render();
  assert.ok(text(result).includes('คุณปิดหน้าต่าง Google'));
  assert.ok(!text(result).includes('Firebase raw message'));
  assert.equal(googleButton(result).props.disabled, false);
});

test('a restored member session stays on staff login so a different Google account can be chosen', async () => {
  for (const options of [{ reason: 'admin_required' }, { redirect: '/admin/properties' }]) {
    const page = screen({ ...options, existing: { role: 'USER' } });
    page.render(); await page.flush();
    assert.deepEqual(page.destinations, []);
    assert.equal(googleButton(page.render()).props.disabled, false);
    assert.match(text(page.render()), /เลือกบัญชีเจ้าหน้าที่/);
    await googleButton(page.render()).props.onClick();
    assert.deepEqual(page.destinations, [options.redirect || '/admin']);
  }
});

test('choosing a nonstaff Google account for an admin destination leaves account switching available', async () => {
  const page = screen({ role: 'USER', reason: 'auth_required', redirect: '/admin/properties' });
  page.render(); await page.flush();
  await googleButton(page.render()).props.onClick();
  assert.deepEqual(page.destinations, []);
  const tree = page.render();
  assert.equal(googleButton(tree).props.disabled, false);
  assert.ok(nodes(tree).some(node => node.props.role === 'alert' && /ยังไม่มีสิทธิ์/.test(text(node))));
});

test('login honors local return paths and refuses external or script destinations', async () => {
  for (const [redirect, target] of [['/admin/properties', '/admin/properties'], ['https://untrusted.invalid', '/admin'], ['//untrusted.invalid', '/admin'], ['javascript:alert(1)', '/admin'], ['/\\untrusted.invalid', '/admin']]) {
    const page = screen({ redirect }); page.render(); await page.flush();
    await googleButton(page.render()).props.onClick();
    assert.deepEqual(page.destinations, [target]);
    assert.equal(new URL(page.destinations[0], 'https://chantakornproperty.com').origin, 'https://chantakornproperty.com');
  }
});

test('login rejects control characters that URL parsing can turn into an external destination', async () => {
  for (const control of ['\t', '\n', '\r', '\0', '\u001f', '\u007f']) {
    const page = screen({ redirect: `/${control}/untrusted.invalid` });
    page.render(); await page.flush();
    await googleButton(page.render()).props.onClick();
    assert.deepEqual(page.destinations, ['/admin']);
    assert.equal(new URL(page.destinations[0], 'https://chantakornproperty.com').origin, 'https://chantakornproperty.com');
  }
});
