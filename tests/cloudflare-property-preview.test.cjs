const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const origin = 'https://staging-api.example.invalid';
const propertyId = 'c1c00000-0000-4000-8000-000000000001';
const mediaId = 'c1c00000-0000-4000-8000-000000000002';
const src = `${origin}/v1/media/properties/${mediaId}`;
const compile = relative => ts.transpileModule(
  fs.readFileSync(path.join(__dirname, relative), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } },
).outputText;
const source = compile('../src/lib/cloudflare-property-preview.ts');

function load({ apiOrigin = origin, handler = () => new Response('photo', { headers: { 'Content-Type': 'image/png' } }), user, ready } = {}) {
  const calls = [];
  let tokens = 0;
  let authReads = 0;
  const auth = {
    authStateReady: async () => { authReads++; await ready?.(); },
    currentUser: user === null ? null : { getIdToken: async () => { tokens++; return user ? await user() : 'signed-token'; } },
  };
  const module = { exports: {} };
  const context = vm.createContext({ URL, Blob, Uint8Array,
    process: { env: { NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN: apiOrigin } },
    fetch: async (url, options) => { calls.push({ url, ...options }); return handler(url, options); },
  });
  vm.runInContext(`(function(require,module,exports){${source}\n})`, context)(name => {
    assert.equal(name, '@/lib/firebase/client'); return { auth };
  }, module, module.exports);
  return { api: module.exports, calls, tokens: () => tokens, authReads: () => authReads };
}

