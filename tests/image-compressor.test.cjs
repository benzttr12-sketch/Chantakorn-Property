const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { File } = require('node:buffer');

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/image-compressor.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const jpeg = () => new File([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)], 'photo.jpg', { type: 'image/jpeg' });

function context() {
  const calls = [];
  const stack = [];
  let matrix = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
  const ctx = {
    calls,
    save() { stack.push({ ...matrix }); },
    restore() { matrix = stack.pop(); },
    translate(x, y) { matrix.x += x * matrix.scaleX; matrix.y += y * matrix.scaleY; },
    scale(x, y) { matrix.scaleX *= x; matrix.scaleY *= y; },
    measureText(text) { return { width: text.length * Number(/(\d+)px/.exec(this.font)[1]) * 0.6 }; },
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {},
    roundRect(x, y, width, height, radius) {
      calls.push({ action: 'rect', x: matrix.x + x * matrix.scaleX, y: matrix.y + y * matrix.scaleY,
        width: width * matrix.scaleX, height: height * matrix.scaleY, radius });
    },
    fill() {},
    stroke() { calls.push({ action: 'stroke', color: this.strokeStyle }); },
    fillText(text) { calls.push({ action: 'text', text }); },
    fillRect() {}, drawImage() { calls.push({ action: 'image' }); },
    createLinearGradient() {
      return { addColorStop(offset, color) { calls.push({ action: 'colorStop', offset, color }); } };
    },
  };
  return ctx;
}

function load({ width = 1920, height = 1080, decodeError = false, noCanvas = false,
  encode = () => ({ type: 'image/webp', bytes: 100 }), fetch = async () => { throw new TypeError('CORS failed'); }, browser = true } = {}) {
  const module = { exports: {} };
  const ctx = context();
  const encodings = [];
  const revoked = [];
  let decodeCalls = 0;
  class FakeImage {
    set src(value) {
      decodeCalls++;
      this.width = this.naturalWidth = width;
      this.height = this.naturalHeight = height;
      queueMicrotask(() => decodeError ? this.onerror() : this.onload());
    }
  }
  class ObjectURL extends URL {
    static createObjectURL() { return 'blob:local-image'; }
    static revokeObjectURL(url) { revoked.push(url); }
  }
  const canvas = {
    width: 0, height: 0,
    getContext() { return noCanvas ? null : ctx; },
    toDataURL(type, quality) {
      encodings.push({ type, quality, width: this.width, height: this.height });
      const output = encode({ type, quality, width: this.width, height: this.height });
      return `data:${output.type};base64,${Buffer.alloc(output.bytes).toString('base64')}`;
    },
  };
  vm.runInNewContext(source, {
    module, exports: module.exports, require, URL: ObjectURL, File, atob, Uint8Array, TypeError,
    window: browser ? { Image: FakeImage } : undefined,
    document: browser ? { createElement() { return canvas; } } : undefined,
    fetch, AbortController, setTimeout, clearTimeout,
  });
  return { api: module.exports, ctx, encodings, revoked, decodeCalls: () => decodeCalls };
}

test('watermark draws the brand building and official contact without the old phone/domain', () => {
  const { api, ctx } = load();
  api.drawBottomRightWatermark(ctx, 1920, 1080);
  assert.ok(ctx.calls.some(call => call.action === 'stroke' && call.color === '#020812'));
  assert.deepEqual(ctx.calls.filter(call => call.action === 'colorStop').map(call => call.color), ['#D7BC42', '#C9A227', '#D97706']);
  assert.deepEqual(ctx.calls.filter(call => call.action === 'text').map(call => call.text), ['CHANTAKORN PROPERTY', '081-604-0097 | LINE @930xzcyi']);
  assert.doesNotMatch(JSON.stringify(ctx.calls), /082-436-4499|chantakornproperty\.com/);
});

test('all five watermark positions stay within tiny and portrait image bounds', () => {
  const { api } = load();
  for (const [width, height] of [[8, 8], [24, 256], [120, 3000], [1920, 1080]]) {
    for (const position of ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']) {
      const ctx = context();
      api.drawBottomRightWatermark(ctx, width, height, { position, watermarkText: 'Custom brand with a long title' });
      const [badge, logo] = ctx.calls.filter(call => call.action === 'rect');
      for (const box of [badge, logo]) {
        assert.ok(box.x >= -1e-8 && box.y >= -1e-8, `${position} has negative coordinates`);
        assert.ok(box.x + box.width <= width + 1e-8 && box.y + box.height <= height + 1e-8, `${position} clips`);
      }
      if (position.startsWith('top')) assert.ok(badge.y < height / 2);
      if (position.startsWith('bottom')) assert.ok(badge.y > height / 2);
      if (position === 'center') {
        assert.ok(Math.abs(badge.x + badge.width / 2 - width / 2) < 1e-8);
        assert.ok(Math.abs(badge.y + badge.height / 2 - height / 2) < 1e-8);
      }
    }
  }
});

