const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { unzipSync } = require('fflate');

const photo = index => `https://photos.example.test/${index}.jpg`;
const listing = {
  id: 'prop-01', title: 'บ้านทดสอบ', published: false,
  cover_image: photo(0), images: Array.from({ length: 8 }, (_, index) => photo(index)),
  property_type: 'house', price: 2100000, status: 'sale', district: 'หาดใหญ่', province: 'สงขลา',
};
const filename = (_id, index, type) => `CK-01-facebook-${String(index + 1).padStart(2, '0')}.${type === 'image/jpeg' ? 'jpg' : type.split('/')[1]}`;

// Exercise the real event handlers and effect cleanup, while controlling image
// responses independently of a live staff account or storage provider.
function component({ property = listing, fetchPhoto = src => new Blob([src], { type: 'image/jpeg' }) } = {}) {
  const hooks = [];
  const requests = [], downloads = [], copied = [];
  let cursor = 0, effects = [], changed = false;
  let props = { isOpen: true, property, onClose() {} };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], value => {
        const next = typeof value === 'function' ? value(hooks[index]) : value;
        changed ||= !Object.is(next, hooks[index]);
        hooks[index] = next;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = { current: initial };
      return hooks[index];
    },
    useMemo(factory) { cursor++; return factory(); },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = hooks[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        effects.push(() => {
          previous?.cleanup?.();
          hooks[index] = { deps, cleanup: effect() };
        });
      }
    },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/admin/FacebookPostModal.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, console, Blob, Uint8Array, ArrayBuffer, AbortController,
    navigator: { clipboard: { writeText: async value => { copied.push(value); } } },
    document: { body: { style: {} }, addEventListener() {}, removeEventListener() {} },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react-dom') return { createPortal: node => node };
      if (name === 'lucide-react') return new Proxy({}, { get: (_target, key) => key });
      if (name === 'fflate') return require('fflate');
      if (name === '@/lib/automation-engine') return {
        generateLocalSocialPost: (_property, _channel, tone) => ({ fullPost: `ข้อความ ${tone}`, hashtags: ['#บ้าน'] }),
      };
      if (name === '@/lib/utils') return {
        DEFAULT_OFFICIAL_FACEBOOK: 'https://facebook.com/official-page',
        formatPrice: String, formatPropertyCode: () => 'CK-01', getPropertyTypeName: () => 'บ้าน',
      };
      if (name === '@/components/admin/StaffPropertyImage') return 'StaffPropertyImage';
      if (name === '@/lib/property-photo-download') return {
        fetchPropertyPhoto: async (src, propertyId, signal) => {
          requests.push({ src, propertyId, signal });
          return fetchPhoto(src, propertyId, signal);
        },
        propertyPhotoFilename: filename,
        savePhotoDownload: (blob, name) => { downloads.push({ blob, filename: name }); },
      };
      throw Error(name);
    },
  });
  function render(update) {
    if (update) props = { ...props, ...update };
    let output;
    for (let passes = 0; passes < 10; passes++) {
      cursor = 0; effects = []; changed = false;
      output = module.exports.default(props);
      effects.forEach(effect => effect());
      if (!changed) return output;
    }
    throw Error('Render did not settle');
  }
  return {
    render, requests, downloads, copied,
    unmount() { hooks.forEach(hook => hook?.cleanup?.()); },
  };
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
function individual(output, index) {
  const button = nodes(output).find(node => node.type === 'button' && node.props['aria-label'] === `ดาวน์โหลดรูปที่ ${index + 1}`);
  assert.ok(button, `Expected download button for photo ${index + 1}`);
  return button;
}
function allPhotos(output) {
  const button = nodes(output).find(node => node.type === 'button' && text(node).includes('ดาวน์โหลดรูปทั้งหมด'));
  assert.ok(button, 'Expected ZIP download button');
  return button;
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('all deduplicated photos remain accessible after photo six, with the cover first', async () => {
  const images = [photo(3), photo(0), '', ' ', ...listing.images];
  const modal = component({ property: { ...listing, images } });
  const output = modal.render();
  const expected = [photo(0), photo(3), photo(1), photo(2), ...listing.images.slice(4)];
  assert.deepEqual(nodes(output).filter(node => node.type === 'StaffPropertyImage').map(node => node.props.src), expected);
  assert.equal(modal.requests.length, 0);
  await individual(output, 7).props.onClick();
  assert.equal(modal.requests[0].src, expected[7]);
  assert.equal(modal.requests[0].propertyId, listing.id);
  assert.equal(modal.downloads[0].filename, 'CK-01-facebook-08.jpg');
  assert.equal(await modal.downloads[0].blob.text(), expected[7]);
  assert.ok(nodes(modal.render()).some(node => node.props.role === 'status'));
});

test('download all produces one ZIP containing every original image once in cover-first order', async () => {
  const modal = component({ property: { ...listing, images: [...listing.images, listing.cover_image] } });
  await allPhotos(modal.render()).props.onClick();
  assert.deepEqual(modal.requests.map(request => request.src), listing.images);
  assert.equal(modal.downloads.length, 1);
  const download = modal.downloads[0];
  assert.equal(download.filename, 'CK-01-facebook-photos.zip');
  assert.equal(download.blob.type, 'application/zip');
  const archive = unzipSync(new Uint8Array(await download.blob.arrayBuffer()));
  assert.deepEqual(Object.keys(archive), listing.images.map((_, index) => filename(listing.id, index, 'image/jpeg')));
  Object.values(archive).forEach((bytes, index) => assert.equal(new TextDecoder().decode(bytes), listing.images[index]));
});

test('a rapid second click starts no duplicate request and all download controls stay disabled while loading', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const modal = component({ fetchPhoto: () => pending });
  const button = individual(modal.render(), 0);
  const first = button.props.onClick();
  await button.props.onClick();
  assert.equal(modal.requests.length, 1);
  const loading = modal.render();
  assert.equal(individual(loading, 0).props.disabled, true);
  assert.equal(allPhotos(loading).props.disabled, true);
  finish(new Blob(['saved'], { type: 'image/png' }));
  await first;
  assert.equal(modal.downloads.length, 1);
  assert.equal(modal.downloads[0].filename, 'CK-01-facebook-01.png');
  assert.equal(individual(modal.render(), 0).props.disabled, false);
});

