import { createHash } from 'node:crypto';
import { serverFirestore } from '@/lib/server-firestore';
import { enforceRequestBudget } from '@/lib/server-budget';
import { readJsonBody } from '@/lib/server-request';
import { jsonResponse } from '@/lib/api-response';
import { validateInquiry } from '@/lib/inquiry-validation';
import { validMediaToken } from '@/lib/media-token';
import { notifySavedInquiry } from '@/lib/inquiry-notification';
import { getPublishedPropertyDocument } from '@/lib/server-property-catalog';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const parsed = await readJsonBody(req, 24 * 1024);
  if (parsed.error) return parsed.error;
  let inquiry;
  try { inquiry = validateInquiry(parsed.data); }
  catch (error) { return jsonResponse({ error: error instanceof Error ? error.message : 'ข้อมูลไม่ถูกต้อง' }, { status: 400 }); }
  const limited = await enforceRequestBudget(req, 'inquiry-submit', { perMinute: 5, perDay: 30 });
  if (limited) return limited;
  try {
    const db = serverFirestore();
    const result = { ...inquiry, created_at: new Date().toISOString() };
    const hash = createHash('sha256').update(JSON.stringify(inquiry)).digest('hex');
    const ref = db.collection('inquiries').doc(inquiry.id);
    const propertyBackend = (process.env.NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND || 'cloudflare').trim().toLowerCase();
    let cloudflareTitle: string | undefined;
    if (inquiry.property_id && propertyBackend !== 'firebase') {
      if (propertyBackend !== 'cloudflare') throw new Error('Property catalog unavailable');
      // A saved receipt remains retryable after the listing is withdrawn or the
      // catalog goes offline. Keep the HTTP lookup outside Firestore retries.
      const existing = await ref.get();
      if (!existing.exists) {
        const property = await getPublishedPropertyDocument(inquiry.property_id);
        if (property.status === 403 || property.status === 404) throw new Error('invalid-property');
        if (!property.ok) throw new Error('Property catalog unavailable');
        const { fields } = await property.json();
        if (fields?.published?.booleanValue !== true) throw new Error('invalid-property');
        if (typeof fields?.title?.stringValue !== 'string') throw new Error('Property catalog unavailable');
        cloudflareTitle = fields.title.stringValue.slice(0, 250);
      }
    }
    const saved = await db.runTransaction(async transaction => {
      const existing = await transaction.get(ref);
      if (existing.exists) {
        const receipt = existing.data()!;
        if (receipt.submission_hash !== hash) throw new Error('conflict');
        return { ...result, created_at: receipt.created_at,
          ...(inquiry.property_id ? { property_title: receipt.property_title } : {}) };
      }
      if (inquiry.property_id) {
        if (propertyBackend === 'firebase') {
          const property = await transaction.get(db.collection('properties').doc(inquiry.property_id));
          if (property.data()?.published !== true) throw new Error('invalid-property');
          result.property_title = String(property.data()?.title || '').slice(0, 250);
        } else {
          if (cloudflareTitle === undefined) throw new Error('Property catalog unavailable');
          result.property_title = cloudflareTitle;
        }
      }
      const photos = inquiry.consignment_details?.photos || [];
      if (photos.length) {
        const sessionRef = db.collection('inquiry_media_sessions').doc(inquiry.id);
        const session = (await transaction.get(sessionRef)).data();
        const token = (parsed.data as Record<string, unknown>).media_token;
        if (!session || session.consumed || session.expires_at <= Date.now() || !validMediaToken(token, session.token_hash) || JSON.stringify(session.photo_ids) !== JSON.stringify(photos)) throw new Error('invalid-photos');
        transaction.update(sessionRef, { consumed: true });
      }
      transaction.create(ref, { ...result, submission_hash: hash });
      return result;
    });
    // Persistence succeeds independently of LINE availability. Claims prevent duplicate pushes on retries.
    await notifySavedInquiry(inquiry.id, req.url).catch(() => undefined);
    return jsonResponse({ inquiry: saved }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return jsonResponse({ error: message === 'conflict' ? 'รหัสคำขอนี้ถูกใช้แล้ว กรุณาส่งใหม่' : 'ส่งข้อมูลไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองใหม่' }, { status: message === 'conflict' ? 409 : message.startsWith('invalid-') ? 400 : 503 });
  }
}
