import { GET as getPropertyImage } from '@/app/api/line/property-image/route';

export const runtime = 'nodejs';

/** Keep the existing photo URL, with the same published-only handling as LINE. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  url.searchParams.set('id', id);
  return getPropertyImage(new Request(url, { method: 'GET' }));
}
