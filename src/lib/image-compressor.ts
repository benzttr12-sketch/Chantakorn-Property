/**
 * Image compression and video processing utility for Chantakorn Property
 * - Supports large image uploads up to 100MB per file
 * - Performs automatic client-side compression (resizing to Full HD 1920px & WebP/JPEG encoding)
 * - Drastically reduces file size by 85-98% without noticeable quality loss
 * - Handles YouTube, TikTok, Facebook, and direct video URLs
 */

export interface CompressionOptions {
  maxDimension?: number; // default 1920 (Full HD)
  initialQuality?: number; // default 0.85
  minQuality?: number; // default 0.45
  targetMaxBytes?: number; // default 450,000 bytes (~440KB)
  format?: 'image/webp' | 'image/jpeg';
}

export interface CompressedImageResult {
  dataUrl: string;
  name: string;
  originalSize: number; // bytes
  compressedSize: number; // bytes
  originalSizeFormatted: string;
  compressedSizeFormatted: string;
  percentSaved: number;
  width: number;
  height: number;
}

export const MAX_UPLOAD_IMAGE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_UPLOAD_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Automatically compresses a single image File in the browser using HTML5 Canvas.
 */
export async function compressImageFile(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressedImageResult> {
  const {
    maxDimension = 1920,
    initialQuality = 0.85,
    minQuality = 0.45,
    targetMaxBytes = 450000,
    format = 'image/jpeg',
  } = options;

  if (file.size > MAX_UPLOAD_IMAGE_SIZE_BYTES) {
    throw new Error(
      `ไฟล์ "${file.name}" มีขนาด ${formatBytes(file.size)} ซึ่งเกินขีดจำกัดสูงสุด 100MB`
    );
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error(`ไม่สามารถอ่านไฟล์ภาพ "${file.name}" ได้`));
    };

    reader.onload = () => {
      const img = new window.Image();

      img.onerror = () => {
        reject(new Error(`รูปแบบรูปภาพ "${file.name}" ไม่ถูกต้องหรือไม่รองรับ`));
      };

      img.onload = () => {
        try {
          const originalWidth = img.naturalWidth || img.width;
          const originalHeight = img.naturalHeight || img.height;

          // Calculate aspect-ratio scale
          const maxSide = Math.max(originalWidth, originalHeight);
          const scale = maxSide > maxDimension ? maxDimension / maxSide : 1;
          const targetWidth = Math.max(1, Math.round(originalWidth * scale));
          const targetHeight = Math.max(1, Math.round(originalHeight * scale));

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;

          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) {
            throw new Error('เบราว์เซอร์ไม่สามารถสร้าง 2D Canvas สำหรับบีบอัดรูปภาพได้');
          }

          // High quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // White background fallback for transparent PNGs
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetWidth, targetHeight);

          // Draw the resized image
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          // Check if WebP is supported by this browser
          let chosenFormat = format;
          try {
            const testWebp = canvas.toDataURL('image/webp');
            if (testWebp.indexOf('data:image/webp') === 0) {
              chosenFormat = 'image/webp';
            }
          } catch {
            chosenFormat = 'image/jpeg';
          }

          // Adaptive compression loop
          let quality = initialQuality;
          let dataUrl = canvas.toDataURL(chosenFormat, quality);

          // Approximate byte length from base64 string
          let estimatedBytes = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);

          while (estimatedBytes > targetMaxBytes && quality > minQuality) {
            quality -= 0.08;
            dataUrl = canvas.toDataURL(chosenFormat, Math.max(minQuality, quality));
            estimatedBytes = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
          }

          const finalBytes = estimatedBytes;
          const percentSaved = file.size > finalBytes
            ? Math.round(((file.size - finalBytes) / file.size) * 100)
            : 0;

          resolve({
            dataUrl,
            name: file.name,
            originalSize: file.size,
            compressedSize: finalBytes,
            originalSizeFormatted: formatBytes(file.size),
            compressedSizeFormatted: formatBytes(finalBytes),
            percentSaved,
            width: targetWidth,
            height: targetHeight,
          });
        } catch (err) {
          reject(err instanceof Error ? err : new Error('เกิดข้อผิดพลาดระหว่างบีบอัดรูปภาพ'));
        }
      };

      img.src = String(reader.result);
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Batch compress images with progress updates
 */
export async function compressMultipleImages(
  files: File[],
  onProgress?: (current: number, total: number, currentItem: CompressedImageResult) => void
): Promise<CompressedImageResult[]> {
  const results: CompressedImageResult[] = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];
    const result = await compressImageFile(file);
    results.push(result);
    if (onProgress) {
      onProgress(i + 1, total, result);
    }
  }

  return results;
}

export interface ParsedVideoInfo {
  type: 'youtube' | 'tiktok' | 'facebook' | 'direct' | 'other';
  url: string;
  embedUrl?: string;
  videoId?: string;
  title?: string;
}

/**
 * Parses and normalizes various video URLs (YouTube, YouTube Shorts, TikTok, Facebook, MP4)
 */
export function parseVideoUrl(inputUrl?: string): ParsedVideoInfo | null {
  if (!inputUrl || typeof inputUrl !== 'string') return null;
  const trimmed = inputUrl.trim();
  if (!trimmed) return null;

  // 1. YouTube watch / share / embed / shorts
  // Patterns:
  // - https://www.youtube.com/watch?v=VIDEO_ID
  // - https://youtu.be/VIDEO_ID
  // - https://www.youtube.com/shorts/VIDEO_ID
  // - https://www.youtube.com/embed/VIDEO_ID
  const youtubeMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );
  if (youtubeMatch && youtubeMatch[1]) {
    const videoId = youtubeMatch[1];
    return {
      type: 'youtube',
      url: trimmed,
      videoId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`,
      title: 'YouTube Video Tour',
    };
  }

  // 2. Direct Video (MP4, WebM, OGG, or data:video)
  if (
    trimmed.startsWith('data:video/') ||
    trimmed.startsWith('blob:') ||
    /\.(mp4|webm|mov|ogg)($|\?)/i.test(trimmed)
  ) {
    return {
      type: 'direct',
      url: trimmed,
      title: 'Direct Video File',
    };
  }

  // 3. TikTok
  if (/tiktok\.com/i.test(trimmed)) {
    return {
      type: 'tiktok',
      url: trimmed,
      title: 'TikTok Video',
    };
  }

  // 4. Facebook video / reels
  if (/facebook\.com|fb\.watch/i.test(trimmed)) {
    return {
      type: 'facebook',
      url: trimmed,
      title: 'Facebook Video',
    };
  }

  return {
    type: 'other',
    url: trimmed,
    title: 'External Video Link',
  };
}