test('watermark off preserves the image processing flow and skips brand drawing', async () => {
  const { api, ctx } = load();
  const result = await api.compressImageFile(jpeg(), { enableWatermark: false });
  assert.equal(result.compressedSize, 100);
  assert.ok(ctx.calls.some(call => call.action === 'image'));
  assert.equal(ctx.calls.some(call => call.action === 'text' || call.action === 'stroke'), false);
});

test('size validation rejects an oversized file before reading or decoding it', async () => {
  const { api, decodeCalls } = load();
  await assert.rejects(api.compressImageFile({ size: 100 * 1024 * 1024 + 1, name: 'huge.jpg' }), /100MB/);
  assert.equal(decodeCalls(), 0);
});

test('raster validation rejects SVG, incorrect MIME and forged image headers before decoding', async () => {
  const { api, decodeCalls } = load();
  for (const file of [
    new File(['<svg/>'], 'image.svg', { type: 'image/svg+xml' }),
    new File(['<svg/>'], 'image.jpg', { type: 'image/jpeg' }),
    new File([Buffer.from([0xff, 0xd8, 0xff, 0xe0])], 'image.png', { type: 'image/png' }),
    new File([], 'empty.jpg', { type: 'image/jpeg' }),
  ]) await assert.rejects(api.compressImageFile(file), /รูป|ภาพ|ว่าง/);
  assert.equal(decodeCalls(), 0);
});

test('supported raster signatures with missing MIME still require successful decoding', async () => {
  const { api, decodeCalls } = load();
  const png = new File([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'phone-photo.png');
  assert.equal((await api.compressImageFile(png)).compressedSize, 100);
  assert.equal(decodeCalls(), 1);
  const failed = load({ decodeError: true });
  await assert.rejects(failed.api.compressImageFile(png), /ไม่ถูกต้องหรือไม่รองรับ/);
  assert.deepEqual(failed.revoked, ['blob:local-image']);
});

test('decoded pixel ceiling rejects giant or zero-dimensional images before canvas encoding', async () => {
  for (const [width, height] of [[10000, 10000], [0, 100], [20000, 20]]) {
    const { api, encodings } = load({ width, height });
    await assert.rejects(api.compressImageFile(jpeg()), /ความละเอียด|ขนาดภาพ/);
    assert.equal(encodings.length, 0);
  }
});

test('compression reduces dimensions when quality alone cannot satisfy the byte ceiling', async () => {
  const { api, encodings, ctx } = load({
    encode: ({ width, height, quality }) => ({ type: 'image/webp', bytes: Math.ceil(width * height * quality * 0.6) }),
  });
  const result = await api.compressImageFile(jpeg(), { targetMaxBytes: 450000 });
  assert.ok(result.compressedSize <= 450000);
  assert.ok(result.width < 1920 && result.height < 1080);
  assert.ok(encodings.every(call => call.quality >= 0.45));
  assert.equal(Buffer.from(result.dataUrl.split(',')[1], 'base64').length, result.compressedSize);
  assert.ok(ctx.calls.filter(call => call.action === 'stroke').length > 1, 'redraws the watermark at the reduced size');
});

test('base64 padding is counted exactly at the output budget boundary', async () => {
  const { api } = load({ encode: () => ({ type: 'image/webp', bytes: 101 }) });
  assert.equal((await api.compressImageFile(jpeg(), { targetMaxBytes: 101 })).compressedSize, 101);
  await assert.rejects(api.compressImageFile(jpeg(), { targetMaxBytes: 100 }), /ไม่สามารถย่อรูป/);
});

test('impossible budgets and canvas failures produce actionable failure, never an oversized success', async () => {
  const impossible = load({ encode: () => ({ type: 'image/webp', bytes: 5000 }) });
  await assert.rejects(impossible.api.compressImageFile(jpeg(), { targetMaxBytes: 1000 }), /ไม่สามารถย่อรูป/);
  assert.ok(impossible.encodings.length < 120);
  assert.ok(impossible.encodings.every(call => Math.max(call.width, call.height) >= 128));
  await assert.rejects(load({ noCanvas: true }).api.compressImageFile(jpeg()), /2D Canvas/);
});

test('invalid processing settings cannot bypass bounds or create an infinite quality loop', async () => {
  const { api, decodeCalls } = load();
  for (const options of [{ maxDimension: Infinity }, { maxDimension: 5000 }, { minQuality: 0 },
    { initialQuality: 0.4, minQuality: 0.5 }, { targetMaxBytes: NaN }, { targetMaxBytes: -1 }]) {
    await assert.rejects(api.compressImageFile(jpeg(), options), /ตั้งค่า/);
  }
  assert.equal(decodeCalls(), 0);
});

test('unsupported WebP encoding falls back to JPEG while explicit JPEG stays JPEG', async () => {
  const { api, encodings } = load({ encode: ({ type }) => ({ type: type === 'image/webp' ? 'image/png' : type, bytes: 100 }) });
  assert.match((await api.compressImageFile(jpeg())).dataUrl, /^data:image\/jpeg;/);
  encodings.length = 0;
  assert.match((await api.compressImageFile(jpeg(), { format: 'image/jpeg' })).dataUrl, /^data:image\/jpeg;/);
  assert.ok(encodings.every(call => call.type === 'image/jpeg'));
});

test('URL importer rejects HTTP and embedded credentials without fetching', async () => {
  let requests = 0;
  const { api } = load({ fetch: async () => { requests++; } });
  for (const url of ['http://site.example/photo.jpg', 'https://user:secret@site.example/photo.jpg', 'data:image/jpeg;base64,AAAA', 'invalid']) {
    await assert.rejects(api.compressImageFromUrl(url), /HTTPS/);
  }
  assert.equal(requests, 0);
});

test('URL network, nonimage, HTTP and corrupted image failures cannot return unprocessed URLs', async () => {
  for (const fetch of [
    async () => { throw new TypeError('CORS'); },
    async () => new Response('denied', { status: 403 }),
    async () => new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } }),
    async () => new Response('not JPEG', { headers: { 'content-type': 'image/jpeg' } }),
    async () => new Response('x', { headers: { 'content-type': 'image/jpeg', 'content-length': String(100 * 1024 * 1024 + 1) } }),
  ]) await assert.rejects(load({ fetch }).api.compressImageFromUrl('https://site.example/photo.jpg'));
});

