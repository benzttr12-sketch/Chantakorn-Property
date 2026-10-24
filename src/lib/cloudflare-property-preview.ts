'use client';

import { auth } from '@/lib/firebase/client';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxPreviewBytes = 2 * 1024 * 1024;

function configuredOrigin(): string | null {
  try {
    const url = new URL((process.env.NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN || '').trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    return url.origin;
  } catch { return null; }
}

/** Only saved media on the configured API can receive a Firebase staff token. */
export function cloudflarePropertyPreviewUrl(src: string, propertyId: string): string | null {
  const origin = configuredOrigin();
  if (!origin || !uuid.test(propertyId)) return null;
  try {
    const url = new URL(src);
    const mediaId = url.pathname.slice('/v1/media/properties/'.length);
    if (url.origin !== origin || src !== origin + url.pathname ||
        !url.pathname.startsWith('/v1/media/properties/') || !uuid.test(mediaId)) return null;
    return `${origin}/v1/admin/properties/${propertyId}/media/${mediaId}`;
  } catch { return null; }
}

export async function fetchStaffPropertyPreview(src: string, propertyId: string, signal?: AbortSignal): Promise<Blob> {
  const target = cloudflarePropertyPreviewUrl(src, propertyId);
  if (!target) throw new Error('รูปภาพไม่ได้อยู่ใน Cloudflare API ที่ตั้งค่าไว้');
  signal?.throwIfAborted();
  if (!auth) throw new Error('ยังไม่ได้ตั้งค่า Firebase Authentication');
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('กรุณาเข้าสู่ระบบพนักงานเพื่อดูรูป');
  const token = await user.getIdToken();
  signal?.throwIfAborted();
  const response = await fetch(target, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'omit', redirect: 'error', cache: 'no-store', signal,
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('ไม่สามารถโหลดรูปสำหรับพนักงานได้');
  }
  const type = (response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  const length = response.headers.get('Content-Length');
  if (!imageTypes.has(type) || (length !== null && (!/^\d+$/.test(length) || Number(length) > maxPreviewBytes))) {
    await response.body?.cancel();
    throw new Error('รูปภาพมีชนิดหรือขนาดไม่ถูกต้อง');
  }
  if (!response.body) throw new Error('ไม่พบข้อมูลรูปภาพ');
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxPreviewBytes) throw new Error('รูปภาพมีขนาดเกิน 2 MiB');
      chunks.push(new Uint8Array(value));
    }
    signal?.throwIfAborted();
    if (size === 0) throw new Error('ไม่พบข้อมูลรูปภาพ');
    return new Blob(chunks, { type });
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
}
