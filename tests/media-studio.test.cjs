const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

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
function load(property, clipboardFails = false) {
  const hooks = [], copied = [], downloads = [];
  let cursor = 0;
  const React = {
    createElement: (type, props, ...children) => ({type, props: props || {}, children}),
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], value => {hooks[index] = value;}];
    },
  };
  const module = {exports: {}};
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/admin/PropertyMediaStudio.tsx'), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true},
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, React, Blob,
    navigator: {clipboard: {writeText: async value => {if (clipboardFails) throw Error('denied'); copied.push(value);}}},
    window: {setTimeout() {}},
    URL: {createObjectURL(blob) {downloads.push({blob}); return 'blob:brief';}, revokeObjectURL() {}},
    document: {createElement() {return {click() {Object.assign(downloads.at(-1), {filename: this.download, href: this.href});}};}},
    fetch() {throw Error('Media briefs must not make network requests');},
    require(name) {
      if (name === 'react') return React;
      if (name === 'next/image') return 'Image';
      if (name === 'lucide-react') return new Proxy({}, {get: (_target, key) => key});
      if (name === '@/lib/utils') return {formatPrice: value => String(value), getPropertyTypeName: () => 'ที่ดิน'};
      throw Error(name);
    },
  });
  return {copied, downloads, render() {cursor = 0; return module.exports.default({property});}};
}
const property = {title: 'ที่ดินตัวอย่าง', price: 2400000, property_type: 'land', district: 'หาดใหญ่', province: 'สงขลา', images: []};
function button(output, label) {
  const result = nodes(output).find(node => node.type === 'button' && text(node).includes(label));
  assert.ok(result, label);
  return result;
}

test('media briefs use the selected property, prompt, ratio and style without external services', async () => {
  const studio = load(property);
  nodes(studio.render()).find(node => node.type === 'textarea').props.onChange({target: {value: 'เน้นทางเข้าที่ดิน'}});
  button(studio.render(), '9:16 แนวตั้ง').props.onClick();
  await button(studio.render(), 'คัดลอกบรีฟวิดีโอ').props.onClick();
  assert.ok(studio.copied[0].includes(property.title));
  assert.ok(studio.copied[0].includes('หาดใหญ่ · สงขลา'));
  assert.ok(studio.copied[0].includes('9:16'));
  assert.ok(studio.copied[0].includes('เน้นทางเข้าที่ดิน'));
  nodes(studio.render()).find(node => node.type === 'select').props.onChange({target: {value: 'Industrial Loft'}});
  await button(studio.render(), 'คัดลอกบรีฟภาพ').props.onClick();
  assert.ok(studio.copied[1].includes('Industrial Loft'));
  button(studio.render(), 'ดาวน์โหลดบรีฟภาพ').props.onClick();
  assert.equal(studio.downloads[0].filename, 'property-image-brief.txt');
  const brief = await studio.downloads[0].blob.text();
  assert.ok(brief.includes(property.title));
  assert.ok(brief.includes('Industrial Loft'));
});

test('media briefs require a selected property and expose a usable download fallback when clipboard fails', async () => {
  const empty = load(null).render();
  assert.ok(nodes(empty).filter(node => node.type === 'button' && /คัดลอก|ดาวน์โหลด/.test(text(node))).every(node => node.props.disabled));
  const studio = load(property, true);
  await button(studio.render(), 'คัดลอกบรีฟภาพ').props.onClick();
  assert.ok(nodes(studio.render()).some(node => node.props.role === 'alert' && text(node).includes('ดาวน์โหลดบรีฟ')));
  assert.equal(button(studio.render(), 'ดาวน์โหลดบรีฟภาพ').props.disabled, false);
});
