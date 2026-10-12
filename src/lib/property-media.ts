'use client';
import { doc, setDoc, deleteDoc, getDocFromServer, type Firestore } from 'firebase/firestore';
import { apiUrl } from './api-url';
import { db } from '@/lib/firebase/client';
import type { Property } from './types';

export const MAX_PROPERTY_PHOTOS = 60;
export const MAX_SAVED_PHOTO_BYTES = 450000;
const existingPhotos = new Map<string, Map<string, string>>();
/** Hydrate just the listing being edited, so draft photos remain visible only to staff. */
export async function loadStaffPropertyPhotos(property: Property) {
  if (!db) return property;
  const replacements = new Map<string, string>();
  const original = new Map<string, string>();
  for (const url of new Set([...property.images, property.cover_image])) {
    let parsed: URL;
    try { parsed = new URL(url); } catch { continue; }
    const id = parsed.searchParams.get('media');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id) || parsed.pathname !== `/api/properties/${encodeURIComponent(property.id)}/image`) continue;
    const snapshot = await getDocFromServer(doc(db, 'property_media', id));
    const photo = snapshot.data();
    if (photo?.property_id === property.id && typeof photo.data_url === 'string') {
      replacements.set(url, photo.data_url);
      original.set(photo.data_url, url);
    }
  }
  existingPhotos.clear();
  existingPhotos.set(property.id, original);
  return { images: property.images.map(url => replacements.get(url) || url), cover_image: replacements.get(property.cover_image) || property.cover_image };
}
export async function preparePropertyMedia(db: Firestore, propertyId: string, images: string[], cover: string, legacyPhotos: string[] = []) {
  if (!Array.isArray(images) || images.length > MAX_PROPERTY_PHOTOS) throw new Error('แนบรูปได้ไม่เกิน 60 รูป');
  const uploaded: string[] = [];
  const replacements = new Map<string, string>();
  const cleanup = () => Promise.allSettled(uploaded.map(id => deleteDoc(doc(db, 'property_media', id))));
  try {
    for (const photo of new Set([...images, cover].filter(Boolean))) {
      if (!photo.startsWith('data:')) continue;
      const saved = existingPhotos.get(propertyId)?.get(photo);
      if (saved) { replacements.set(photo, saved); continue; }
      // Already persisted legacy photos may be larger than today's processing ceiling.
      // Migrate these exact saved bytes without forcing an unrelated listing edit to discard them.
      const limit = legacyPhotos.includes(photo) ? 760000 : MAX_SAVED_PHOTO_BYTES;
      if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo) ||
        atob(photo.slice(photo.indexOf(',') + 1)).length > limit) {
        throw new Error('รูปยังไม่ได้ย่อขนาด กรุณาอัปโหลดรูปใหม่');
      }
      const id = crypto.randomUUID();
      await setDoc(doc(db, 'property_media', id), { property_id: propertyId, data_url: photo, created_at: new Date().toISOString() });
      uploaded.push(id);
      const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const url = new URL(apiUrl(`/api/properties/${encodeURIComponent(propertyId)}/image?media=${id}`), origin).href;
      replacements.set(photo, url);
    }
    return { images: images.map(photo => replacements.get(photo) || photo), cover_image: replacements.get(cover) || cover, cleanup };
  } catch (error) { await cleanup(); throw error; }
}

export async function removeUnusedPropertyMedia(db: Firestore, propertyId: string, previous: string[], current: string[]) {
  const ids = new Set<string>();
  for (const photo of previous) {
    if (current.includes(photo)) continue;
    try {
      const url = new URL(photo);
      const id = url.searchParams.get('media');
      if (url.pathname === `/api/properties/${encodeURIComponent(propertyId)}/image` && id && /^[0-9a-f-]{36}$/i.test(id)) ids.add(id);
    } catch {}
  }
  await Promise.allSettled([...ids].map(id => deleteDoc(doc(db, 'property_media', id))));
}
