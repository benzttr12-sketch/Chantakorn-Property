import sharp from 'sharp';
import { getFirestoreDocument } from '@/lib/firestore-rest';
import { selectPropertyImage } from '@/lib/line-property-image';

export const runtime = 'nodejs';

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const notFound = () => new Response('Property photo not found', { status: 404, headers });

/** Expose only photos already attached to a published listing, for LINE to download. */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const id = params.get('id');
  if (!id || id.length > 256 || id === '.' || id === '..' || /[/\\]/.test(id)) {
    return new Response('Invalid property ID', { status: 400, headers });
  }

  const index = params.get('index');
  if (index !== null && (!/^\d+$/.test(index) || Number(index) > 59)) {
    return new Response('Invalid photo index', { status: 400, headers });
  }

  try {
    const response = await getFirestoreDocument('properties', id);
    if (response.status === 403 || response.status === 404) return notFound();
    if (!response.ok) return new Response('Property photo temporarily unavailable', { status: 503, headers });
    const { fields } = await response.json();
    if (fields?.published?.booleanValue !== true) return notFound();

    const images = fields.images?.arrayValue?.values?.map((value: { stringValue?: string }) => value.stringValue);
    const image = selectPropertyImage({
      cover_image: index === null ? fields.cover_image?.stringValue : images?.[Number(index)],
      images: index === null ? images : [fields.cover_image?.stringValue],
    });
    if (!image) return notFound();
    if (!image.startsWith('data:')) {
      return new Response(null, { status: 307, headers: { ...headers, Location: image } });
    }

    const data = Buffer.from(image.slice(image.indexOf(',') + 1), 'base64');
    if (!data.length || data.length > 1_500_000) return notFound();
    try {
      const jpeg = await sharp(data, { limitInputPixels: 25_000_000 })
        .rotate()
        .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      return new Response(new Uint8Array(jpeg), {
        headers: { ...headers, 'Content-Type': 'image/jpeg', 'Content-Length': String(jpeg.length) },
      });
    } catch {
      return notFound();
    }
  } catch {
    return new Response('Property photo temporarily unavailable', { status: 503, headers });
  }
}
