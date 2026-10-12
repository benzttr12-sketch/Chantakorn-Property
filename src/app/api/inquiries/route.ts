import { createHash } from 'node:crypto';
import { serverFirestore } from '@/lib/server-firestore';
import { enforceRequestBudget } from '@/lib/server-budget';
import { readJsonBody } from '@/lib/server-request';
import { jsonResponse } from '@/lib/api-response';
import { validateInquiry } from '@/lib/inquiry-validation';
import { validMediaToken } from '@/lib/media-token';
import { notifySavedInquiry } from '@/lib/inquiry-notification';
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
    const saved = await db.runTransaction(async transaction => {
      const ref = db.collection('inquiries').doc(inquiry.id);
      const existing = await transaction.get(ref);
      if (existing.exists) {
        if (existing.data()?.submission_hash !== hash) throw new Error('conflict');
        return { ...result, created_at: existing.data()!.created_at };
      }
      if (inquiry.property_id) {
        const property = await transaction.get(db.collection('properties').doc(inquiry.property_id));
        if (property.data()?.published !== true) throw new Error('invalid-property');
        result.property_title = String(property.data()?.title || '').slice(0, 250);
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
