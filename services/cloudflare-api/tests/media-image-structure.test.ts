import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImageStructure } from '../src/media-image-structure.ts';

// Small fixtures produced by a real JPEG/PNG/WebP encoder (sharp), i.e. the
// same class of streams a browser canvas compressor emits.
const jpeg = Buffer.from('/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABQf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCCACLA/9k=', 'base64');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWM4IadxQk6DAUIBACAWBDmCyun5AAAAAElFTkSuQmCC', 'base64');
const webp = Buffer.from('UklGRjoAAABXRUJQVlA4IC4AAACQAQCdASoCAAIAAUAmJaACdLoAA5gA/vFNr+LaR0KZD/7xn/9xn/9xn/yIAAAA', 'base64');
// The 1x1 PNG used by the Worker runtime tests (RGBA, CRC-valid, with pHYs).
const runtimePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWM4IafxHwAEzgIOn8aNIQAAAABJRU5ErkJggg==', 'base64');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunks(base: Buffer): { type: string; data: Buffer }[] {
  const chunks: { type: string; data: Buffer }[] = [];
  let i = 8;
  while (i + 12 <= base.length) {
    const length = base.readUInt32BE(i);
    chunks.push({ type: base.toString('ascii', i + 4, i + 8), data: base.subarray(i + 8, i + 8 + length) });
    i += 12 + length;
  }
  return chunks;
}
function buildPng(chunks: { type: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [Buffer.from('\x89PNG\r\n\x1a\n', 'latin1')];
  for (const chunk of chunks) {
    const type = Buffer.from(chunk.type, 'ascii');
    const body = Buffer.concat([type, chunk.data]);
    const head = Buffer.alloc(8);
    head.writeUInt32BE(chunk.data.length, 0);
    type.copy(head, 4);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body), 0);
    parts.push(head, chunk.data, crc);
  }
  return Buffer.concat(parts);
}
function pngWithChunk(type: string, data: Buffer): Buffer {
  const chunks = pngChunks(png);
  chunks.splice(chunks.length - 1, 0, { type, data });
  return buildPng(chunks);
}
function pngWithIhdr(overrides: { width?: number; height?: number; interlace?: number; colorType?: number }): Buffer {
  const chunks = pngChunks(png);
  const ihdr = Buffer.from(chunks[0]!.data);
  if (overrides.width !== undefined) ihdr.writeUInt32BE(overrides.width, 0);
  if (overrides.height !== undefined) ihdr.writeUInt32BE(overrides.height, 4);
  if (overrides.colorType !== undefined) ihdr[9] = overrides.colorType;
  if (overrides.interlace !== undefined) ihdr[12] = overrides.interlace;
  chunks[0] = { type: 'IHDR', data: ihdr };
  return buildPng(chunks);
}

function insertJpegSegment(base: Buffer, marker: number, payload: Buffer): Buffer {
  const head = Buffer.from([0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff]);
  return Buffer.concat([base.subarray(0, 2), head, payload, base.subarray(2)]);
}
function jfifApp0(): Buffer {
  return Buffer.concat([
    Buffer.from('JFIF\0', 'latin1'), Buffer.from([1, 2, 0, 0, 1, 0, 1, 0, 0]),
  ]);
}
function patchJpegFrameDimensions(base: Buffer, width: number, height: number): Buffer {
  const patched = Buffer.from(base);
  let i = 2;
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb]);
  while (i + 4 < patched.length) {
    const marker = patched[i + 1]!;
    if (sof.has(marker)) {
      patched.writeUInt16BE(height, i + 5);
      patched.writeUInt16BE(width, i + 7);
      return patched;
    }
    if (marker === 0xda) break;
    i += 2 + patched.readUInt16BE(i + 2);
  }
  throw new Error('fixture has no frame header');
}

