/**
 * Structural validation for stored property/customer images.
 *
 * The browser compressor already re-encodes photos through a canvas, so normal
 * uploads are metadata-free JPEG/PNG/WebP. Direct API callers are not trusted:
 * this module walks the real container instead of only sniffing magic bytes,
 * rejects embedded metadata (EXIF/XMP/IPTC/ICC/comments/text) and animation,
 * verifies PNG chunk CRCs plus the IDAT zlib stream length, and bounds the
 * decoded pixel size. It deliberately rejects rather than rewrites so stored
 * bytes always equal uploaded bytes and no parser is asked to strip in place.
 * Full pixel-level decoding (JPEG Huffman, WebP VP8/VP8L, PNG unfiltering)
 * remains out of scope; see README.
 */
import type { SafeMime } from './media-validation.ts';

export const MAX_IMAGE_DIMENSION = 12_000;
export const MAX_IMAGE_PIXELS = 25_000_000;

export type ImageStructureResult =
  | { ok: true; width: number; height: number }
  | { ok: false; status: 400 | 413 | 415; error: string };

const fail = (status: 400 | 413 | 415, error: string): ImageStructureResult =>
  ({ ok: false, status, error });

function checkDimensions(width: number, height: number): ImageStructureResult {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1)
    return fail(415, 'Image dimensions are invalid');
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION)
    return fail(413, `Image dimensions exceed ${MAX_IMAGE_DIMENSION}px`);
  if (width * height > MAX_IMAGE_PIXELS)
    return fail(413, 'Image pixel count exceeds the allowed limit');
  return { ok: true, width, height };
}

const u16be = (bytes: Uint8Array, i: number) => (bytes[i]! << 8) | bytes[i + 1]!;
const u24le = (bytes: Uint8Array, i: number) => bytes[i]! | (bytes[i + 1]! << 8) | (bytes[i + 2]! << 16);
const u32le = (bytes: Uint8Array, i: number) =>
  (bytes[i]! | (bytes[i + 1]! << 8) | (bytes[i + 2]! << 16) | (bytes[i + 3]! << 24)) >>> 0;
const u32be = (bytes: Uint8Array, i: number) =>
  ((bytes[i]! << 24) | (bytes[i + 1]! << 16) | (bytes[i + 2]! << 8) | bytes[i + 3]!) >>> 0;
const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

// ---------------------------------------------------------------------------
// JPEG: walk markers, reject APPn (except JFIF APP0) and comments, then fully
// Huffman-decode the baseline entropy data. Progressive, arithmetic-coded,
// multi-scan and restart-interval JPEGs are rejected rather than guessed at.
// ---------------------------------------------------------------------------
type JpegHuffman = {
  maxCode: Int32Array; minCode: Int32Array; valueIndex: Int32Array; values: Uint8Array;
};
type JpegComponent = { id: number; h: number; v: number; tq: number };

function buildJpegHuffman(bits: Uint8Array, values: Uint8Array): JpegHuffman | null {
  const maxCode = new Int32Array(17).fill(-1);
  const minCode = new Int32Array(17).fill(-1);
  const valueIndex = new Int32Array(17);
  let code = 0;
  let index = 0;
  for (let length = 1; length <= 16; length++) {
    const count = bits[length]!;
    if (code + count > (1 << length)) return null; // oversubscribed table
    minCode[length] = code;
    valueIndex[length] = index;
    code += count;
    index += count;
    maxCode[length] = code - 1;
    code <<= 1;
  }
  if (index !== values.length) return null;
  return { maxCode, minCode, valueIndex, values };
}

