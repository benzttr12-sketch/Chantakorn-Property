const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./load-ts.cjs')();
const staff = { id: 'fixture-staff', full_name: 'ทีมงานทดสอบ', role: 'AGENT', email: 'staff@example.com', avatar_url: '' };
const photo = 'https://example.com/property-real.jpg';

function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...(node.children || []).flatMap(nodes)];
}
function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  return (Array.isArray(node) ? node : node.children || []).map(text).join('');
}
function field(tree, label) {
  const parent = nodes(tree).filter(node => node.type === 'div' && nodes(node).some(child => child.type === 'label' && text(child).includes(label)) && nodes(node).some(child => ['input', 'textarea', 'select'].includes(child.type))).at(-1);
  assert.ok(parent, `Expected field: ${label}`);
  const input = nodes(parent).find(node => ['input', 'textarea', 'select'].includes(node.type));
  assert.ok(input, `Expected control: ${label}`);
  return input;
}
function button(tree, label) {
  const result = nodes(tree).find(node => node.type === 'button' && text(node).includes(label));
  assert.ok(result, `Expected button: ${label}`);
  return result;
}
async function editor(existing, backend = 'firebase') {
  const saved = [], hydrated = [], hooks = [], effectQueue = [], elements = new Map();
  let cursor = 0;
  const router = { push() {} };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return hooks[index] ||= { current: initial }; },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = hooks[index];
      if (!previous || deps.some((value, i) => value !== previous[i])) effectQueue.push(effect);
      hooks[index] = deps;
    },
  };
  const mocks = {
    react,
    'next/navigation': { useRouter: () => router, useSearchParams: () => new URLSearchParams(existing ? `id=${existing.id}` : '') },
    'next/link': 'Link', 'next/image': 'Image',
    'lucide-react': new Proxy({}, { get: (_target, key) => key }),
    '@/lib/store/properties-store': {
      fetchUsers: async () => [{ ...staff }], fetchAdminProperties: async () => existing ? [existing] : [],
      createProperty: async property => { saved.push(property); return { ...property, id: 'created' }; },
      updateProperty: async (_id, property) => { saved.push(property); },
    },
    '@/lib/store/agents-store': { getAgents: () => [] },
    '@/lib/staff-api': { fetchStaffApi: async () => Response.json({}) },
    '@/lib/property-media': { loadStaffPropertyPhotos: async property => { hydrated.push(property); return property; } },
    '@/lib/cloudflare-properties': { useCloudflarePropertyBackend: backend === 'cloudflare' },
    '@/components/admin/StaffPropertyImage': 'StaffPropertyImage',
    '@/components/properties/property-link': { propertyHref: () => '/property-fixture' },
    '@/lib/auth-helpers': { getStoredUser: () => staff },
    '@/lib/utils': load('lib/utils.ts'),
    '@/data/locations': load('data/locations.ts'),
    '@/lib/image-compressor': { ...load('lib/image-compressor.ts'), compressImageFromUrl: async url => ({ dataUrl: url }) },
    '@/lib/nearby-landmarks': { calculateNearbyLandmarks: () => [] },
    '@/lib/feng-shui': load('lib/feng-shui.ts'),
    '@/lib/property-text-parser': load('lib/property-text-parser.ts'),
    '@/components/admin/SmartDescriptionGeneratorModal': 'SmartDescriptionGeneratorModal',
    '@/components/ui/VoiceDictationBar': 'VoiceDictationBar',
    '@/components/admin/PropertyFormProgress': 'PropertyFormProgress',
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/app/admin/properties/new/page.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, console, URLSearchParams, Response, setTimeout() {},
    document: { getElementById: id => elements.get(id) || null },
    require(name) { if (Object.hasOwn(mocks, name)) return mocks[name]; throw new Error(name); },
  });
  const editorType = module.exports.default().children[0].type;
  function render() { cursor = 0; return editorType(); }
  async function settle() {
    for (let i = 0; i < 3; i++) {
      render();
      effectQueue.splice(0).forEach(effect => effect());
      await new Promise(resolve => setImmediate(resolve));
    }
    return render();
  }
  await settle();
  return { render, settle, saved, hydrated, elements };
}
const existingProperty = optional => ({
  id: 'listing-fixture', title: 'บ้านทดสอบข้อมูลจริง', slug: 'real-property', price: 2500000,
  property_type: 'house', status: 'sale', province: 'สงขลา', district: 'หาดใหญ่', subdistrict: 'ควนลัง',
  latitude: 7.0084, longitude: 100.4705, images: [photo], cover_image: photo, published: false,
  agent_id: staff.id, agent: { id: staff.id, photo_url: '', name: staff.full_name }, ...optional,
});