test('URL success returns the processed image and omits credentials and redirects', async () => {
  let init;
  const { api, ctx } = load({ fetch: async (_url, options) => {
    init = options;
    return new Response(await jpeg().arrayBuffer(), { headers: { 'content-type': 'image/jpeg' } });
  } });
  const result = await api.compressImageFromUrl('https://site.example/photo.jpg');
  assert.equal(result.processed, true);
  assert.match(result.dataUrl, /^data:image\/webp;/);
  assert.equal(init.credentials, 'omit');
  assert.equal(init.redirect, 'error');
  assert.ok(ctx.calls.some(call => call.action === 'stroke'));
});

test('URL byte ceiling also cancels oversized streamed responses without a content-length', async () => {
  let cancelled = false;
  let released = false;
  let reads = 0;
  const { api, decodeCalls } = load({ fetch: async () => ({
    ok: true, url: 'https://site.example/photo.jpg',
    headers: { get: key => key === 'content-type' ? 'image/jpeg' : null },
    body: { getReader: () => ({
      async read() { reads++; return { done: false, value: { byteLength: 100 * 1024 * 1024 + 1 } }; },
      async cancel() { cancelled = true; },
      releaseLock() { released = true; },
    }) },
  }) });
  await assert.rejects(api.compressImageFromUrl('https://site.example/photo.jpg'), /100MB/);
  assert.equal(reads, 1);
  assert.equal(cancelled, true);
  assert.equal(released, true);
  assert.equal(decodeCalls(), 0);
});

test('watermark helper rejects unprocessable data and never silently returns the original', async () => {
  const data = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64')}`;
  await assert.rejects(load({ decodeError: true }).api.addWatermarkToImage(data), /ไม่ถูกต้อง/);
  await assert.rejects(load({ browser: false }).api.addWatermarkToImage(data), /เบราว์เซอร์/);
  await assert.rejects(load().api.addWatermarkToImage('https://site.example/photo.jpg'), /ข้อมูลรูปภาพ/);
});

test('batch progress reports completed processed items in order and aborts on a bad image', async () => {
  const { api } = load();
  const progress = [];
  const results = await api.compressMultipleImages([jpeg(), jpeg()], (current, total, item) => progress.push([current, total, item.compressedSize]));
  assert.equal(results.length, 2);
  assert.deepEqual(progress, [[1, 2, 100], [2, 2, 100]]);
  await assert.rejects(api.compressMultipleImages([jpeg(), new File(['broken'], 'broken.jpg', { type: 'image/jpeg' })]));
});
