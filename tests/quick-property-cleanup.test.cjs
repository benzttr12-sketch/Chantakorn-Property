const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');

const load = require('./load-ts.cjs')();
const parser = load('lib/property-text-parser.ts');
const locations = load('data/locations.ts');
const video = load('lib/image-compressor.ts');

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
function component(relative, mocks, props) {
  const hooks = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
    },
    useEffect() {},
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, console, crypto: webcrypto, alert() {},
    require(name) {
      if (name === 'react') return react;
      if (name === 'lucide-react') return new Proxy({}, { get: (_target, key) => key });
      if (Object.hasOwn(mocks, name)) return mocks[name];
      throw new Error(name);
    },
  });
  return { render() { cursor = 0; return module.exports.default(props); } };
}
function quickEntry() {
  const saved = [];
  const requests = [];
  const staff = { id: 'staff-fixture', full_name: 'ทีมงานทดสอบ', role: 'AGENT', avatar_url: '' };
  const modal = component('components/admin/QuickPropertyModal.tsx', {
    '@/lib/store/properties-store': { createProperty: async property => { saved.push(property); } },
    '@/lib/property-text-parser': parser,
    '@/data/locations': locations,
    '@/lib/feng-shui': { calculateFengShui: () => ({ score: 75 }) },
    '@/lib/utils': { formatPrice: String, formatThaiBahtReadable: String, slugify: () => 'fixture-property' },
    '@/lib/auth-helpers': { getStoredUser: () => staff },
    '@/lib/image-compressor': video,
    '@/components/admin/SmartDescriptionGeneratorModal': 'SmartDescriptionGeneratorModal',
    '@/components/ui/VoiceDictationBar': 'VoiceDictationBar',
    '@/lib/staff-api': { fetchStaffApi: async (url, init) => {
      requests.push({ url, body: JSON.parse(init.body) });
      return Response.json({ success: true, description: 'คำบรรยายที่ทีมตรวจสอบจาก AI' });
    } },
  }, { isOpen: true, onSuccess() {}, onClose() {} });
  return { ...modal, saved, requests };
}
function button(output, label) {
  const result = nodes(output).find(node => node.type === 'button' && text(node).includes(label));
  assert.ok(result, `Expected button: ${label}`);
  return result;
}
function parseEntry(modal, input) {
  nodes(modal.render()).find(node => node.type === 'textarea').props.onChange({ target: { value: input } });
  button(modal.render(), 'ถอดรหัสข้อความ').props.onClick();
  return modal.render();
}

test('real quick-entry text saves a draft without unrelated default photos or video', async () => {
  const fixtures = [
    { input: 'ขายบ้านเดี่ยว ควนลัง หาดใหญ่ 3 ห้องนอน 2 ห้องน้ำ ราคา 3.89 ล้าน', type: 'house', price: 3890000 },
    { input: 'ให้เช่าคอนโด คอหงส์ หาดใหญ่ 1 ห้องนอน ราคา 9500 บาท/เดือน', type: 'condo', price: 9500 },
    { input: 'ขายที่ดิน เมืองสงขลา 100 ตารางวา ราคา 2.5 ล้าน', type: 'land', price: 2500000 },
  ];
  for (const fixture of fixtures) {
    const modal = quickEntry();
    const inputView = modal.render();
    assert.equal(nodes(inputView).find(node => node.type === 'textarea').props.value, '');
    assert.doesNotMatch(text(inputView), /ทดลองใส่ตัวอย่าง/);
    const review = parseEntry(modal, fixture.input);
    assert.equal(nodes(review).find(node => node.type === 'input' && node.props.type === 'checkbox').props.checked, false);
    await button(review, 'บันทึกฉบับร่าง').props.onClick();
    const property = modal.saved[0];
    assert.equal(property.property_type, fixture.type);
    assert.equal(property.price, fixture.price);
    assert.equal(property.published, false);
    assert.equal(property.cover_image, '');
    assert.equal(property.images.length, 0);
    assert.equal(property.video_url, undefined);
    assert.equal(property.agent.photo_url, '');
  }
});

test('voice, AI drafting and a staff-entered video remain available with explicit publishing', async () => {
  const modal = quickEntry();
  const voice = nodes(modal.render()).find(node => node.type === 'VoiceDictationBar');
  voice.props.onAppendText('ขายบ้านเดี่ยว ควนลัง หาดใหญ่ ราคา 3.89 ล้าน');
  button(modal.render(), 'ถอดรหัสข้อความ').props.onClick();
  await button(modal.render(), 'ให้ AI ร่างใหม่').props.onClick();
  const review = modal.render();
  assert.equal(modal.requests[0].url, '/api/ai/generate-property-description');
  assert.equal(modal.requests[0].body.price, '3890000');
  const realVideo = 'https://www.youtube.com/watch?v=actualtour1';
  nodes(review).find(node => node.type === 'input' && node.props.type === 'url').props.onChange({ target: { value: realVideo } });
  nodes(review).find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } });
  const updatedReview = modal.render();
  assert.ok(nodes(updatedReview).some(node => node.type === 'iframe' && node.props.src.includes('actualtour1')));
  assert.doesNotMatch(text(updatedReview), /ลิงก์ตัวอย่าง/);
  await button(updatedReview, 'ยืนยันและเผยแพร่ทรัพย์').props.onClick();
  assert.equal(modal.saved[0].published, true);
  assert.equal(modal.saved[0].video_url, realVideo);
  assert.equal(modal.saved[0].description, 'คำบรรยายที่ทีมตรวจสอบจาก AI');
  assert.equal(modal.saved[0].cover_image, '');
  assert.equal(modal.saved[0].images.length, 0);
});

test('property cards try real gallery photos and show a neutral placeholder if none load', () => {
  const props = { id: 'property-fixture', title: 'ทรัพย์จริง', type: 'house', status: 'sale', price: 3890000, slug: 'real-property', district: 'หาดใหญ่', province: 'สงขลา', coverImage: 'https://example.test/cover.jpg', images: ['https://example.test/gallery.jpg'] };
  const mocks = {
    'next/image': 'NextImage', 'next/link': 'NextLink',
    '@/components/properties/property-link': { propertyHref: slug => `/properties/${slug}` },
    '@/lib/utils': { formatPrice: String, formatThaiNumber: String, formatPropertyCode: String, getPropertyStatusBadge: () => ({ text: 'ขาย', bgClass: '', textClass: '' }) },
    '@/lib/store/properties-store': { getFavoriteIds: () => [] },
    '@/lib/store/compare-store': { getCompareIds: () => [] },
    '@/components/properties/SendToLineButton': 'SendToLineButton',
  };
  const card = component('components/properties/PropertyCard.tsx', mocks, props);
  let photo = nodes(card.render()).find(node => node.type === 'NextImage');
  assert.equal(photo.props.src, props.coverImage);
  photo.props.onError();
  photo = nodes(card.render()).find(node => node.type === 'NextImage');
  assert.equal(photo.props.src, props.images[0]);
  photo.props.onError();
  assert.equal(nodes(card.render()).some(node => node.type === 'NextImage'), false);
  assert.match(text(card.render()), /ยังแสดงรูปทรัพย์ไม่ได้/);
  const emptyCard = component('components/properties/PropertyCard.tsx', mocks, { ...props, coverImage: '', images: [] });
  assert.equal(nodes(emptyCard.render()).some(node => node.type === 'NextImage'), false);
  assert.match(text(emptyCard.render()), /ยังไม่มีรูปทรัพย์/);
});