test('full editor saves missing year, furniture and avatar without fabricated defaults', async () => {
  for (const existing of [undefined, existingProperty({})]) {
    const ui = await editor(existing);
    assert.equal(field(ui.render(), 'ปีที่สร้างเสร็จ').props.value, '');
    assert.equal(field(ui.render(), 'สภาพเฟอร์นิเจอร์').props.value, '');
    if (!existing) {
      field(ui.render(), 'ชื่อหัวข้อประกาศ').props.onChange({ target: { value: 'บ้านทดสอบข้อมูลจริง' } });
      field(ui.render(), 'ราคา (บาท)').props.onChange({ target: { value: '2500000' } });
      nodes(ui.render()).find(node => node.type === 'input' && node.props.placeholder === 'วางลิงก์รูปทรัพย์ https://…').props.onChange({ target: { value: photo } });
      await button(ui.render(), 'เพิ่มรูปจากลิงก์').props.onClick();
    }
    await nodes(ui.render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    assert.equal(ui.saved.length, 1);
    assert.equal(ui.saved[0].year_built, undefined);
    assert.equal(ui.saved[0].furniture, '');
    assert.equal(ui.saved[0].agent.photo_url, '');
  }
});

test('editing preserves actual optional specs, embedded agent photo and video in collapsed panels', async () => {
  const video = 'https://www.youtube.com/watch?v=actualtour1';
  const avatar = 'https://example.com/actual-agent.jpg';
  const ui = await editor(existingProperty({ year_built: 2018, furniture: 'เฟอร์นิเจอร์ตามรายการจริง', video_url: video, agent: { id: staff.id, name: staff.full_name, photo_url: avatar } }));
  const tree = ui.render();
  assert.equal(field(tree, 'ปีที่สร้างเสร็จ').props.value, '2018');
  assert.equal(field(tree, 'สภาพเฟอร์นิเจอร์').props.value, 'เฟอร์นิเจอร์ตามรายการจริง');
  const videoSection = nodes(tree).find(node => node.props.id === 'section-5-video');
  assert.equal(videoSection.type, 'details');
  assert.equal(videoSection.props.open, undefined);
  assert.ok(nodes(videoSection).some(node => node.type === 'input' && node.props.value === video));
  await nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(ui.saved[0].year_built, 2018);
  assert.equal(ui.saved[0].furniture, 'เฟอร์นิเจอร์ตามรายการจริง');
  assert.equal(ui.saved[0].agent.photo_url, avatar);
  assert.equal(ui.saved[0].video_url, video);
});

test('map tools defer preview and jumps or invalid fields reveal closed sections', async () => {
  const ui = await editor();
  const smartToggle = nodes(ui.render()).find(node => node.props['aria-controls'] === 'property-smart-text');
  assert.equal(smartToggle.props['aria-expanded'], false);
  assert.equal(nodes(ui.render()).some(node => node.props.id === 'property-smart-text'), false);
  smartToggle.props.onClick();
  assert.equal(nodes(ui.render()).some(node => node.props.id === 'property-smart-text'), true);
  const map = () => nodes(ui.render()).find(node => node.props.id === 'section-2-map-tools');
  assert.equal(nodes(map()).some(node => node.type === 'iframe'), false);
  map().props.onToggle({ currentTarget: { open: true } });
  assert.equal(nodes(map()).some(node => node.type === 'iframe'), true);
  map().props.onToggle({ currentTarget: { open: false } });
  assert.equal(nodes(map()).some(node => node.type === 'iframe'), false);
  let scrolled = false, focused = false;
  const panel = { tagName: 'DETAILS', open: false, parentElement: null, scrollIntoView() { scrolled = true; }, querySelector: () => ({ focus() { focused = true; } }), classList: { add() {}, remove() {} } };
  ui.elements.set('section-5-video', panel);
  button(ui.render(), '5. วิดีโอพาทัวร์').props.onClick();
  assert.equal(panel.open, true);
  assert.equal(scrolled, true);
  assert.equal(focused, true);
  panel.open = false;
  let invalidFocused = false;
  nodes(ui.render()).find(node => node.type === 'form').props.onInvalidCapture({ target: { tagName: 'INPUT', parentElement: panel, focus() { invalidFocused = true; } } });
  assert.equal(panel.open, true);
  assert.equal(invalidFocused, true);
});

test('clearing an existing build year sends an explicit removal intent', async () => {
  const ui = await editor(existingProperty({ year_built: 2018 }));
  field(ui.render(), 'ปีที่สร้างเสร็จ').props.onChange({ target: { value: '' } });
  await nodes(ui.render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(ui.saved.length, 1);
  assert.equal(Object.hasOwn(ui.saved[0], 'year_built'), true);
  assert.equal(ui.saved[0].year_built, undefined);
});

test('D1 editor previews saved media without Firestore hydration and saves original URLs', async () => {
  const id = 'c1c00000-0000-4000-8000-000000000001';
  const image = 'https://staging-api.example.invalid/v1/media/properties/c1c00000-0000-4000-8000-000000000002';
  const property = existingProperty({ id, images: [image], cover_image: image });
  const ui = await editor(property, 'cloudflare');
  assert.equal(ui.hydrated.length, 0);
  const tree = ui.render();
  const preview = nodes(tree).find(node => node.type === 'StaffPropertyImage');
  assert.ok(preview);
  assert.equal(preview.props.src, image);
  assert.equal(preview.props.propertyId, id);
  await nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(ui.saved.length, 1);
  assert.deepEqual(Array.from(ui.saved[0].images), [image]);
  assert.equal(ui.saved[0].cover_image, image);
  const firebase = await editor(property);
  assert.equal(firebase.hydrated.length, 1);
});
