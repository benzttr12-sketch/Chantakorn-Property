const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');

const revision = 'a'.repeat(64);
const preview = { success: true, previewRevision: revision, property: {
  id: 'published-1', title: 'ขายที่ดิน สิงหนคร', price: 6100000, type: 'land', status: 'sale',
  location: 'สิงหนคร สงขลา', imageUrl: 'https://site.test/api/line/property-image?id=published-1',
  detailUrl: 'https://site.test/properties/CK-PUBLIS',
} };

function memoryStorage() {
  const items = new Map();
  return { getItem: key => items.get(key) || null, setItem: (key, value) => items.set(key, value), removeItem: key => items.delete(key) };
}

// Run the component's hooks and event handlers, including reopening the dialog.
function component({ get = preview, post = [], storage = memoryStorage() } = {}) {
  const hooks = [];
  const requests = [];
  let cursor = 0;
  let effects = [];
  let props = { isOpen: true, propertyId: 'published-1', onClose() {} };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], value => { hooks[index] = value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = { current: initial };
      return hooks[index];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = hooks[index];
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
        effects.push(() => { previous?.cleanup?.(); hooks[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/admin/PropertyBroadcastModal.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, console, Date, JSON, Intl, AbortSignal, crypto: { randomUUID }, sessionStorage: storage,
    document: { body: { style: {} }, addEventListener() {}, removeEventListener() {} },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react-dom') return { createPortal: node => node };
      if (name === 'next/image') return 'img';
      if (name === 'lucide-react') return new Proxy({}, { get: (_target, key) => key });
      if (name === '@/lib/line-auth') return { OFFICIAL_LINE_BASIC_ID: '@930xzcyi' };
      if (name === '@/lib/utils') return { getPropertyTypeName: () => 'ที่ดิน' };
      if (name === '@/lib/staff-api') return { fetchStaffApi: async (url, init = {}) => {
        const method = init.method || 'GET';
        requests.push({ url, method, body: init.body && JSON.parse(init.body) });
        if (method === 'GET') return Response.json(get);
        const result = post.shift();
        if (result instanceof Error) throw result;
        if (typeof result === 'function') return result();
        return Response.json(result?.body || { success: true, deliveryStatus: 'accepted' }, { status: result?.status || 200 });
      } };
      throw Error(name);
    },
  });
  function render(update) {
    if (update) props = { ...props, ...update };
    cursor = 0;
    effects = [];
    const node = module.exports.default(props);
    effects.forEach(effect => effect());
    return node;
  }
  async function ready() {
    render();
    await new Promise(resolve => setImmediate(resolve));
    return render();
  }
  function remount() {
    hooks.forEach(hook => hook?.cleanup?.());
    hooks.length = 0;
  }
  return { render, ready, requests, storage, remount };
}

function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...node.children.flatMap(nodes)];
}
function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  return (Array.isArray(node) ? node : node.children).map(text).join('');
}
function sendButton(node) {
  return nodes(node).find(node => node.type === 'button' && text(node) === 'ส่งถึงผู้ติดตามทั้งหมด');
}

test('opening the dialog only reads the preview; audience and server property are visible before sending', async () => {
  const modal = component();
  const output = await modal.ready();
  assert.equal(modal.requests.length, 1);
  assert.equal(modal.requests[0].method, 'GET');
  assert.match(text(output), /ผู้ติดตาม OA @930xzcyi ทั้งหมด/);
  assert.match(text(output), /ขายที่ดิน สิงหนคร/);
  assert.match(text(output), /6,100,000/);
  assert.equal(sendButton(output).props.disabled, false);
  assert.equal(nodes(output).find(node => node.type === 'section').props['aria-modal'], 'true');
});

test('a click sends only property identity, reviewed revision and UUID; rapid double clicks send once', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const modal = component({ post: [() => pending] });
  const button = sendButton(await modal.ready());
  const first = button.props.onClick();
  await button.props.onClick();
  const sends = modal.requests.filter(request => request.method === 'POST');
  assert.equal(sends.length, 1);
  assert.deepEqual(Object.keys(sends[0].body).sort(), ['previewRevision', 'propertyId', 'retryKey']);
  assert.equal(sends[0].body.previewRevision, revision);
  assert.match(sends[0].body.retryKey, /^[0-9a-f-]{36}$/);
  finish(Response.json({ success: true, deliveryStatus: 'accepted', message: 'LINE รับคำขอแล้ว' }));
  await first;
  await button.props.onClick();
  assert.equal(modal.requests.filter(request => request.method === 'POST').length, 1);
  assert.match(text(modal.render()), /LINE รับคำขอแล้ว/);
  assert.equal(modal.storage.getItem('chantakorn_line_broadcast:published-1'), null);
});

