type PropertyPhoto = { id?: string; cover_image?: string; images?: string[] };

const EMBEDDED_IMAGE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/i;

/** Use the selected property cover first, then an actual gallery photo. */
export function selectPropertyImage(property: PropertyPhoto): string | null {
  const candidates = [property.cover_image, ...(Array.isArray(property.images) ? property.images : [])];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const image = candidate.trim();
    if (image.length <= 2_000_000 && EMBEDDED_IMAGE.test(image)) return image.replace(/^data:/i, 'data:');
    if (!/^https:\/\//i.test(image) || image.length > 2000 || /[\u0000-\u0020]/.test(image)) continue;
    try {
      const url = new URL(image);
      if (url.protocol === 'https:' && !url.username && !url.password && url.href.length <= 2000) return url.href;
    } catch {
      // Skip invalid image values and continue to the property's gallery.
    }
  }
  return null;
}

export function getLinePropertyImageUrl(property: PropertyPhoto, imageOrigin: string): string | null {
  const image = selectPropertyImage(property);
  if (!image) return null;
  if (image.startsWith('data:')) {
    if (!property.id) return null;
    return `${imageOrigin}/api/line/property-image?id=${encodeURIComponent(property.id)}`;
  }
  return image;
}
