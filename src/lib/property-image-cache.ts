import { SAMPLE_PROPERTIES } from '@/data/sample-properties';

// In-memory property image cache for instant serving by ID, slug, or title
const memoryImageCache = new Map<string, string>();

/**
 * Cache property image data (Base64 data URL or remote URL) in memory
 */
export function cachePropertyImage(key: string, imageData: string): void {
  if (!key || !imageData) return;
  const trimmedKey = key.trim();
  memoryImageCache.set(trimmedKey, imageData);
  try {
    memoryImageCache.set(decodeURIComponent(trimmedKey), imageData);
    memoryImageCache.set(encodeURIComponent(trimmedKey), imageData);
  } catch {}
}

/**
 * Retrieve cached property image data
 */
export function getCachedPropertyImage(key: string): string | null {
  if (!key) return null;
  const trimmedKey = key.trim();
  if (memoryImageCache.has(trimmedKey)) {
    return memoryImageCache.get(trimmedKey)!;
  }
  try {
    const decoded = decodeURIComponent(trimmedKey);
    if (memoryImageCache.has(decoded)) {
      return memoryImageCache.get(decoded)!;
    }
  } catch {}
  return null;
}

/**
 * Extract YouTube thumbnail from video URL
 */
export function extractYouTubeThumbnail(videoUrl?: string): string | null {
  if (!videoUrl || typeof videoUrl !== 'string') return null;
  const match = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  if (match && match[1]) {
    return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  }
  return null;
}

/**
 * Check if a URL is a publicly accessible external HTTPS URL (not local or preview domain)
 */
function isPublicHttpsUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!/^https:\/\//i.test(trimmed)) return false;
  if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1') || trimmed.includes('.run.app')) {
    return false;
  }
  return true;
}

/**
 * Resolve direct, publicly accessible HTTPS image URL for LINE Flex Messages, Social Cards, and Webhooks.
 * LINE Messaging API servers in Tokyo require a 100% public, unauthenticated HTTPS image URL.
 */
export function resolvePropertyHeroImageUrl(
  property: {
    id?: string;
    slug?: string;
    title?: string;
    cover_image?: string;
    images?: string[];
    property_type?: string;
    video_url?: string;
  },
  hostOrigin?: string
): string {
  // 1. If property has a YouTube video URL, use its direct public high-resolution video thumbnail
  const ytThumb = extractYouTubeThumbnail(property.video_url);
  if (ytThumb) {
    return ytThumb;
  }

  // 2. Check if a direct public HTTPS URL is already provided
  const rawImage = (typeof property.cover_image === 'string' && property.cover_image.trim().length > 0)
    ? property.cover_image.trim()
    : (Array.isArray(property.images) && property.images[0] ? property.images[0].trim() : '');

  if (isPublicHttpsUrl(rawImage)) {
    // If not the old stock pool villa placeholder, use it directly
    if (!rawImage.includes('photo-1600596542815-ffad4c1539a9')) {
      return rawImage;
    }
  }

  // 3. Match against known properties (e.g. Singhanakhon land plot)
  const titleLower = (property.title || '').toLowerCase();
  const slugLower = (property.slug || '').toLowerCase();
  const idLower = (property.id || '').toLowerCase();

  const matchedSample = SAMPLE_PROPERTIES.find(
    (p) =>
      (property.id && p.id === property.id) ||
      (property.slug && p.slug === property.slug) ||
      (property.title && p.title?.toLowerCase() === titleLower) ||
      titleLower.includes('สิงหนคร') ||
      slugLower.includes('singhanakhon') ||
      idLower.includes('singhanakhon')
  );

  if (matchedSample) {
    if (matchedSample.video_url) {
      const sampleYt = extractYouTubeThumbnail(matchedSample.video_url);
      if (sampleYt) return sampleYt;
    }
    if (isPublicHttpsUrl(matchedSample.cover_image)) {
      return matchedSample.cover_image!;
    }
  }

  // 4. Default high-quality authentic real estate visuals by category that LINE servers can load 100% reliably
  const isLand = property.property_type === 'land' || titleLower.includes('ที่ดิน') || slugLower.includes('land');
  const isCondo = property.property_type === 'condo' || titleLower.includes('คอนโด') || slugLower.includes('condo');
  const isCommercial = property.property_type === 'commercial' || titleLower.includes('พาณิชย์') || titleLower.includes('ตึกแถว');

  if (isLand) {
    // Real property land in Singhanakhon / Songkhla
    return 'https://img.youtube.com/vi/ScMzIvxBSi4/hqdefault.jpg';
  } else if (isCondo) {
    return 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80';
  } else if (isCommercial) {
    return 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80';
  }

  // Modern residential house / home in Hat Yai
  return 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80';
}