function webpChunks(base: Buffer): { type: string; data: Buffer }[] {
  const chunks: { type: string; data: Buffer }[] = [];
  let i = 12;
  while (i + 8 <= base.length) {
    const size = base.readUInt32LE(i + 4);
    chunks.push({ type: base.toString('ascii', i, i + 4), data: base.subarray(i + 8, i + 8 + size) });
    i += 8 + size + (size & 1);
  }
  return chunks;
}
function buildWebp(chunks: { type: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  for (const chunk of chunks) {
    const head = Buffer.alloc(8);
    head.write(chunk.type, 0, 4, 'ascii');
    head.writeUInt32LE(chunk.data.length, 4);
    parts.push(head, chunk.data);
    if (chunk.data.length & 1) parts.push(Buffer.from([0]));
  }
  const body = Buffer.concat(parts);
  const head = Buffer.alloc(12);
  head.write('RIFF', 0, 4, 'ascii');
  head.writeUInt32LE(body.length + 4, 4);
  head.write('WEBP', 8, 4, 'ascii');
  return Buffer.concat([head, body]);
}
function webpWithChunk(type: string, data: Buffer): Buffer {
  const chunks = webpChunks(webp);
  chunks.push({ type, data });
  return buildWebp(chunks);
}
function patchWebpImageDimensions(base: Buffer, width: number, height: number): Buffer {
  const chunks = webpChunks(base);
  const image = chunks.find(chunk => chunk.type === 'VP8 ');
  assert.ok(image);
  const data = Buffer.from(image.data);
  data.writeUInt16LE(width & 0x3fff, 6);
  data.writeUInt16LE(height & 0x3fff, 8);
  return buildWebp(chunks.map(chunk => chunk === image ? { type: chunk.type, data } : chunk));
}

test('accepts the metadata-free JPEG/PNG/WebP streams produced by the canvas compressor', async () => {
  assert.deepEqual(await validateImageStructure(jpeg, 'image/jpeg'), { ok: true, width: 2, height: 2 });
  assert.deepEqual(await validateImageStructure(png, 'image/png'), { ok: true, width: 2, height: 2 });
  assert.deepEqual(await validateImageStructure(webp, 'image/webp'), { ok: true, width: 2, height: 2 });
  assert.deepEqual(await validateImageStructure(runtimePng, 'image/png'), { ok: true, width: 1, height: 1 });
  // A well-formed JFIF APP0 header is allowed; it carries no user metadata.
  const jfif = insertJpegSegment(jpeg, 0xe0, jfifApp0());
  assert.deepEqual(await validateImageStructure(jfif, 'image/jpeg'), { ok: true, width: 2, height: 2 });
});

test('rejects JPEG EXIF/XMP/comments, trailing bytes, truncation and oversized frames', async () => {
  const exif = insertJpegSegment(jpeg, 0xe1, Buffer.from('Exif\0\0MM\0*', 'latin1'));
  assert.deepEqual(await validateImageStructure(exif, 'image/jpeg'),
    { ok: false, status: 415, error: 'JPEG metadata (EXIF/XMP/IPTC/ICC) is not accepted' });
  const comment = insertJpegSegment(jpeg, 0xfe, Buffer.from('camera', 'latin1'));
  assert.equal((await validateImageStructure(comment, 'image/jpeg')).ok, false);
  assert.equal((await validateImageStructure(Buffer.concat([jpeg, Buffer.from([0])]), 'image/jpeg')).ok, false);
  assert.equal((await validateImageStructure(jpeg.subarray(0, jpeg.length - 2), 'image/jpeg')).ok, false);
  assert.equal((await validateImageStructure(Buffer.from('not an image'), 'image/jpeg')).ok, false);
  const huge = patchJpegFrameDimensions(jpeg, 16000, 1200);
  const rejected = await validateImageStructure(huge, 'image/jpeg');
  assert.equal(rejected.ok, false);
  assert.equal(rejected.ok ? 0 : rejected.status, 413);
  const tooManyPixels = patchJpegFrameDimensions(jpeg, 6000, 6000);
  assert.equal((await validateImageStructure(tooManyPixels, 'image/jpeg')).ok, false);
});

test('rejects PNG metadata chunks, checksum corruption, truncation and oversized headers', async () => {
  const text = pngWithChunk('tEXt', Buffer.from('Comment\0private note', 'latin1'));
  assert.deepEqual(await validateImageStructure(text, 'image/png'),
    { ok: false, status: 415, error: 'PNG metadata or unsupported chunks are not accepted' });
  const corrupted = Buffer.from(png);
  corrupted[45] = corrupted[45]! ^ 0xff; // flip one IDAT byte, keep old CRC
  assert.deepEqual(await validateImageStructure(corrupted, 'image/png'),
    { ok: false, status: 415, error: 'PNG chunk checksum mismatch' });
  assert.equal((await validateImageStructure(png.subarray(0, png.length - 12), 'image/png')).ok, false);
  const tooLarge = pngWithIhdr({ width: 6000, height: 6000 });
  const rejected = await validateImageStructure(tooLarge, 'image/png');
  assert.equal(rejected.ok ? 0 : rejected.status, 413);
  const interlaced = pngWithIhdr({ interlace: 1 });
  assert.equal((await validateImageStructure(interlaced, 'image/png')).ok, false);
  const unsupportedColor = pngWithIhdr({ colorType: 7 });
  assert.equal((await validateImageStructure(unsupportedColor, 'image/png')).ok, false);
});

test('rejects WebP metadata/animation chunks, truncation and oversized frames', async () => {
  for (const [type, data] of [
    ['EXIF', Buffer.from('Exif\0\0', 'latin1')],
    ['XMP ', Buffer.from('<x/>', 'latin1')],
    ['ICCP', Buffer.from('profile', 'latin1')],
    ['ANIM', Buffer.alloc(6)],
  ] as const) {
    const result = await validateImageStructure(webpWithChunk(type, Buffer.from(data)), 'image/webp');
    assert.equal(result.ok, false, type);
    assert.equal(result.ok ? 0 : result.status, 415);
  }
  assert.equal((await validateImageStructure(webp.subarray(0, webp.length - 4), 'image/webp')).ok, false);
  assert.equal((await validateImageStructure(Buffer.from('RIFF\0\0\0\0WEBP'), 'image/webp')).ok, false);
  const huge = patchWebpImageDimensions(webp, 16000, 16000);
  const rejected = await validateImageStructure(huge, 'image/webp');
  assert.equal(rejected.ok ? 0 : rejected.status, 413);
});

test('rejects unsupported image types instead of guessing', async () => {
  const result = await validateImageStructure(Buffer.from('GIF89a'), 'image/gif' as never);
  assert.deepEqual(result, { ok: false, status: 415, error: 'Unsupported image format' });
});
