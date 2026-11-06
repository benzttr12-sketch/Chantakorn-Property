'use client';

import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { cloudflarePropertyPreviewUrl, fetchStaffPropertyPreview } from '@/lib/cloudflare-property-preview';
import { formatPropertyCode } from '@/lib/format-code';

const extensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const rasterDataUrl = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/i;
const mediaIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fetch original photo bytes through the same staff access used by previews. */
export async function fetchPropertyPhoto(src: string, propertyId: string, signal?: AbortSignal): Promise<Blob> {
  signal?.throwIfAborted();
  const cloudflare = (process.env.NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND || 'cloudflare').trim().toLowerCase() === 'cloudflare';
  if (cloudflare && cloudflarePropertyPreviewUrl(src, propertyId)) {
    const blob = await fetchStaffPropertyPreview(src, propertyId, signal);
    signal?.throwIfAborted();
    return blob;
  }

  let url: URL;
  try { url = new URL(src, typeof window === 'undefined' ? undefined : window.location.href); }
  catch { throw new Error('ลิงก์รูปภาพไม่ถูกต้อง'); }
  if (!['https:', 'http:', 'data:', 'blob:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('ลิงก์รูปภาพไม่รองรับ');
  }

  const mediaId = url.searchParams.get('media');
  if (!cloudflare && url.pathname === `/api/properties/${encodeURIComponent(propertyId)}/image` && mediaId && mediaIdPattern.test(mediaId)) {
    if (!db) throw new Error('ยังไม่ได้ตั้งค่าฐานข้อมูลรูปภาพ');
    const photo = (await getDocFromServer(doc(db, 'property_media', mediaId))).data();
    signal?.throwIfAborted();
    if (photo?.property_id !== propertyId || typeof photo.data_url !== 'string' || !rasterDataUrl.test(photo.data_url)) {
      throw new Error('ไม่พบรูปภาพของทรัพย์นี้');
    }
    url = new URL(photo.data_url);
  }
  if (url.protocol === 'data:') {
    const match = rasterDataUrl.exec(url.href);
    if (!match) throw new Error('ชนิดไฟล์รูปภาพไม่รองรับ');
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      bytes = Uint8Array.from(atob(match[2]), character => character.charCodeAt(0));
    } catch { throw new Error('ข้อมูลรูปภาพไม่ถูกต้อง'); }
    signal?.throwIfAborted();
    if (bytes.byteLength === 0) throw new Error('ไม่พบข้อมูลรูปภาพ');
    // Decode stored photos locally: fetch(data:) is blocked by our connect-src policy.
    return new Blob([bytes], { type: match[1].toLowerCase() });
  }

  signal?.throwIfAborted();
  const response = await fetch(url.href, {
    credentials: 'omit', mode: 'cors', referrerPolicy: 'no-referrer', signal,
  });
  signal?.throwIfAborted();
  const type = (response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (!response.ok || !Object.hasOwn(extensions, type)) {
    await response.body?.cancel();
    throw new Error('ดาวน์โหลดรูปภาพไม่สำเร็จ หรือชนิดไฟล์ไม่รองรับ');
  }
  const blob = await response.blob();
  signal?.throwIfAborted();
  if (blob.size === 0) throw new Error('ไม่พบข้อมูลรูปภาพ');
  return blob;
}

export function propertyPhotoFilename(propertyId: string, index: number, type: string): string {
  const mime = type.split(';')[0].trim().toLowerCase();
  if (!Object.hasOwn(extensions, mime)) throw new Error('ชนิดไฟล์รูปภาพไม่รองรับ');
  const extension = extensions[mime];
  const code = formatPropertyCode(propertyId).replace(/[^A-Za-z0-9_-]/g, '-');
  return `${code}-facebook-${String(index + 1).padStart(2, '0')}.${extension}`;
}

export function savePhotoDownload(blob: Blob, filename: string): void {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  try {
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    // Browsers can start reading the URL after click() returns, especially on mobile.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
