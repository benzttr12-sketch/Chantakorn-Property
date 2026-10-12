/** Client-side photo preparation. Only decoded raster images are saved. */
export interface WatermarkOptions {
  enableWatermark?: boolean; // default true
  watermarkText?: string; // default 'CHANTAKORN PROPERTY'
  phoneText?: string; // default official phone and LINE OA
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
}

export interface CompressionOptions extends WatermarkOptions {
  maxDimension?: number; // default 1920, maximum 4096
  initialQuality?: number; // default 0.85
  minQuality?: number; // default 0.45
  targetMaxBytes?: number; // default 450,000 bytes; enforced after encoding
  format?: 'image/webp' | 'image/jpeg';
}

export interface CompressedImageResult {
  dataUrl: string;
  name: string;
  originalSize: number;
  compressedSize: number;
  originalSizeFormatted: string;
  compressedSizeFormatted: string;
  percentSaved: number;
  width: number;
  height: number;
}

export const MAX_UPLOAD_IMAGE_SIZE_BYTES = 100 * 1024 * 1024;
export const MAX_UPLOAD_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
export const MAX_DECODED_IMAGE_PIXELS = 60_000_000;
export const DEFAULT_WATERMARK_PHONE_TEXT = '081-604-0097 | LINE @930xzcyi';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif',
]);
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function roundedRectangle(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

/** The same Building2 glyph and gold badge as public/favicon.svg (ISC license). */
function drawBrandLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 64, size / 64);
  const gold = ctx.createLinearGradient(0, 0, 64, 64);
  gold.addColorStop(0, '#D7BC42');
  gold.addColorStop(0.5, '#C9A227');
  gold.addColorStop(1, '#D97706');
  ctx.fillStyle = gold;
  roundedRectangle(ctx, 0, 0, 64, 64, 19.2);
  ctx.fill();
  ctx.translate(12.8, 12.8);
  ctx.scale(1.6, 1.6);
  ctx.strokeStyle = '#020812';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(6, 22);
  ctx.lineTo(6, 4);
  ctx.quadraticCurveTo(6, 2, 8, 2);
  ctx.lineTo(16, 2);
  ctx.quadraticCurveTo(18, 2, 18, 4);
  ctx.lineTo(18, 22);
  ctx.closePath();
  ctx.moveTo(6, 12);
  ctx.lineTo(4, 12);
  ctx.quadraticCurveTo(2, 12, 2, 14);
  ctx.lineTo(2, 20);
  ctx.quadraticCurveTo(2, 22, 4, 22);
  ctx.lineTo(6, 22);
  ctx.moveTo(18, 9);
  ctx.lineTo(20, 9);
  ctx.quadraticCurveTo(22, 9, 22, 11);
  ctx.lineTo(22, 20);
  ctx.quadraticCurveTo(22, 22, 20, 22);
  ctx.lineTo(18, 22);
  for (const windowY of [6, 10, 14, 18]) {
    ctx.moveTo(10, windowY);
    ctx.lineTo(14, windowY);
  }
  ctx.stroke();
  ctx.restore();
}

