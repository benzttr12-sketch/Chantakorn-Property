/** Only JPEG, PNG and WebP. SVG/HTML/PDF and arbitrary content are never accepted. */
export const MAX_MEDIA_BYTES = 2 * 1024 * 1024;
export const MAX_PROPERTY_IMAGES = 60;
export const MAX_INQUIRY_IMAGES = 15;

export type SafeMime = 'image/jpeg' | 'image/png' | 'image/webp';
const MIME_EXT: Record<SafeMime, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
};
const MEDIA_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OWNER_ID_PATTERN = /^[A-Za-z0-9_-]{1,96}$/;

export function validMediaId(id: string): boolean { return MEDIA_ID_PATTERN.test(id); }
export function validOwnerId(id: string): boolean { return OWNER_ID_PATTERN.test(id); }
export function mediaExtension(type: SafeMime): string { return MIME_EXT[type]; }

/** Sniff type and cheap integrity markers; it does NOT fully decode the image. */
export function sniffImage(bytes: Uint8Array): SafeMime | null {
  const length = bytes.byteLength;
  if (length >= 16 && bytes[0] === 0xff && bytes[1] === 0xd8 &&
      bytes[2] === 0xff && bytes[length - 2] === 0xff && bytes[length - 1] === 0xd9) return 'image/jpeg';
  if (length >= 33 && [137, 80, 78, 71, 13, 10, 26, 10].every((x, i) => bytes[i] === x) &&
      bytes[length - 12] === 0 && bytes[length - 11] === 0 && bytes[length - 10] === 0 &&
      bytes[length - 9] === 0 && bytes[length - 8] === 73 && bytes[length - 7] === 69 &&
      bytes[length - 6] === 78 && bytes[length - 5] === 68) return 'image/png';
  if (length >= 20 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP' &&
      (bytes[4]! | (bytes[5]! << 8) | (bytes[6]! << 16) | (bytes[7]! << 24)) >>> 0 === length - 8)
    return 'image/webp';
  return null;
}

export type ImageReadResult =
  | { ok: true; bytes: Uint8Array; type: SafeMime }
  | { ok: false; status: 400 | 413 | 415; error: string };

/** Stream with an absolute byte cap: don't trust the supplied Content-Length. */
export async function readBoundedImage(req: Request): Promise<ImageReadResult> {
  if (req.headers.get('Content-Encoding')) return { ok: false, status: 415, error: 'Compressed requests not accepted' };
  const declaredType = req.headers.get('Content-Type')?.toLowerCase() || '';
  if (declaredType !== 'image/jpeg' && declaredType !== 'image/png' && declaredType !== 'image/webp')
    return { ok: false, status: 415, error: 'Unsupported image format' };
  const contentLength = req.headers.get('Content-Length');
  // Browsers or proxies may forward a chunked body without Content-Length; the
  // stream cap below is the real limit. A declared length must still be sane and
  // match the bytes actually received.
  if (contentLength !== null && !/^[1-9][0-9]{0,7}$/.test(contentLength))
    return { ok: false, status: 400, error: 'Invalid Content-Length' };
  const intendedSize = contentLength === null ? null : Number(contentLength);
  if (intendedSize !== null && intendedSize > MAX_MEDIA_BYTES) return { ok: false, status: 413, error: 'Image exceeds 2 MiB limit' };
  if (!req.body) return { ok: false, status: 400, error: 'Missing body' };
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = req.body.getReader();
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > MAX_MEDIA_BYTES) {
        await reader.cancel();
        return { ok: false, status: 413, error: 'Image exceeds 2 MiB limit' };
      }
      chunks.push(result.value);
    }
  } catch {
    return { ok: false, status: 400, error: 'Incomplete image body' };
  } finally {
    reader.releaseLock();
  }
  if (intendedSize !== null && total !== intendedSize) return { ok: false, status: 400, error: 'Content-Length mismatch' };
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const actualType = sniffImage(bytes);
  if (!actualType || actualType !== declaredType)
    return { ok: false, status: 415, error: 'Image bytes do not match Content-Type' };
  return { ok: true, bytes, type: actualType };
}

/** Require a browser origin for write routes, never mistake CORS for authentication. */
export function validBrowserOrigin(origin: string | null, allowed: string | undefined): boolean {
  return !!origin && !!allowed && origin === allowed && /^https?:\/\//.test(allowed);
}
