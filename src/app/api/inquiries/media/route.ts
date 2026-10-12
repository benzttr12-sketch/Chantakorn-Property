import { createHash, randomBytes, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { serverFirestore } from '@/lib/server-firestore';
import { enforceRequestBudget } from '@/lib/server-budget';
import { readJsonBody } from '@/lib/server-request';
import { jsonResponse } from '@/lib/api-response';
import { UUID } from '@/lib/inquiry-validation';
import { validMediaToken } from '@/lib/media-token';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const parsed = await readJsonBody(req, 610 * 1024);
  if (parsed.error) return parsed.error;
  const body = parsed.data as Record<string, unknown>;
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.id !== 'string' || !UUID.test(body.id) || Object.keys(body).some(key => !['id', 'action', 'token', 'photo', 'index'].includes(key))) return jsonResponse({ error: 'ข้อมูลรูปไม่ถูกต้อง' }, { status: 400 });
  const limited = await enforceRequestBudget(req, body.action === 'start' ? 'inquiry-media-session' : 'inquiry-media-photo', body.action === 'start' ? { perMinute: 3, perDay: 15 } : { perMinute: 30, perDay: 225 });
  if (limited) return limited;
  try {
    const db = serverFirestore();
    const ref = db.collection('inquiry_media_sessions').doc(body.id);
    if (body.action === 'start') {
      const expired = await db.collection('inquiry_media_sessions').where('expires_at', '<', Date.now()).limit(10).get();
      for (const old of expired.docs) await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(old.ref);
        const data = snapshot.data();
        if (!data || data.expires_at >= Date.now()) return;
        if (!data.consumed) for (const id of data.photo_ids || []) transaction.delete(db.collection('inquiry_media').doc(id));
        transaction.delete(old.ref);
      });
      const token = randomBytes(32).toString('hex');
      await ref.create({ token_hash: createHash('sha256').update(token).digest('hex'), expires_at: Date.now() + 3600000, photo_ids: [], consumed: false });
      return jsonResponse({ token });
    }
    if (body.action !== 'upload' || typeof body.index !== 'number' || !Number.isInteger(body.index) || body.index < 0 || body.index >= 15 || typeof body.photo !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(body.photo)) return jsonResponse({ error: 'รูปไม่ถูกต้อง' }, { status: 400 });
    const bytes = Buffer.from(body.photo.slice(body.photo.indexOf(',') + 1), 'base64');
    if (!bytes.length || bytes.length > 450000) return jsonResponse({ error: 'รูปมีขนาดใหญ่เกินกำหนด' }, { status: 413 });
    const decoder = sharp(bytes, { limitInputPixels: 16_777_216 });
    const meta = await decoder.metadata();
    if (!meta.width || !meta.height || meta.width > 4096 || meta.height > 4096 || !['jpeg', 'png', 'webp'].includes(meta.format || '') || body.photo.split(';')[0] !== `data:image/${meta.format}`) return jsonResponse({ error: 'รูปไม่ถูกต้อง' }, { status: 400 });
    await decoder.clone().stats(); // Fully decode before persisting; headers alone are insufficient.
    const mediaId = randomUUID();
    const result = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const session = snapshot.data();
      if (!session || session.consumed || session.expires_at <= Date.now() || !validMediaToken(body.token, session.token_hash)) throw new Error('invalid-session');
      if (session.photo_ids[Number(body.index)]) return session.photo_ids[Number(body.index)];
      if (session.photo_ids.length !== body.index || session.photo_ids.length >= 15) throw new Error('invalid-session');
      transaction.create(db.collection('inquiry_media').doc(mediaId), { inquiry_id: body.id, data_url: body.photo, created_at: new Date().toISOString() });
      transaction.update(ref, { photo_ids: [...session.photo_ids, mediaId] });
      return mediaId;
    });
    return jsonResponse({ mediaId: result });
  } catch {
    return jsonResponse({ error: 'บันทึกรูปไม่สำเร็จ กรุณาลองใหม่' }, { status: 400 });
  }
}