/** Decode one interleaved baseline scan; returns an error message or null. */
function decodeJpegScan(
  bytes: Uint8Array, start: number, end: number,
  frameComponents: JpegComponent[],
  scan: { component: JpegComponent; dc: JpegHuffman; ac: JpegHuffman }[],
  width: number, height: number,
  quantTables: Set<number>,
): string | null {
  try {
    if (scan.length !== frameComponents.length) return 'JPEG multi-scan files are not accepted';
    for (const item of scan) if (!quantTables.has(item.component.tq)) return 'JPEG quantization table is missing';
    const maxH = Math.max(...frameComponents.map(component => component.h));
    const maxV = Math.max(...frameComponents.map(component => component.v));
    const mcuColumns = Math.ceil(width / (8 * maxH));
    const mcuRows = Math.ceil(height / (8 * maxV));
    if (mcuColumns < 1 || mcuRows < 1) return 'JPEG dimensions are invalid';
    if (mcuColumns * mcuRows > 1_000_000) return 'JPEG MCU count is too large';

    let position = start;
    let bitBuffer = 0;
    let bitCount = 0;
    const readBit = (): number => {
      if (bitCount === 0) {
        if (position >= end) throw new Error('entropy exhausted');
        let byte = bytes[position++]!;
        if (byte === 0xff) {
          if (position >= end) throw new Error('entropy exhausted');
          if (bytes[position] !== 0x00) throw new Error('unexpected marker in entropy data');
          position++;
          byte = 0xff;
        }
        bitBuffer = byte;
        bitCount = 8;
      }
      bitCount--;
      return (bitBuffer >> bitCount) & 1;
    };
    const readBits = (count: number): number => {
      let value = 0;
      for (let bit = 0; bit < count; bit++) value = (value << 1) | readBit();
      return value;
    };
    const extend = (size: number): number => {
      if (size === 0) return 0;
      const value = readBits(size);
      const threshold = 1 << (size - 1);
      return value < threshold ? value - (1 << size) + 1 : value;
    };
    const decodeHuffman = (table: JpegHuffman): number => {
      let code = 0;
      for (let length = 1; length <= 16; length++) {
        code = (code << 1) | readBit();
        const max = table.maxCode[length]!;
        if (max >= 0 && code <= max) {
          const index = table.valueIndex[length]! + (code - table.minCode[length]!);
          if (index < 0 || index >= table.values.length) throw new Error('bad huffman index');
          return table.values[index]!;
        }
      }
      throw new Error('bad huffman code');
    };

    const previousDc = new Int32Array(scan.length).fill(0);
    for (let row = 0; row < mcuRows; row++) {
      for (let column = 0; column < mcuColumns; column++) {
        for (let ci = 0; ci < scan.length; ci++) {
          const { component, dc: dcTable, ac: acTable } = scan[ci]!;
          for (let block = 0; block < component.h * component.v; block++) {
            const dcSize = decodeHuffman(dcTable);
            if (dcSize > 11) return 'JPEG DC category is invalid';
            previousDc[ci] = previousDc[ci]! + extend(dcSize);
            let coefficient = 1;
            while (coefficient < 64) {
              const symbol = decodeHuffman(acTable);
              const run = symbol >> 4;
              const size = symbol & 15;
              if (size === 0) {
                if (run !== 15) break; // end of block
                coefficient += 16;
                continue;
              }
              if (size > 10) return 'JPEG AC category is invalid';
              coefficient += run;
              if (coefficient > 63) return 'JPEG AC run is invalid';
              extend(size);
              coefficient++;
            }
          }
        }
      }
    }
    return null;
  } catch { return 'JPEG entropy data is invalid'; }
}