test('unknown results retain the original key and revision across dialog remounts', async () => {
  const storage = memoryStorage();
  const first = component({ storage, post: [new Error('network down')] });
  await sendButton(await first.ready()).props.onClick();
  const firstSend = first.requests.find(request => request.method === 'POST').body;
  assert.match(text(first.render()), /ยังยืนยันการส่งไม่ได้/);
  const reopened = component({ storage });
  await sendButton(await reopened.ready()).props.onClick();
  assert.deepEqual(reopened.requests.find(request => request.method === 'POST').body, firstSend);
});

test('disabled browser storage still retains the same key after the parent remounts the dialog', async () => {
  const storage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
  const modal = component({ storage, post: [new Error('network down')] });
  await sendButton(await modal.ready()).props.onClick();
  const firstSend = modal.requests.find(request => request.method === 'POST').body;
  modal.remount();
  await sendButton(await modal.ready()).props.onClick();
  assert.deepEqual(modal.requests.filter(request => request.method === 'POST')[1].body, firstSend);
});

test('a refresh during dispatch stores an uncertain key that survives a rejected retry', async () => {
  const storage = memoryStorage();
  const first = component({ storage, post: [() => new Promise(() => {})] });
  void sendButton(await first.ready()).props.onClick();
  const saved = storage.getItem('chantakorn_line_broadcast:published-1');
  assert.equal(JSON.parse(saved).uncertain, true);
  const reopened = component({ storage, post: [{ status: 401, body: { success: false, deliveryStatus: 'rejected', message: 'เข้าสู่ระบบอีกครั้ง' } }] });
  await sendButton(await reopened.ready()).props.onClick();
  assert.equal(storage.getItem('chantakorn_line_broadcast:published-1'), saved);
});

test('an accepted-looking failure or simulated response never displays acceptance', async () => {
  for (const result of [
    { status: 502, body: { success: true, deliveryStatus: 'accepted', message: 'ไม่ผ่าน' } },
    { body: { success: true, simulated: true, deliveryStatus: 'simulated', message: 'เป็นการจำลอง' } },
  ]) {
    const modal = component({ post: [result] });
    await sendButton(await modal.ready()).props.onClick();
    assert.ok(sendButton(modal.render()));
    assert.doesNotMatch(text(modal.render()), /LINE รับคำขอแล้ว/);
  }
});

test('a changed or expired uncertain request requires an explicit new attempt after checking prior messages', async () => {
  for (const attempt of [
    { previewRevision: 'b'.repeat(64), startedAt: Date.now() },
    { previewRevision: revision, startedAt: Date.now() - 24 * 60 * 60 * 1000 },
  ]) {
    const storage = memoryStorage();
    storage.setItem('chantakorn_line_broadcast:published-1', JSON.stringify({ ...attempt, retryKey: randomUUID(), uncertain: true }));
    const modal = component({ storage });
    await sendButton(await modal.ready()).props.onClick();
    assert.equal(modal.requests.filter(request => request.method === 'POST').length, 0);
    const output = modal.render();
    assert.equal(sendButton(output).props.disabled, true);
    assert.match(text(output), /กรุณาตรวจข้อความใน LINE/);
  }
});

test('a property change after an uncertain request retains the unresolved key for the next preview', async () => {
  const modal = component({ post: [
    { status: 503, body: { success: false, deliveryStatus: 'unknown', message: 'ยังไม่ทราบผล' } },
    { status: 409, body: { success: false, deliveryStatus: 'rejected', code: 'PROPERTY_CHANGED', message: 'ข้อมูลเปลี่ยน กรุณาเปิดตัวอย่างใหม่' } },
  ] });
  await sendButton(await modal.ready()).props.onClick();
  const saved = modal.storage.getItem('chantakorn_line_broadcast:published-1');
  await sendButton(modal.render()).props.onClick();
  assert.equal(modal.storage.getItem('chantakorn_line_broadcast:published-1'), saved);
  assert.equal(sendButton(modal.render()).props.disabled, true);
  assert.match(text(modal.render()), /เปิดตัวอย่างใหม่/);
});

test('an unavailable or draft preview cannot be sent', async () => {
  const modal = component({ get: { success: false, message: 'เผยแพร่ทรัพย์ก่อนส่งให้ลูกค้า' } });
  const output = await modal.ready();
  assert.equal(sendButton(output).props.disabled, true);
  await sendButton(output).props.onClick();
  assert.equal(modal.requests.filter(request => request.method === 'POST').length, 0);
  assert.match(text(output), /เผยแพร่ทรัพย์ก่อนส่งให้ลูกค้า/);
});