test('an incomplete ZIP is never offered after an image fails, and retry downloads the complete archive', async () => {
  let fail = true;
  const modal = component({ fetchPhoto: src => {
    if (fail && src === photo(2)) throw Error('Image server unavailable');
    return new Blob([src], { type: 'image/jpeg' });
  } });
  await allPhotos(modal.render()).props.onClick();
  assert.equal(modal.downloads.length, 0);
  const failed = modal.render();
  assert.ok(nodes(failed).some(node => node.props.role === 'alert'));
  assert.equal(allPhotos(failed).props.disabled, false);
  fail = false;
  await allPhotos(failed).props.onClick();
  assert.equal(modal.downloads.length, 1);
  assert.equal(Object.keys(unzipSync(new Uint8Array(await modal.downloads[0].blob.arrayBuffer()))).length, 8);
  assert.equal(nodes(modal.render()).some(node => node.props.role === 'alert'), false);
});

test('closing or changing listings or photos aborts a pending download and ignores a late image response', async () => {
  for (const update of [
    { isOpen: false },
    { property: { ...listing, id: 'prop-02' } },
    { property: { ...listing, cover_image: photo(1), images: listing.images.slice(1) } },
  ]) {
    let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    const modal = component({ fetchPhoto: () => pending });
    const work = individual(modal.render(), 0).props.onClick();
    const signal = modal.requests[0].signal;
    modal.render(update);
    assert.equal(signal.aborted, true);
    finish(new Blob(['late'], { type: 'image/jpeg' }));
    await work;
    await tick();
    assert.equal(modal.downloads.length, 0);
    const reopened = modal.render({ isOpen: true });
    assert.equal(individual(reopened, 0).props.disabled, false);
  }
});

test('unmounting aborts image work and prevents late download side effects', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const modal = component({ fetchPhoto: () => pending });
  const work = individual(modal.render(), 0).props.onClick();
  modal.unmount();
  assert.equal(modal.requests[0].signal.aborted, true);
  finish(new Blob(['late'], { type: 'image/jpeg' }));
  await work;
  assert.equal(modal.downloads.length, 0);
});

test('listings without photos keep the copy and Facebook actions without download controls', async () => {
  const modal = component({ property: { ...listing, cover_image: '', images: [] } });
  const output = modal.render();
  assert.equal(nodes(output).filter(node => node.type === 'button' && /ดาวน์โหลด/.test(text(node))).length, 0);
  assert.ok(nodes(output).some(node => node.props.role === 'status' && /ยังไม่มีรูป/.test(text(node))));
  const textarea = nodes(output).find(node => node.type === 'textarea');
  textarea.props.onChange({ target: { value: 'ข้อความแก้ไขแล้ว' } });
  const copy = nodes(modal.render()).find(node => node.type === 'button' && text(node).includes('คัดลอกข้อความโพสต์'));
  await copy.props.onClick();
  assert.deepEqual(modal.copied, ['ข้อความแก้ไขแล้ว']);
  assert.ok(nodes(output).some(node => node.type === 'a' && node.props.href === 'https://facebook.com/official-page'));
});
