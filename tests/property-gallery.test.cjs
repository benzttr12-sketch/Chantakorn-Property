const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
}
const navigationModule = { exports: {} };
vm.runInNewContext(compile('src/lib/gallery-navigation.ts'), { module: navigationModule, exports: navigationModule.exports });
const navigation = navigationModule.exports;

test('gallery navigation wraps and safely handles empty or single-photo listings', () => {
  assert.equal(navigation.wrapImageIndex(5, 5), 0);
  assert.equal(navigation.wrapImageIndex(-1, 5), 4);
  assert.equal(navigation.wrapImageIndex(2, 1), 0);
  assert.equal(navigation.wrapImageIndex(-1, 0), 0);
});
test('swipe detection changes photos only for intentional horizontal gestures', () => {
  const start = { x: 100, y: 100 };
  assert.equal(navigation.swipeImageDelta(start, { x: 40, y: 105 }), 1);
  assert.equal(navigation.swipeImageDelta(start, { x: 165, y: 102 }), -1);
  for (const end of [{ x: 95, y: 101 }, { x: 60, y: 180 }, { x: 40, y: 160 }, { x: NaN, y: 100 }]) {
    assert.equal(navigation.swipeImageDelta(start, end), 0);
  }
});

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

function gallery(initialImages = ['https://test/image-1.jpg', 'https://test/image-2.jpg']) {
  const hooks = [];
  let cursor = 0;
  let effects = [];
  let props = { id: 'property-1', title: 'Real land', images: initialImages };
  let output;
  const listeners = new Map();
  const elements = new Map();
  const document = { body: { style: { overflow: 'auto' } }, activeElement: null };
  class Element {
    constructor(name) { this.name = name; this.scrollLeft = 0; this.scrollTop = 0; this.scrollWidth = 1000; this.clientWidth = 500; this.scrollHeight = 800; this.clientHeight = 400; }
    focus() { document.activeElement = this; }
    scrollTo(value) { this.lastScroll = value; }
    scrollIntoView() {}
    querySelector() { return new Element('thumb'); }
    querySelectorAll() { return nodes(output).filter(node => node.type === 'button' && !node.props.disabled && nodes(dialog()).includes(node)).map(node => element(node)); }
  }
  const originalFocus = new Element('opener');
  document.activeElement = originalFocus;
  function element(node) {
    const key = node.props['aria-label'] || text(node);
    if (!elements.has(key)) elements.set(key, new Element(key));
    return elements.get(key);
  }
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = { current: initial }; return hooks[index]; },
    useCallback(callback) { cursor++; return callback; },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = hooks[index];
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) effects.push(() => { previous?.cleanup?.(); hooks[index] = { deps, cleanup: effect() }; });
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(compile('src/components/properties/PropertyGallery.tsx'), {
    module, exports: module.exports, console, document, HTMLElement: Element, setTimeout, clearTimeout,
    window: { addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react-dom') return { createPortal: node => node };
      if (name === 'next/image') return 'img';
      if (name === 'lucide-react') return new Proxy({}, { get: (_target, key) => key });
      if (name === '@/lib/gallery-navigation') return navigation;
      if (name === '@/lib/store/properties-store') return { getFavoriteIds: () => [], toggleFavoriteId: () => true };
      throw Error(name);
    },
  });
  function render(update) {
    if (update) props = { ...props, ...update };
    cursor = 0; effects = [];
    output = module.exports.default(props);
    for (const node of nodes(output)) if (node.props.ref) node.props.ref.current = node.type === 'button' ? element(node) : new Element(node.props.role || 'viewport');
    effects.forEach(effect => effect());
    return output;
  }
  function dialog() { return nodes(output).find(node => node.props.role === 'dialog'); }
  function button(label, within = output) { return nodes(within).find(node => node.type === 'button' && (node.props['aria-label'] === label || text(node).includes(label))); }
  function key(key, shiftKey = false) { const event = { key, shiftKey, target: document.activeElement, preventDefault() { this.prevented = true; } }; listeners.get('keydown')?.(event); return event; }
  function gesture(start, end, within = output) {
    const container = nodes(within).find(node => node.props.onPointerDown);
    const target = { closest: () => null };
    const currentTarget = { scrollLeft: 0, scrollTop: 0, hasPointerCapture: () => false, setPointerCapture() {} };
    container.props.onPointerDown({ isPrimary: true, pointerType: 'touch', pointerId: 1, target, currentTarget, clientX: start.x, clientY: start.y });
    container.props.onPointerUp({ pointerId: 1, currentTarget, clientX: end.x, clientY: end.y });
  }
  render(); render();
  return { render, dialog, button, key, gesture, document, originalFocus, element };
}

