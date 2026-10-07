const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual component handlers and rendered output with lightweight hooks.
function modal(response) {
  const state = [];
  let cursor = 0;
  let firstRender = true;
  const effects = [];
  const requests = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = value; }];
    },
    useEffect(effect) { if (firstRender) effects.push(effect); },
    useCallback: callback => callback,
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/properties/SendToLineModal.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, console, setTimeout,
    window: { location: { origin: 'https://example.test' } }, document: { body: {} },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react-dom') return { createPortal: node => node };
      if (name === 'lucide-react') return new Proxy({}, { get: (_target, key) => key });
      if (name === '@/lib/line-auth') return { OFFICIAL_LINE_BASIC_ID: '@test-oa' };
      if (name === '@/lib/line-inquiry') return {
        generatePropertyLineMessage: () => 'Property details', getLineShareUrl: () => 'https://example.test/share',
        getLineOaDirectMessageUrl: () => 'https://example.test/chat', OFFICIAL_LINE_OA_URL: 'https://example.test/oa',
        getLineOaChatUrl: () => ({ url: 'https://example.test/oa', mode: 'web' }),
        isMobileDevice: () => false,
      };
      if (name === '@/lib/staff-api') return { fetchStaffApi: async (url, init) => {
        requests.push({ url, body: JSON.parse(init.body) });
        return Response.json(response.body, { status: response.status });
      } };
      throw Error(name);
    },
  });
  function render() {
    cursor = 0;
    const node = module.exports.default({ isOpen: true, onClose() {}, property: { id: 'property-1', title: 'Home' } });
    if (firstRender) {
      firstRender = false;
      effects.forEach(effect => effect());
      return render();
    }
    return node;
  }
  return { render, requests };
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

test('a skipped send displays the server reason and remains retryable, without claiming success', async () => {
  const component = modal({ status: 200, body: { success: true, isRealSent: false, simulated: true, message: 'Automatic notifications are disabled' } });
  const button = nodes(component.render()).find(node => node.type === 'button' && text(node).includes('แจ้งเตือนเข้าหลังบ้าน'));
  await button.props.onClick();
  const output = component.render();
  assert.equal(component.requests[0].body.manualSend, true);
  assert.match(text(output), /Automatic notifications are disabled/);
  assert.doesNotMatch(text(output), /จัดเตรียมข้อความสำเร็จ|แจ้งเตือนเข้าระบบแล้ว/);
  assert.equal(nodes(output).find(node => node.type === 'button' && text(node).includes('แจ้งเตือนเข้าหลังบ้าน')).props.disabled, false);
});

test('only an accepted HTTP response with real send flags shows success', async () => {
  for (const [status, sent] of [[200, true], [502, false]]) {
    const component = modal({ status, body: { success: true, isRealSent: true, error: status === 502 ? 'LINE rejected the request' : undefined } });
    await nodes(component.render()).find(node => node.type === 'button' && text(node).includes('แจ้งเตือนเข้าหลังบ้าน')).props.onClick();
    const output = text(component.render());
    assert.equal(output.includes('แจ้งเตือนเข้าระบบแล้ว'), sent);
    if (!sent) assert.match(output, /LINE rejected the request/);
  }
});