test('staff preview constructs the parent-scoped endpoint and sends the token only with safe fetch options', async () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    const controller = new AbortController();
    const { api, calls, tokens } = load({ handler: () => new Response('photo', { headers: { 'Content-Type': type } }) });
    assert.equal(api.cloudflarePropertyPreviewUrl(src, propertyId), `${origin}/v1/admin/properties/${propertyId}/media/${mediaId}`);
    const image = await api.fetchStaffPropertyPreview(src, propertyId, controller.signal);
    assert.equal(image.type, type); assert.equal(await image.text(), 'photo');
    assert.equal(tokens(), 1); assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${origin}/v1/admin/properties/${propertyId}/media/${mediaId}`);
    assert.equal(calls[0].headers.Authorization, 'Bearer signed-token');
    assert.equal(calls[0].redirect, 'error'); assert.equal(calls[0].credentials, 'omit');
    assert.equal(calls[0].cache, 'no-store'); assert.equal(calls[0].signal, controller.signal);
  }
});

test('foreign, relative, credential-bearing, noncanonical and malformed media URLs never access staff auth or fetch', async () => {
  const { api, calls, tokens, authReads } = load();
  for (const photo of [
    src.replace('staging-api.example.invalid', 'staging-api.example.invalid.evil.invalid'),
    src.replace('https://', 'http://'), src.replace('https://', 'https://user:pass@'),
    src + '?x=1', src + '#fragment', src + '/', src.replace('/v1/', '/ignored/../v1/'),
    src.replace(mediaId, 'x'.repeat(36)), src.replace('/properties/', '/inquiries/'),
    `/v1/media/properties/${mediaId}`, 'data:image/png;base64,AA==',
    `${origin}/v1/admin/properties/${propertyId}/media/${mediaId}`,
  ]) {
    assert.equal(api.cloudflarePropertyPreviewUrl(photo, propertyId), null);
    await assert.rejects(api.fetchStaffPropertyPreview(photo, propertyId), /ตั้งค่า/);
  }
  for (const id of ['', '../other', propertyId + '/other', 'not-a-uuid'])
    await assert.rejects(api.fetchStaffPropertyPreview(src, id), /ตั้งค่า/);
  assert.equal(calls.length, 0); assert.equal(tokens(), 0); assert.equal(authReads(), 0);
});

test('misconfigured origins fail before reading any Firebase credentials', async () => {
  for (const apiOrigin of ['', 'http://localhost:8787', origin + '/api', origin + '?token=secret', origin + '#x', 'https://user:pass@staging-api.example.invalid']) {
    const { api, calls, tokens, authReads } = load({ apiOrigin });
    await assert.rejects(api.fetchStaffPropertyPreview(src, propertyId), /ตั้งค่า/);
    assert.equal(calls.length, 0); assert.equal(tokens(), 0); assert.equal(authReads(), 0);
  }
});

test('signed-out and canceled requests do not fetch private images', async () => {
  const signedOut = load({ user: null });
  await assert.rejects(signedOut.api.fetchStaffPropertyPreview(src, propertyId), /เข้าสู่ระบบ/);
  assert.equal(signedOut.calls.length, 0);
  const before = new AbortController(); before.abort();
  const canceled = load();
  await assert.rejects(canceled.api.fetchStaffPropertyPreview(src, propertyId, before.signal), { name: 'AbortError' });
  assert.equal(canceled.authReads(), 0); assert.equal(canceled.calls.length, 0);
  const during = new AbortController();
  const tokenWait = load({ user: async () => { during.abort(); return 'signed-token'; } });
  await assert.rejects(tokenWait.api.fetchStaffPropertyPreview(src, propertyId, during.signal), { name: 'AbortError' });
  assert.equal(tokenWait.calls.length, 0);
});

test('preview rejects authorization failures, empty bodies, active image types and dishonest content lengths', async () => {
  for (const response of [
    new Response('Denied', { status: 403 }),
    new Response(null, { headers: { 'Content-Type': 'image/png' } }),
    new Response('', { headers: { 'Content-Type': 'image/png' } }),
    new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } }),
    new Response('<html/>', { headers: { 'Content-Type': 'text/html' } }),
    new Response('photo', { headers: { 'Content-Type': 'image/png', 'Content-Length': '-1' } }),
    new Response('photo', { headers: { 'Content-Type': 'image/png', 'Content-Length': String(2 * 1024 * 1024 + 1) } }),
    new Response(Buffer.alloc(2 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'image/png', 'Content-Length': '1' } }),
  ]) {
    const { api, calls } = load({ handler: () => response });
    await assert.rejects(api.fetchStaffPropertyPreview(src, propertyId));
    assert.equal(calls.length, 1);
  }
});

test('stream size cap cancels the body as soon as it exceeds two MiB', async () => {
  let canceled = false;
  const stream = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); },
    cancel() { canceled = true; },
  });
  const { api } = load({ handler: () => new Response(stream, { headers: { 'Content-Type': 'image/webp' } }) });
  await assert.rejects(api.fetchStaffPropertyPreview(src, propertyId), /2 MiB/);
  assert.equal(canceled, true);
});

test('exactly two MiB is accepted and redirects surface as failure without a second fetch', async () => {
  const bounded = load({ handler: () => new Response(Buffer.alloc(2 * 1024 * 1024), { headers: { 'Content-Type': 'image/png' } }) });
  assert.equal((await bounded.api.fetchStaffPropertyPreview(src, propertyId)).size, 2 * 1024 * 1024);
  const redirect = load({ handler: () => { throw new TypeError('redirect disallowed'); } });
  await assert.rejects(redirect.api.fetchStaffPropertyPreview(src, propertyId), /redirect/);
  assert.equal(redirect.calls.length, 1);
});

// Exercise the component's effect boundary without a browser or network. The hook
// harness controls rendering and cleanup so late fetch completion remains visible.
function imageComponentHarness(backend = 'cloudflare') {
  const source = compile('../src/components/admin/StaffPropertyImage.tsx');
  const module = { exports: {} };
  const requests = [], created = [], revoked = [], firestoreReads = [];
  let state = null, effect, dependencies, cleanup;
  const makeElement = (type, props) => ({ type, props });
  const context = vm.createContext({ AbortController,
    process: { env: { NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND: backend } },
    URL: class extends URL {
      static createObjectURL(blob) { const url = `blob:test-${created.length}`; created.push({ blob, url }); return url; }
      static revokeObjectURL(url) { revoked.push(url); }
    },
  });
  const helper = load().api;
  const requireModule = name => {
    if (name === 'react') return {
      useState: () => [state, value => { state = value; }],
      useEffect: (run, deps) => { effect = { run, deps }; },
    };
    if (name === 'react/jsx-runtime') return { jsx: makeElement, jsxs: makeElement };
    if (name === 'next/image') return { default: 'NextImage' };
    if (name === '@/lib/firebase/client') return { db: {} };
    if (name === 'firebase/firestore') return {
      doc: (_db, collection, id) => ({ collection, id }),
      getDocFromServer: ref => new Promise((resolve, reject) => firestoreReads.push({ ref, resolve, reject })),
    };
    if (name === '@/lib/cloudflare-property-preview') return {
      cloudflarePropertyPreviewUrl: helper.cloudflarePropertyPreviewUrl,
      fetchStaffPropertyPreview: (src, propertyId, signal) => new Promise((resolve, reject) => requests.push({ src, propertyId, signal, resolve, reject })),
    };
    throw new Error(name);
  };
  vm.runInContext(`(function(require,module,exports){${source}\n})`, context)(requireModule, module, module.exports);
  return {
    requests, created, revoked, firestoreReads,
    render(props) {
      const output = module.exports.default(props);
      if (!dependencies || effect.deps.some((value, i) => value !== dependencies[i])) {
        cleanup?.(); cleanup = effect.run(); dependencies = effect.deps;
      }
      return output;
    },
    unmount() { cleanup?.(); },
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('staff image revokes URLs and aborts fetches when replaced or unmounted, ignoring late completions', async () => {
  const image = imageComponentHarness();
  const props = { src, propertyId, alt: 'Saved draft photo', className: 'object-cover' };
  assert.equal(image.render(props).type, 'span');
  image.requests[0].resolve(new Blob(['first'], { type: 'image/png' })); await tick();
  assert.equal(image.render(props).props.src, 'blob:test-0');
  const next = { ...props, src: src.replace(mediaId, 'c1c00000-0000-4000-8000-000000000003') };
  assert.equal(image.render(next).type, 'span');
  assert.equal(image.requests[0].signal.aborted, true);
  assert.deepEqual(image.revoked, ['blob:test-0']);
  image.unmount();
  assert.equal(image.requests[1].signal.aborted, true);
  image.requests[1].resolve(new Blob(['late'], { type: 'image/png' })); await tick();
  assert.equal(image.created.length, 1);
});

test('Firestore and unsaved data URLs retain normal image rendering without staff fetches', () => {
  for (const [backend, photo] of [['firebase', src], ['cloudflare', 'data:image/png;base64,AA=='], ['cloudflare', 'https://other.example.invalid/photo.jpg']]) {
    const image = imageComponentHarness(backend);
    const output = image.render({ src: photo, propertyId, alt: 'Photo' });
    assert.equal(output.props.src, photo); assert.equal(image.requests.length, 0);
  }
});

test('Firestore draft SDK hydration remains private and checks the media parent', async () => {
  const photo = 'data:image/png;base64,AA==';
  for (const matches of [true, false]) {
    const image = imageComponentHarness('firebase');
    const props = { src: `https://site.example.invalid/api/properties/${propertyId}/image?media=${mediaId}`, propertyId, alt: 'Draft' };
    assert.equal(image.render(props).type, 'span');
    assert.equal(image.firestoreReads.length, 1); assert.equal(image.requests.length, 0);
    assert.equal(image.firestoreReads[0].ref.collection, 'property_media');
    assert.equal(image.firestoreReads[0].ref.id, mediaId);
    image.firestoreReads[0].resolve({ data: () => ({ property_id: matches ? propertyId : 'other-property', data_url: photo }) }); await tick();
    const output = image.render(props);
    if (matches) { assert.equal(output.props.src, photo); assert.equal(output.props.className, 'object-cover'); }
    else assert.equal(output.type, 'span');
    image.unmount(); assert.equal(image.created.length, 0);
  }
});

test('a preview authorization error stays a visible placeholder and successful previews revoke on unmount', async () => {
  const props = { src, propertyId, alt: 'Draft' };
  const failed = imageComponentHarness(); failed.render(props);
  failed.requests[0].reject(new Error('Forbidden')); await tick();
  const output = failed.render(props);
  assert.equal(output.type, 'span'); assert.match(output.props.children, /โหลดรูปไม่สำเร็จ/);
  assert.equal(failed.created.length, 0);
  const loaded = imageComponentHarness(); loaded.render(props);
  loaded.requests[0].resolve(new Blob(['photo'], { type: 'image/png' })); await tick();
  assert.equal(loaded.render(props).props.src, 'blob:test-0');
  loaded.unmount(); assert.deepEqual(loaded.revoked, ['blob:test-0']);
});