test('viewer zoom resets on photo navigation and Escape restores scrolling and opener focus', () => {
  const app = gallery();
  app.button('ดูรูปทั้งหมด').props.onClick(); app.render();
  assert.ok(app.dialog());
  assert.equal(app.document.body.style.overflow, 'hidden');
  app.button('ขยายภาพ 2 เท่า', app.dialog()).props.onClick(); app.render();
  assert.equal(app.button('ย่อภาพให้พอดีจอ', app.dialog()).props['aria-pressed'], true);
  app.key('ArrowRight'); app.render();
  assert.match(text(app.dialog()), /ภาพที่ 2 จาก 2/);
  assert.equal(app.button('ขยายภาพ 2 เท่า', app.dialog()).props['aria-pressed'], false);
  app.key('Escape'); app.render();
  assert.equal(app.dialog(), undefined);
  assert.equal(app.document.body.style.overflow, 'auto');
  assert.equal(app.document.activeElement, app.originalFocus);
});

test('Tab and Shift+Tab stay within the fullscreen viewer controls', () => {
  const app = gallery();
  app.button('ดูรูปทั้งหมด').props.onClick(); app.render();
  const first = app.element(app.button('ขยายภาพ 2 เท่า', app.dialog()));
  const last = app.element(app.button('ดูภาพที่ 2', app.dialog()));
  last.focus(); assert.equal(app.key('Tab').prevented, true); assert.equal(app.document.activeElement, first);
  first.focus(); assert.equal(app.key('Tab', true).prevented, true); assert.equal(app.document.activeElement, last);
});

test('a main-photo swipe changes selection without opening the viewer and a later tap still opens it', () => {
  const app = gallery();
  app.gesture({ x: 120, y: 80 }, { x: 40, y: 85 }); app.render();
  app.button('เปิดภาพ 2 แบบเต็มจอ').props.onClick(); app.render();
  assert.equal(app.dialog(), undefined);
  app.gesture({ x: 100, y: 80 }, { x: 100, y: 80 });
  app.button('เปิดภาพ 2 แบบเต็มจอ').props.onClick(); app.render();
  assert.ok(app.dialog());
});

test('swiping in the viewer cannot suppress the next main-photo click after closing', () => {
  const app = gallery();
  app.button('ดูรูปทั้งหมด').props.onClick(); app.render();
  app.gesture({ x: 120, y: 80 }, { x: 40, y: 85 }, app.dialog()); app.render();
  app.key('Escape'); app.render();
  app.button('เปิดภาพ 2 แบบเต็มจอ').props.onClick(); app.render();
  assert.ok(app.dialog());
});

test('removing gallery photos closes the viewer and never substitutes a stock property', () => {
  const app = gallery();
  app.button('ดูรูปทั้งหมด').props.onClick(); app.render();
  app.render({ images: [] }); const output = app.render();
  assert.equal(app.dialog(), undefined);
  assert.equal(app.document.body.style.overflow, 'auto');
  assert.match(text(output), /ยังไม่มีภาพทรัพย์/);
  assert.equal(nodes(output).filter(node => node.type === 'img').length, 0);
  assert.equal(app.button('ดูรูปทั้งหมด').props.disabled, true);
});
