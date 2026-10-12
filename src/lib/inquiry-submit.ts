'use client';
import { apiUrl } from './api-url';
import type { Inquiry } from './types';
const attempts = new Map<string, { id: string; token?: string; photos?: string[] }>();
async function post(path: string, body: unknown) {
  const response = await fetch(apiUrl(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่');
  return data;
}
/** A retry reuses the same submission ID and media slots, rather than sending another LINE notice. */
export async function submitFirebaseInquiry(input: Omit<Inquiry, 'id' | 'created_at'>): Promise<Inquiry> {
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(input))))).map(byte => byte.toString(16).padStart(2, '0')).join('');
  let attempt = attempts.get(fingerprint);
  if (!attempt) {
    if (attempts.size >= 10) attempts.delete(attempts.keys().next().value!);
    attempt = { id: crypto.randomUUID(), photos: [] };
    attempts.set(fingerprint, attempt);
  }
  const photos = input.consignment_details?.photos || [];
  if (photos.length > 15) throw new Error('แนบรูปได้ไม่เกิน 15 รูป');
  if (photos.length && !attempt.token) {
    try { attempt.token = (await post('/api/inquiries/media', { id: attempt.id, action: 'start' })).token; }
    catch (error) { attempts.delete(fingerprint); throw error; }
  }
  for (let index = attempt.photos!.length; index < photos.length; index++) {
    const uploaded = await post('/api/inquiries/media', { id: attempt.id, action: 'upload', token: attempt.token, index, photo: photos[index] });
    attempt.photos!.push(uploaded.mediaId);
  }
  const body = { ...input, id: attempt.id, status: 'new',
    ...(input.consignment_details ? { consignment_details: { ...input.consignment_details, photos: attempt.photos, photos_count: photos.length } } : {}),
    ...(attempt.token ? { media_token: attempt.token } : {}),
  };
  return (await post('/api/inquiries', body)).inquiry;
}
