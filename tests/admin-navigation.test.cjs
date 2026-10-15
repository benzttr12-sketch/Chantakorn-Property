const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }) };
const moduleUnderTest = { exports: {} };
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/admin/AdminNavigation.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
vm.runInNewContext(source, {
  module: moduleUnderTest, exports: moduleUnderTest.exports, React,
  require(name) {
    if (name === 'next/link') return 'Link';
    if (name === 'lucide-react') return new Proxy({}, { get: (_target, key) => key });
    throw new Error(name);
  },
});
const { default: AdminNavigation, getAdminPageTitle } = moduleUnderTest.exports;

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
function render(pathname, role = 'ADMIN', pendingCount = 0, onNavigate = () => {}) {
  return AdminNavigation({ pathname, role, pendingCount, onNavigate });
}

test('daily work stays visible while all other business pages remain in two native disclosure groups', () => {
  const output = render('/admin/properties/new');
  const disclosures = nodes(output).filter(node => node.type === 'details');
  assert.equal(disclosures.length, 2);
  assert.ok(disclosures.every(node => node.props.open === false));
  const groupedLinks = disclosures.flatMap(nodes).filter(node => node.type === 'Link').map(node => node.props.href);
  assert.equal(groupedLinks.length, 7);
  assert.deepEqual(nodes(output).filter(node => node.type === 'Link' && !groupedLinks.includes(node.props.href)).map(node => node.props.href), ['/admin', '/admin/properties', '/admin/inquiries']);
  assert.deepEqual(groupedLinks, ['/admin/valuation', '/admin/work-phases', '/admin/automation', '/admin/agents', '/admin/reviews', '/admin/users', '/admin/settings']);
  assert.ok(disclosures.every(node => nodes(node).some(child => child.type === 'summary' && /min-h-11/.test(child.props.className))));
});

test('nested tool and settings routes open their own group and identify the active destination', () => {
  for (const [pathname, destination, title, group] of [
    ['/admin/valuation/detail', '/admin/valuation', 'ประเมินราคา / LandsMaps', 'เครื่องมือธุรกิจ'],
    ['/admin/settings/line', '/admin/settings', 'ตั้งค่าระบบ', 'ทีมและเว็บไซต์'],
  ]) {
    const output = render(pathname);
    const open = nodes(output).filter(node => node.type === 'details' && node.props.open);
    assert.equal(open.length, 1);
    assert.ok(text(nodes(open[0]).find(node => node.type === 'summary')).includes(group));
    const selected = nodes(output).filter(node => node.type === 'Link' && node.props['aria-current']);
    assert.equal(selected.length, 1);
    assert.equal(selected[0].props.href, destination);
    assert.equal(selected[0].props['aria-current'], 'location');
    assert.equal(getAdminPageTitle(pathname), title);
  }
  assert.equal(nodes(render('/admin/automation')).find(node => node.type === 'Link' && node.props.href === '/admin/automation').props['aria-current'], 'page');
  assert.equal(getAdminPageTitle('/admin/profile'), 'โปรไฟล์ของฉัน');
});

test('agent navigation retains inquiry count and navigation handler while hiding member administration', () => {
  let navigations = 0;
  const output = render('/admin/inquiries', 'AGENT', 12, () => { navigations++; });
  const links = nodes(output).filter(node => node.type === 'Link');
  assert.equal(links.some(node => node.props.href === '/admin/users'), false);
  assert.ok(links.some(node => node.props.href === '/admin/settings'));
  const inquiries = links.find(node => node.props.href === '/admin/inquiries');
  assert.ok(nodes(inquiries).some(node => node.props['aria-label'] === '12 รายการใหม่'));
  inquiries.props.onClick();
  assert.equal(navigations, 1);
  const team = nodes(output).find(node => node.type === 'details' && text(node).includes('ทีมและเว็บไซต์'));
  assert.ok(nodes(team).some(node => node.props['aria-label'] === '3 เมนู'));
});