/** Keeps the complete badge inside landscape, portrait and tiny images. */
export function drawBottomRightWatermark(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  options: WatermarkOptions = {}
) {
  if (options.enableWatermark === false) return;
  if (!Number.isFinite(canvasWidth) || !Number.isFinite(canvasHeight) || canvasWidth <= 0 || canvasHeight <= 0) {
    throw new Error('ขนาดรูปภาพไม่ถูกต้อง');
  }
  const {
    watermarkText = 'CHANTAKORN PROPERTY',
    phoneText = DEFAULT_WATERMARK_PHONE_TEXT,
    position = 'bottom-right',
  } = options;
  ctx.save();
  try {
    ctx.font = `800 18px ${FONT_FAMILY}`;
    const mainWidth = ctx.measureText(watermarkText).width;
    ctx.font = `600 11px ${FONT_FAMILY}`;
    const subWidth = ctx.measureText(phoneText).width;
    const boxWidth = Math.max(mainWidth, subWidth) + 84;
    const boxHeight = 62;
    const scale = Math.min(
      Math.max(0.45, Math.min(canvasWidth, canvasHeight) / 1000),
      canvasWidth / (boxWidth + 40),
      canvasHeight / (boxHeight + 40)
    );
    const margin = 20 * scale;
    const width = boxWidth * scale;
    const height = boxHeight * scale;
    const boxX = position === 'center' ? (canvasWidth - width) / 2
      : position.endsWith('left') ? margin : canvasWidth - width - margin;
    const boxY = position === 'center' ? (canvasHeight - height) / 2
      : position.startsWith('top') ? margin : canvasHeight - height - margin;
    ctx.translate(boxX, boxY);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    roundedRectangle(ctx, 0, 0, boxWidth, boxHeight, 10);
    ctx.fill();
    drawBrandLogo(ctx, 16, 11, 40);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 18px ${FONT_FAMILY}`;
    ctx.fillText(watermarkText, 68, 28);
    ctx.fillStyle = '#FBBF24';
    ctx.font = `600 11px ${FONT_FAMILY}`;
    ctx.fillText(phoneText, 68, 45);
  } finally {
    ctx.restore();
  }
}

function ensureBrowser() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('กรุณาประมวลผลรูปภาพผ่านเบราว์เซอร์');
  }
}

function detectedImageType(bytes: Uint8Array): string | null {
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && ascii(1, 7) === 'PNG\r\n\x1a\n') return 'image/png';
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  if (ascii(4, 4) === 'ftyp') {
    const brands = [ascii(8, 4), ...Array.from({ length: 4 }, (_, i) => ascii(16 + i * 4, 4))];
    if (brands.some(brand => brand === 'avif' || brand === 'avis')) return 'image/avif';
    if (brands.some(brand => ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand))) return 'image/heif';
  }
  return null;
}

async function validateImageFile(file: File) {
  if (!file.size) throw new Error(`ไฟล์รูปภาพ "${file.name}" ว่างเปล่า`);
  if (file.size > MAX_UPLOAD_IMAGE_SIZE_BYTES) {
    throw new Error(`ไฟล์ "${file.name}" มีขนาด ${formatBytes(file.size)} ซึ่งเกินขีดจำกัดสูงสุด 100MB`);
  }
  const declaredType = file.type.toLowerCase();
  if (declaredType && !ALLOWED_IMAGE_TYPES.has(declaredType)) {
    throw new Error('รองรับภาพ JPG, PNG, WebP, GIF, AVIF และ HEIC/HEIF ที่เบราว์เซอร์อ่านได้เท่านั้น');
  }
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const actualType = detectedImageType(bytes);
  const declaredIsHeif = declaredType === 'image/heic' || declaredType === 'image/heif';
  if (!actualType || (declaredType && actualType !== declaredType && !(declaredIsHeif && actualType === 'image/heif'))) {
    throw new Error(`รูปแบบรูปภาพ "${file.name}" ไม่ถูกต้องหรือไม่รองรับ`);
  }
}

function loadImageFile(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`รูปแบบรูปภาพ "${file.name}" ไม่ถูกต้องหรือไม่รองรับ`));
    };
    img.src = objectUrl;
  });
}

function encodedImageBytes(dataUrl: string): number {
  const match = /^data:image\/(?:jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || match[1].length % 4 !== 0) throw new Error('เบราว์เซอร์ไม่สามารถเข้ารหัสรูปภาพได้');
  const base64 = match[1];
  return base64.length / 4 * 3 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
}

/** Rejects corrupted/unbounded inputs, and never returns an image above the byte budget. */
export async function compressImageFile(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressedImageResult> {
  ensureBrowser();
  const {
    maxDimension = 1920,
    initialQuality = 0.85,
    minQuality = 0.45,
    targetMaxBytes = 450000,
    format = 'image/webp',
    enableWatermark = true,
  } = options;
  if (!Number.isInteger(maxDimension) || maxDimension < 1 || maxDimension > 4096
    || !Number.isFinite(initialQuality) || initialQuality < 0.1 || initialQuality > 1
    || !Number.isFinite(minQuality) || minQuality < 0.1 || minQuality > initialQuality
    || !Number.isInteger(targetMaxBytes) || targetMaxBytes < 1 || targetMaxBytes > MAX_UPLOAD_IMAGE_SIZE_BYTES
    || !['image/jpeg', 'image/webp'].includes(format)) {
    throw new Error('การตั้งค่าบีบอัดรูปภาพไม่ถูกต้อง');
  }
  await validateImageFile(file);
  const img = await loadImageFile(file);
  const originalWidth = img.naturalWidth || img.width;
  const originalHeight = img.naturalHeight || img.height;
  if (!Number.isInteger(originalWidth) || !Number.isInteger(originalHeight)
    || originalWidth < 1 || originalHeight < 1
    || originalWidth > 16384 || originalHeight > 16384
    || originalWidth * originalHeight > MAX_DECODED_IMAGE_PIXELS) {
    throw new Error('รูปภาพมีความละเอียดเกินขีดจำกัด 60 ล้านพิกเซล หรือขนาดภาพไม่ถูกต้อง กรุณาย่อภาพก่อนอัปโหลด');
  }
  const resize = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight));
  let width = Math.max(1, Math.round(originalWidth * resize));
  let height = Math.max(1, Math.round(originalHeight * resize));
  const minimumLongestSide = Math.min(128, Math.max(width, height));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('เบราว์เซอร์ไม่สามารถสร้าง 2D Canvas สำหรับบีบอัดรูปภาพได้');
  let dataUrl = '';
  let finalBytes = 0;
  for (let attempt = 0; attempt < 16; attempt++) {
    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    if (enableWatermark) drawBottomRightWatermark(ctx, width, height, options);
    let quality = initialQuality;
    while (true) {
      dataUrl = canvas.toDataURL(format, quality);
      if (format === 'image/webp' && !dataUrl.startsWith('data:image/webp;')) {
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      finalBytes = encodedImageBytes(dataUrl);
      if (finalBytes <= targetMaxBytes) {
        return {
          dataUrl,
          name: file.name,
          originalSize: file.size,
          compressedSize: finalBytes,
          originalSizeFormatted: formatBytes(file.size),
          compressedSizeFormatted: formatBytes(finalBytes),
          percentSaved: file.size > finalBytes ? Math.round((file.size - finalBytes) / file.size * 100) : 0,
          width,
          height,
        };
      }
      if (quality <= minQuality) break;
      quality = Math.max(minQuality, Math.round((quality - 0.08) * 100) / 100);
    }
    const longestSide = Math.max(width, height);
    if (longestSide <= minimumLongestSide) break;
    const scale = Math.max(minimumLongestSide / longestSide, Math.min(0.75, Math.sqrt(targetMaxBytes / finalBytes) * 0.9));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }
  throw new Error(`ไม่สามารถย่อรูป "${file.name}" ให้ไม่เกิน ${formatBytes(targetMaxBytes)} โดยคงคุณภาพที่เหมาะสม กรุณาเลือกรูปอื่น`);
}

export async function compressMultipleImages(
  files: File[],
  onProgress?: (current: number, total: number, currentItem: CompressedImageResult) => void,
  options: CompressionOptions = {}
): Promise<CompressedImageResult[]> {
  const results: CompressedImageResult[] = [];
  for (let i = 0; i < files.length; i++) {
    const result = await compressImageFile(files[i], options);
    results.push(result);
    onProgress?.(i + 1, files.length, result);
  }
  return results;
}

/** Only accepts image data; failures cannot silently discard the requested watermark. */
export async function addWatermarkToImage(dataUrl: string, options: WatermarkOptions = {}): Promise<string> {
  ensureBrowser();
  const match = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || !ALLOWED_IMAGE_TYPES.has(match[1]) || match[2].length > Math.ceil(MAX_UPLOAD_IMAGE_SIZE_BYTES / 3) * 4) {
    throw new Error('ข้อมูลรูปภาพไม่ถูกต้องหรือมีขนาดเกิน 100MB');
  }
  const binary = atob(match[2]);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const file = new File([bytes], 'watermarked-image', { type: match[1] });
  return (await compressImageFile(file, options)).dataUrl;
}

function validImageUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('กรุณาระบุลิงก์รูปภาพ HTTPS ที่ถูกต้อง'); }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('ลิงก์รูปภาพต้องใช้ HTTPS และไม่มีชื่อผู้ใช้หรือรหัสผ่านในลิงก์');
  }
  return url;
}

/** Downloads a bounded HTTPS raster image; CORS, network and decode errors are visible. */
export async function compressImageFromUrl(
  imageUrl: string,
  options: CompressionOptions = {}
): Promise<{ dataUrl: string; processed: boolean; originalSize?: number; compressedSize?: number; percentSaved?: number }> {
  ensureBrowser();
  const url = validImageUrl(imageUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url.href, {
      mode: 'cors', credentials: 'omit', redirect: 'error', signal: controller.signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('ไม่สามารถดาวน์โหลดรูปภาพจากลิงก์นี้ได้');
    }
    if (response.url) validImageUrl(response.url);
    const length = Number(response.headers.get('content-length'));
    if (length > MAX_UPLOAD_IMAGE_SIZE_BYTES) {
      await response.body?.cancel();
      throw new Error('รูปภาพจากลิงก์มีขนาดเกิน 100MB');
    }
    const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(type)) {
      await response.body?.cancel();
      throw new Error('ลิงก์นี้ไม่ได้ส่งไฟล์รูปภาพที่รองรับ');
    }
    if (!response.body) throw new Error('ไม่สามารถอ่านรูปภาพจากลิงก์นี้ได้');
    const reader = response.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_UPLOAD_IMAGE_SIZE_BYTES) {
          await reader.cancel();
          throw new Error('รูปภาพจากลิงก์มีขนาดเกิน 100MB');
        }
        chunks.push(new Uint8Array(value));
      }
    } finally {
      reader.releaseLock();
    }
    const name = url.pathname.split('/').pop() || 'image';
    const file = new File(chunks, name, { type });
    const result = await compressImageFile(file, options);
    return {
      dataUrl: result.dataUrl, processed: true, originalSize: result.originalSize,
      compressedSize: result.compressedSize, percentSaved: result.percentSaved,
    };
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) {
      throw new Error('ดาวน์โหลดรูปภาพไม่สำเร็จ ลิงก์อาจไม่อนุญาตให้เข้าถึง กรุณาดาวน์โหลดรูปแล้วอัปโหลดเป็นไฟล์');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export interface ParsedVideoInfo {
  type: 'youtube' | 'tiktok' | 'facebook' | 'direct' | 'other';
  url: string;
  embedUrl?: string;
  videoId?: string;
  title?: string;
}

/** Parses existing video links without changing the video workflow. */
export function parseVideoUrl(inputUrl?: string): ParsedVideoInfo | null {
  if (!inputUrl || typeof inputUrl !== 'string') return null;
  const trimmed = inputUrl.trim();
  if (!trimmed) return null;
  const youtubeMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );
  if (youtubeMatch && youtubeMatch[1]) {
    const videoId = youtubeMatch[1];
    return {
      type: 'youtube', url: trimmed, videoId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`,
      title: 'YouTube Video Tour',
    };
  }
  if (trimmed.startsWith('data:video/') || trimmed.startsWith('blob:') || /\.(mp4|webm|mov|ogg)($|\?)/i.test(trimmed)) {
    return { type: 'direct', url: trimmed, title: 'Direct Video File' };
  }
  if (/tiktok\.com/i.test(trimmed)) return { type: 'tiktok', url: trimmed, title: 'TikTok Video' };
  if (/facebook\.com|fb\.watch/i.test(trimmed)) return { type: 'facebook', url: trimmed, title: 'Facebook Video' };
  return { type: 'other', url: trimmed, title: 'External Video Link' };
}