function validateJpeg(bytes: Uint8Array): ImageStructureResult {
  const length = bytes.byteLength;
  if (length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return fail(415, 'Invalid JPEG header');
  let i = 2;
  let frame: { width: number; height: number; components: JpegComponent[] } | null = null;
  let scans = 0;
  const quantTables = new Set<number>();
  const huffmanTables = new Map<number, JpegHuffman>();
  while (i < length) {
    if (bytes[i] !== 0xff) return fail(415, 'Invalid JPEG marker stream');
    const marker = bytes[i + 1]!;
    if (marker === 0xff) { i++; continue; } // fill byte
    if (marker === 0x00) return fail(415, 'Invalid JPEG marker stream');
    i += 2;
    if (marker === 0xd8) return fail(415, 'Nested JPEG image');
    if (marker === 0xd9) {
      if (!frame || scans !== 1) return fail(415, 'JPEG has no decodable baseline image');
      return i === length ? checkDimensions(frame.width, frame.height)
        : fail(415, 'Unexpected data after JPEG end marker');
    }
    if (marker >= 0xd0 && marker <= 0xd7) return fail(415, 'Unexpected restart marker');
    if (marker === 0x01) continue; // TEM: no payload
    if (i + 2 > length) return fail(415, 'Truncated JPEG segment');
    const segmentLength = u16be(bytes, i);
    if (segmentLength < 2 || i + segmentLength > length) return fail(415, 'Invalid JPEG segment length');
    const segmentEnd = i + segmentLength;
    if (marker >= 0xe1 && marker <= 0xef)
      return fail(415, 'JPEG metadata (EXIF/XMP/IPTC/ICC) is not accepted');
    if (marker === 0xfe) return fail(415, 'JPEG comments are not accepted');
    if (marker === 0xe0) {
      if (segmentLength < 8 || ascii(bytes, i + 2, 5) !== 'JFIF\0')
        return fail(415, 'Only a JFIF JPEG APP0 segment is accepted');
    } else if (marker === 0xc0) {
      if (frame) return fail(415, 'JPEG contains multiple frames');
      if (segmentLength < 8) return fail(415, 'Invalid JPEG frame header');
      const precision = bytes[i + 2]!;
      const height = u16be(bytes, i + 3);
      const width = u16be(bytes, i + 5);
      const count = bytes[i + 7]!;
      if (precision !== 8 || count < 1 || count > 4 || segmentLength !== 8 + count * 3)
        return fail(415, 'Only 8-bit baseline JPEG frames are accepted');
      const dims = checkDimensions(width, height);
      if (!dims.ok) return dims;
      const components: JpegComponent[] = [];
      for (let c = 0; c < count; c++) {
        const id = bytes[i + 8 + c * 3]!;
        const sampling = bytes[i + 9 + c * 3]!;
        const h = sampling >> 4;
        const v = sampling & 15;
        const tq = bytes[i + 10 + c * 3]!;
        if (h < 1 || h > 4 || v < 1 || v > 4 || tq > 3 || components.some(item => item.id === id))
          return fail(415, 'Invalid JPEG frame component');
        components.push({ id, h, v, tq });
      }
      if (components.reduce((sum, item) => sum + item.h * item.v, 0) > 10)
        return fail(415, 'JPEG sampling factors are too large');
      frame = { width, height, components };
    } else if (marker === 0xc2 || (marker >= 0xc3 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)) {
      return fail(415, 'Only baseline JPEG is accepted');
    } else if (marker === 0xdd) {
      return fail(415, 'JPEG restart intervals are not accepted');
    } else if (marker === 0xcc) {
      return fail(415, 'JPEG arithmetic coding is not accepted');
    } else if (marker === 0xc4) {
      let p = i + 2;
      while (p < segmentEnd) {
        if (p + 17 > segmentEnd) return fail(415, 'Invalid JPEG Huffman table');
        const tableClass = bytes[p]! >> 4;
        const tableId = bytes[p]! & 15;
        if (tableClass > 1 || tableId > 3) return fail(415, 'Invalid JPEG Huffman table');
        const bits = new Uint8Array(17);
        bits.set(bytes.subarray(p + 1, p + 17), 1);
        let symbols = 0;
        for (let len = 1; len <= 16; len++) symbols += bits[len]!;
        p += 17;
        if (symbols === 0 || p + symbols > segmentEnd) return fail(415, 'Invalid JPEG Huffman table');
        const table = buildJpegHuffman(bits, bytes.subarray(p, p + symbols));
        if (!table) return fail(415, 'Invalid JPEG Huffman table');
        huffmanTables.set(tableClass * 4 + tableId, table);
        p += symbols;
      }
      if (p !== segmentEnd || huffmanTables.size === 0) return fail(415, 'Invalid JPEG Huffman table');
    } else if (marker === 0xdb) {
      let p = i + 2;
      while (p < segmentEnd) {
        const precision = bytes[p]! >> 4;
        const tableId = bytes[p]! & 15;
        if (precision > 1 || tableId > 3) return fail(415, 'Invalid JPEG quantization table');
        const bytesPerValue = precision ? 2 : 1;
        p += 1;
        if (p + 64 * bytesPerValue > segmentEnd) return fail(415, 'Invalid JPEG quantization table');
        p += 64 * bytesPerValue;
        quantTables.add(tableId);
      }
      if (p !== segmentEnd || quantTables.size === 0) return fail(415, 'Invalid JPEG quantization table');
    } else if (marker === 0xda) {
      if (!frame) return fail(415, 'JPEG scan data before frame header');
      const count = bytes[i + 2]!;
      if (count < 1 || count > 4 || segmentLength !== 6 + count * 2)
        return fail(415, 'Invalid JPEG scan header');
      if (scans !== 0) return fail(415, 'JPEG multi-scan files are not accepted');
      const ss = bytes[i + 3 + count * 2]!;
      const se = bytes[i + 4 + count * 2]!;
      const approximation = bytes[i + 5 + count * 2]!;
      if (ss !== 0 || se !== 63 || approximation !== 0)
        return fail(415, 'Only baseline sequential JPEG is accepted');
      const scan: { component: JpegComponent; dc: JpegHuffman; ac: JpegHuffman }[] = [];
      for (let c = 0; c < count; c++) {
        const id = bytes[i + 3 + c * 2]!;
        const selectors = bytes[i + 4 + c * 2]!;
        const component = frame.components.find(item => item.id === id);
        if (!component) return fail(415, 'Invalid JPEG scan component');
        const dc = huffmanTables.get(selectors >> 4);
        const ac = huffmanTables.get(4 + (selectors & 15));
        if (!dc || !ac) return fail(415, 'JPEG scan references a missing Huffman table');
        if (scan.some(item => item.component === component)) return fail(415, 'Invalid JPEG scan component');
        scan.push({ component, dc, ac });
      }
      scans++;
      i = segmentEnd;
      // Find the marker that closes this entropy-coded segment.
      let closed = false;
      while (i < length) {
        if (bytes[i] !== 0xff) { i++; continue; }
        const next = bytes[i + 1]!;
        if (next === 0x00 || next === 0xff || (next >= 0xd0 && next <= 0xd7)) { i += 2; continue; }
        closed = true;
        break;
      }
      if (!closed) return fail(415, 'JPEG scan data is truncated');
      const decodeError = decodeJpegScan(bytes, segmentEnd, i, frame.components, scan,
        frame.width, frame.height, quantTables);
      if (decodeError) return fail(415, decodeError);
      continue;
    }
    i = segmentEnd;
  }
  return fail(415, 'JPEG is missing its end marker');
}

// ---------------------------------------------------------------------------
// PNG: every chunk is CRC-checked; only explicitly safe chunks are allowed;
// interlaced or palette-inconsistent files and oversized raw data are rejected.
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const PNG_SAFE_ANCILLARY = new Set(['pHYs', 'gAMA', 'sRGB', 'cHRM', 'tRNS']);
const PNG_CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const PNG_BIT_DEPTHS: Record<number, number[]> = {
  0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16],
};
type PngHeader = {
  width: number; height: number; bitDepth: number; colorType: number;
  rowBytes: number; rawBytes: number;
};

