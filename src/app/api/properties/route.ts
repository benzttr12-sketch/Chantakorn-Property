import { listFirestoreDocuments } from '@/lib/firestore-rest';
import { publicProperty } from '@/lib/public-property';
import { jsonResponse } from '@/lib/api-response';

export const runtime = 'nodejs';
export async function GET(req: Request) {
  try {
    const rows = await listFirestoreDocuments('properties', 1000, { publishedOnly: true });
    const origin = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/+$/, '');
    return jsonResponse({ properties: rows.map(row => publicProperty(row, origin)).filter(Boolean) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return jsonResponse({ error: 'โหลดรายการทรัพย์ไม่สำเร็จ กรุณาลองใหม่' }, { status: 503 });
  }
}
