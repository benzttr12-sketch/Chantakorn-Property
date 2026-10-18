const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const { CURATED_FAQS } = require('./load-ts.cjs')()('lib/faq-data.ts');

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

function faqComponent() {
  const hooks = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], value => {
        hooks[index] = typeof value === 'function' ? value(hooks[index]) : value;
      }];
    },
    useMemo: callback => callback(),
  };
  const moduleScope = { exports: {} };
  const source = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '../src/components/home/RealEstateFAQ.tsx'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } },
  ).outputText;
  vm.runInNewContext(source, {
    module: moduleScope, exports: moduleScope.exports,
    fetch() { throw new Error('FAQ must work without a network connection'); },
    require(name) {
      if (name === 'react') return react;
      if (name === 'lucide-react') return new Proxy({}, { get: (_target, key) => key });
      if (name === '@/lib/faq-data') return { CURATED_FAQS };
      throw new Error(`Unexpected runtime import: ${name}`);
    },
  });
  return () => {
    cursor = 0;
    return moduleScope.exports.default();
  };
}

function button(view, label) {
  const result = nodes(view).find(node => node.type === 'button' && text(node) === label);
  assert.ok(result, `Missing button: ${label}`);
  return result;
}

function questions(view) {
  return nodes(view).filter(node => node.type === 'button' && Object.hasOwn(node.props, 'aria-expanded'));
}

function search(view) {
  return nodes(view).find(node => node.type === 'input' && node.props.type === 'search');
}

test('FAQ renders every curated question immediately without network or generated-answer controls', () => {
  const render = faqComponent();
  const view = render();
  assert.equal(CURATED_FAQS.length, 11);
  assert.equal(new Set(CURATED_FAQS.map(item => item.id)).size, 11);
  assert.equal(questions(view).length, 11);
  assert.equal(nodes(view).filter(node => node.type === 'input').length, 1);
  assert.equal(nodes(view).some(node => node.type === 'form'), false);
  assert.doesNotMatch(text(view), /Gemini|ถาม AI|ดึงคำถามใหม่/);
  assert.ok(nodes(view).some(node => node.type === 'a' && node.props.href === 'https://lin.ee/NMSe28T3'));
});

test('each FAQ category shows its own questions and resets an earlier search', () => {
  const render = faqComponent();
  for (const [label, category] of [
    ['ซื้อบ้าน & คอนโด', 'buying'], ['ฝากขาย & ค่าโอน', 'selling'], ['สินเชื่อธนาคาร', 'loans'],
    ['ขายฝาก & จำนอง', 'consignment'], ['โฉนด & กฎหมาย', 'legal'],
  ]) {
    search(render()).props.onChange({ target: { value: 'no matching question' } });
    button(render(), label).props.onClick();
    const view = render();
    const expected = CURATED_FAQS.filter(item => item.category === category);
    assert.equal(search(view).props.value, '');
    assert.equal(button(view, label).props['aria-pressed'], true);
    assert.deepEqual(questions(view).map(item => item.props.id), Array.from(expected, item => `${item.id}-question`));
    assert.equal(questions(view)[0].props['aria-expanded'], true);
  }
  button(render(), 'ทั้งหมด').props.onClick();
  assert.equal(questions(render()).length, 11);
});

test('FAQ keyword search finds a curated tag, shows no-result guidance, and clears locally', () => {
  const render = faqComponent();
  search(render()).props.onChange({ target: { value: '  ขั้นตอนการซื้อ  ' } });
  assert.deepEqual(questions(render()).map(item => item.props.id), ['faq-buy-02-question']);
  search(render()).props.onChange({ target: { value: 'a deliberately unmatched query' } });
  const empty = render();
  assert.equal(questions(empty).length, 0);
  assert.match(text(empty), /ไม่พบคำถาม/);
  assert.match(text(empty), /ติดต่อทีมงานทาง LINE/);
  button(empty, 'ล้าง').props.onClick();
  assert.equal(questions(render()).length, 11);
});

test('FAQ answers expand and collapse with the selected question', () => {
  const render = faqComponent();
  const questionId = 'faq-buy-02-question';
  const question = view => questions(view).find(item => item.props.id === questionId);
  question(render()).props.onClick();
  const expanded = render();
  assert.equal(question(expanded).props['aria-expanded'], true);
  assert.ok(nodes(expanded).some(node => node.props.id === 'faq-buy-02-answer' && node.props['aria-labelledby'] === questionId));
  assert.match(text(expanded), /ส่งมอบกุญแจและมิเตอร์น้ำ-ไฟ/);
  question(expanded).props.onClick();
  assert.equal(question(render()).props['aria-expanded'], false);
  assert.equal(nodes(render()).some(node => node.props.id === 'faq-buy-02-answer'), false);
});