async function validatePng(bytes: Uint8Array): Promise<ImageStructureResult> {
  const length = bytes.byteLength;
  if (length < 8 || ascii(bytes, 0, 8) !== '\x89PNG\r\n\x1a\n') return fail(415, 'Invalid PNG signature');
  let i = 8;
  let header: PngHeader | null = null;
  let paletteBytes: Uint8Array | null = null;
  let seenIdat = false;
  let idatDone = false;
  const idat: Uint8Array[] = [];
  let compressed = 0;
  while (i + 12 <= length) {
    const chunkLength = u32be(bytes, i);
    const type = ascii(bytes, i + 4, 4);
    if (chunkLength > 0x7ffffff || i + 12 + chunkLength > length)
      return fail(415, 'PNG chunk length is invalid');
    const dataStart = i + 8;
    const dataEnd = dataStart + chunkLength;
    if (crc32(bytes, i + 4, dataEnd) !== u32be(bytes, dataEnd))
      return fail(415, 'PNG chunk checksum mismatch');
    if (type === 'IHDR') {
      if (header || i !== 8 || chunkLength !== 13) return fail(415, 'Invalid PNG header chunk');
      const width = u32be(bytes, dataStart);
      const height = u32be(bytes, dataStart + 4);
      const bitDepth = bytes[dataStart + 8]!;
      const colorType = bytes[dataStart + 9]!;
      if (bytes[dataStart + 10] !== 0 || bytes[dataStart + 11] !== 0)
        return fail(415, 'Unsupported PNG compression/filter method');
      if (bytes[dataStart + 12] !== 0) return fail(400, 'Interlaced PNG images are not accepted');
      if (!PNG_CHANNELS[colorType] || !PNG_BIT_DEPTHS[colorType]!.includes(bitDepth))
        return fail(415, 'Unsupported PNG color type or bit depth');
      const dims = checkDimensions(width, height);
      if (!dims.ok) return dims;
      const channels = PNG_CHANNELS[colorType]!;
      const rowBytes = Math.ceil((width * channels * bitDepth) / 8);
      header = { width, height, bitDepth, colorType, rowBytes, rawBytes: height * (1 + rowBytes) };
    } else if (!header) {
      return fail(415, 'PNG data before header chunk');
    } else if (type === 'PLTE') {
      if (seenIdat || chunkLength === 0 || chunkLength % 3 !== 0 || chunkLength > 768)
        return fail(415, 'Invalid PNG palette chunk');
      if (header.colorType === 3 && chunkLength / 3 > (1 << header.bitDepth))
        return fail(415, 'PNG palette has too many entries');
      paletteBytes = bytes.slice(dataStart, dataEnd);
    } else if (type === 'IDAT') {
      if (idatDone) return fail(415, 'PNG image data chunks are not contiguous');
      seenIdat = true;
      compressed += chunkLength;
      if (compressed > 2 * 1024 * 1024) return fail(413, 'PNG image data exceeds the allowed size');
      idat.push(bytes.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      if (chunkLength !== 0 || dataEnd + 4 !== length) return fail(415, 'Invalid PNG end chunk');
      if (!seenIdat || !idat.length) return fail(415, 'PNG has no image data');
      if (header.colorType === 3 && !paletteBytes) return fail(415, 'PNG palette is missing');
      return decodePngRows(header, idat, paletteBytes);
    } else if (PNG_SAFE_ANCILLARY.has(type)) {
      if (seenIdat) idatDone = true;
    } else {
      return fail(415, 'PNG metadata or unsupported chunks are not accepted');
    }
    if (seenIdat && type !== 'IDAT') idatDone = true;
    i = dataEnd + 4;
  }
  return fail(415, 'PNG is missing its end chunk');
}

function pngRowIsValid(row: Uint8Array, header: PngHeader, paletteBytes: Uint8Array | null): boolean {
  if (header.colorType !== 3) return true;
  const entries = paletteBytes ? paletteBytes.byteLength / 3 : 0;
  const { width, bitDepth } = header;
  if (bitDepth === 8) {
    for (let x = 0; x < width; x++) if (row[x]! >= entries) return false;
    return true;
  }
  const mask = (1 << bitDepth) - 1;
  for (let x = 0; x < width; x++) {
    const bit = x * bitDepth;
    const value = (row[bit >> 3]! >> (8 - bitDepth - (bit & 7))) & mask;
    if (value >= entries) return false;
  }
  return true;
}

/**
 * Streams the zlib IDAT data and fully decodes every PNG scanline: row filter
 * validation/unfiltering (None/Sub/Up/Average/Paeth), exact scanline count and
 * palette-index range checks. Rows are processed one at a time so a 25 MP image
 * never has to be held in memory.
 */
async function decodePngRows(
  header: PngHeader, idat: Uint8Array[], paletteBytes: Uint8Array | null,
): Promise<ImageStructureResult> {
  const chunks = new Uint8Array(idat.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of idat) { chunks.set(part, offset); offset += part.byteLength; }
  let stream: ReadableStream<Uint8Array>;
  try {
    stream = new Blob([chunks as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
  } catch { return fail(415, 'PNG image data could not be decompressed'); }
  const reader = stream.getReader();
  const { width, height, bitDepth, colorType, rowBytes, rawBytes } = header;
  const channels = PNG_CHANNELS[colorType]!;
  const bytesPerPixel = Math.max(1, Math.ceil((channels * bitDepth) / 8));
  let previous = new Uint8Array(rowBytes);
  let current = new Uint8Array(rowBytes);
  let filter = -1;
  let filled = 0;
  let rows = 0;
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (let index = 0; index < value.length; index++) {
        const byte = value[index]!;
        total++;
        if (total > rawBytes) {
          await reader.cancel().catch(() => undefined);
          return fail(415, 'PNG image data length does not match its header');
        }
        if (filter === -1) {
          if (byte > 4) {
            await reader.cancel().catch(() => undefined);
            return fail(415, 'PNG row filter is invalid');
          }
          filter = byte;
          filled = 0;
          continue;
        }
        const left = filled >= bytesPerPixel ? current[filled - bytesPerPixel]! : 0;
        const up = previous[filled]!;
        const upLeft = filled >= bytesPerPixel ? previous[filled - bytesPerPixel]! : 0;
        let output: number;
        if (filter === 0) output = byte;
        else if (filter === 1) output = (byte + left) & 0xff;
        else if (filter === 2) output = (byte + up) & 0xff;
        else if (filter === 3) output = (byte + ((left + up) >> 1)) & 0xff;
        else {
          const estimate = left + up - upLeft;
          const distanceLeft = Math.abs(estimate - left);
          const distanceUp = Math.abs(estimate - up);
          const distanceUpLeft = Math.abs(estimate - upLeft);
          const predictor = distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft
            ? left : distanceUp <= distanceUpLeft ? up : upLeft;
          output = (byte + predictor) & 0xff;
        }
        current[filled++] = output;
        if (filled === rowBytes) {
          if (!pngRowIsValid(current, header, paletteBytes)) {
            await reader.cancel().catch(() => undefined);
            return fail(415, 'PNG palette index is out of range');
          }
          rows++;
          const swap = previous;
          previous = current;
          current = swap;
          filter = -1;
        }
      }
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    return fail(415, 'PNG image data could not be decompressed');
  } finally { reader.releaseLock(); }
  if (rows !== height || filter !== -1 || total !== rawBytes)
    return fail(415, 'PNG image data length does not match its header');
  return checkDimensions(width, height);
}

// ---------------------------------------------------------------------------
// WebP: validate the RIFF container and image header dimensions, reject
// metadata/animation chunks, and require exactly one still image chunk.
// ---------------------------------------------------------------------------
function validateWebp(bytes: Uint8Array): ImageStructureResult {
  const length = bytes.byteLength;
  if (length < 20 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP')
    return fail(415, 'Invalid WebP header');
  if (u32le(bytes, 4) + 8 !== length) return fail(415, 'WebP container size is invalid');
  let i = 12;
  let image: { width: number; height: number } | null = null;
  let canvas: { width: number; height: number } | null = null;
  let hasAlphaChunk = false;
  while (i + 8 <= length) {
    const type = ascii(bytes, i, 4);
    const size = u32le(bytes, i + 4);
    const dataStart = i + 8;
    if (dataStart + size > length) return fail(415, 'WebP chunk length is invalid');
    const padded = i + 8 + size + (size & 1);
    if (padded > length) return fail(415, 'WebP chunk padding is invalid');
    const data = dataStart;
    if (type === 'VP8X') {
      if (size < 10 || image) return fail(415, 'Invalid WebP extended header');
      const flags = bytes[data]!;
      if (flags & 0x02) return fail(400, 'Animated WebP images are not accepted');
      canvas = { width: 1 + u24le(bytes, data + 4), height: 1 + u24le(bytes, data + 7) };
    } else if (type === 'VP8 ') {
      if (size < 10 || image) return fail(415, 'Invalid WebP image chunk');
      if (bytes[data]! & 0x01) return fail(415, 'WebP image chunk is not a keyframe');
      if (bytes[data + 3] !== 0x9d || bytes[data + 4] !== 0x01 || bytes[data + 5] !== 0x2a)
        return fail(415, 'Invalid WebP start code');
      image = {
        width: (bytes[data + 6]! | (bytes[data + 7]! << 8)) & 0x3fff,
        height: (bytes[data + 8]! | (bytes[data + 9]! << 8)) & 0x3fff,
      };
    } else if (type === 'VP8L') {
      if (size < 5 || image) return fail(415, 'Invalid WebP lossless chunk');
      if (bytes[data] !== 0x2f) return fail(415, 'Invalid WebP lossless signature');
      const bits = u32le(bytes, data + 1);
      if (((bits >>> 29) & 0x7) !== 0) return fail(415, 'Unsupported WebP lossless version');
      image = { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    } else if (type === 'ALPH') {
      hasAlphaChunk = true;
    } else if (type === 'EXIF' || type === 'XMP ' || type === 'ICCP' || type === 'ANIM' || type === 'ANMF') {
      return fail(415, 'WebP metadata or animation chunks are not accepted');
    } else {
      return fail(415, 'Unsupported WebP chunk');
    }
    i = padded;
  }
  if (!image) return fail(415, 'WebP has no still image data');
  if (canvas && (canvas.width < image.width || canvas.height < image.height))
    return fail(415, 'WebP canvas is smaller than its image');
  void hasAlphaChunk;
  return checkDimensions(image.width, image.height);
}

export async function validateImageStructure(bytes: Uint8Array, type: SafeMime): Promise<ImageStructureResult> {
  if (type === 'image/jpeg') return validateJpeg(bytes);
  if (type === 'image/png') return validatePng(bytes);
  if (type === 'image/webp') return validateWebp(bytes);
  return fail(415, 'Unsupported image format');
}
