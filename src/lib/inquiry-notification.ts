import { createHash } from 'node:crypto';
import { serverFirestore } from './server-firestore';
import { sendLineNotification } from './line-notify-service';

/** Caller supplies only an ID. Notification data and delivery claims come from the persisted inbox. */
export async function notifySavedInquiry(id: string, requestUrl: string) {
  const db = serverFirestore();
  const ref = db.collection('inquiries').doc(id);
  const payload = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const record = snapshot.data();
    if (!record || ['accepted', 'disabled'].includes(record.line_notice_state) ||
      (record.line_notice_state === 'claimed' && record.line_notice_until > Date.now())) return null;
    transaction.update(ref, { line_notice_state: 'claimed', line_notice_until: Date.now() + 90000 });
    return record;
  });
  if (!payload) return;
  const keys: Record<string, string> = {};
  for (const recipient of [process.env.LINE_TARGET_USER_ID, ...(process.env.LINE_ADMIN_USER_IDS || '').split(',')]) {
    if (!recipient?.trim()) continue;
    const hash = createHash('sha256').update(`${id}:${recipient.trim()}`).digest('hex');
    keys[recipient.trim()] = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  }
  const { consignment_details: details, name, phone, line_id, message, inquiry_type } = payload;
  const response = await sendLineNotification(new Request(requestUrl), {
    name, phone, line_id, message, inquiry_type,
    ...(details ? { consignment_details: { property_type: details.property_type, district: details.district, province: details.province, expected_price: details.expected_price } } : {}),
  }, keys);
  const result = await response.json();
  await ref.update({ line_notice_state: response.ok && result.isRealSent ? 'accepted' : response.ok ? 'disabled' : 'failed' });
}
