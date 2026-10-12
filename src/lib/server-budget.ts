import { createHash } from 'node:crypto';
import { serverFirestore } from './server-firestore';
import { jsonResponse } from './api-response';

/** Shared, atomic limits include a global ceiling; rotating or spoofed client IDs cannot bypass it. */
export async function enforceRequestBudget(req: Request, scope: string, options: { perMinute?: number; perDay?: number } = {}): Promise<Response | null> {
  const minute = Math.floor(Date.now() / 60000);
  const day = Math.floor(Date.now() / 86400000);
  const ip = req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const principal = createHash('sha256').update(`${scope}:${ip}`).digest('hex');
  const perMinute = options.perMinute ?? 5;
  const perDay = options.perDay ?? 100;
  try {
    const db = serverFirestore();
    const checks = [
      { id: `${scope}-global`, minuteLimit: perMinute * 10, dayLimit: perDay },
      { id: principal, minuteLimit: perMinute, dayLimit: perDay },
    ];
    const accepted = await db.runTransaction(async transaction => {
      const refs = checks.map(check => db.collection('request_budgets').doc(check.id));
      const snapshots = await transaction.getAll(...refs);
      const values = snapshots.map(snapshot => snapshot.data() || {});
      if (values.some((value, index) =>
        (value.minute === minute && value.minute_count >= checks[index].minuteLimit) ||
        (value.day === day && value.day_count >= checks[index].dayLimit))) return false;
      refs.forEach((ref, index) => transaction.set(ref, {
        minute, day,
        minute_count: values[index].minute === minute ? values[index].minute_count + 1 : 1,
        day_count: values[index].day === day ? values[index].day_count + 1 : 1,
        expires_at: new Date(Date.now() + 2 * 86400000),
      }));
      return true;
    });
    return accepted ? null : jsonResponse({ error: 'ส่งคำขอถี่เกินไป กรุณาลองใหม่ภายหลัง' }, { status: 429, headers: { 'Retry-After': '60' } });
  } catch {
    return jsonResponse({ error: 'ระบบรับคำขอยังไม่พร้อม กรุณาลองใหม่ภายหลัง' }, { status: 503 });
  }
}
