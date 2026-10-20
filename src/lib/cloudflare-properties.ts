'use client';

import type { Property } from '@/lib/types';
import { auth } from '@/lib/firebase/client';

const requested = (process.env.NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND || 'firebase').trim().toLowerCase();
if (requested !== 'firebase' && requested !== 'cloudflare') {
  throw new Error('NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND must be firebase or cloudflare');
}
export const useCloudflarePropertyBackend = requested === 'cloudflare';

function configuredOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN || '').trim();
  if (!raw) throw new Error('ยังไม่ได้ตั้งค่า Cloudflare API URL สำหรับประกาศ');
  const url = new URL(raw);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost'))) {
    throw new Error('Cloudflare API ต้องใช้ HTTPS และไม่มี URL Path/Token');
  }
  return url.origin;
}

async function staffToken(): Promise<string> {
  if (!auth) throw new Error('ยังไม่ได้ตั้งค่า Firebase Authentication');
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('กรุณาเข้าสู่ระบบพนักงาน');
  return await user.getIdToken();
}

async function request<T>(path: string, options: RequestInit = {}, staff = false): Promise<T> {
  const url = configuredOrigin() + path;
  const headers = new Headers(options.headers);
  if (staff) headers.set('Authorization', `Bearer ${await staffToken()}`);
  const response = await fetch(url, { ...options, headers, cache: staff ? 'no-store' : 'default' });
  let body: { error?: string } & T;
  try { body = await response.json(); }
  catch { throw new Error('Cloudflare API ตอบกลับไม่ถูกต้อง'); }
  if (!response.ok) throw new Error(body.error || 'Cloudflare API ไม่พร้อมใช้งาน');
  return body;
}

export function absoluteCloudflareMedia(path: string): string {
  if (!/^\/v1\/media\/properties\/[0-9a-f-]{36}$/i.test(path)) {
    throw new Error('รูปภาพไม่ได้อัปโหลดเข้าสู่ R2 อย่างถูกต้อง');
  }
  return configuredOrigin() + path;
}

type PropertyPayload = { data: Property };
function toExistingProperty(row: Property): Property {
  const images = (row.images || []).map(p => p.startsWith('/v1/media/properties/') ? absoluteCloudflareMedia(p) : p);
  const cover = row.cover_image?.startsWith('/v1/media/properties/')
    ? absoluteCloudflareMedia(row.cover_image) : row.cover_image;
  return { ...row, images, cover_image: cover || '', features: row.features || [], furniture: row.furniture || '' };
}

export async function cloudflareListProperties(admin = false): Promise<Property[]> {
  const result: Property[] = [];
  let cursor: string | null = null;
  const visited = new Set<string>();
  // Temporary compatibility bridge for the existing unpaginated Admin UI.
  // Cap strictly: if the data set exceeds 800 records, fail visibly rather than
  // pretending that a partial listing is the whole property catalog.
  for (let page = 0; page < 10; page++) {
    const size = admin ? 80 : 30;
    const path = admin ? '/v1/admin/properties' : '/v1/properties';
    const params = new URLSearchParams({ limit: String(size) });
    if (cursor) params.set('cursor', cursor);
    const response = await request<{ data: Property[]; next_cursor: string | null }>(
      `${path}?${params.toString()}`, {}, admin);
    result.push(...response.data.map(toExistingProperty));
    if (!response.next_cursor) return result;
    if (visited.has(response.next_cursor)) throw new Error('Cloudflare API ส่ง cursor ซ้ำ');
    visited.add(response.next_cursor);
    cursor = response.next_cursor;
  }
  throw new Error('รายการประกาศเกินขีดจำกัดของหน้าเดิม ต้องเปลี่ยนไปใช้ Pagination');
}

export async function cloudflarePublicDetail(identifier: string): Promise<Property | null> {
  if (!/^[\p{L}\p{N}_-]{1,120}$/u.test(identifier)) return null;
  try {
    const response = await request<PropertyPayload>(`/v1/properties/${encodeURIComponent(identifier)}`);
    return toExistingProperty(response.data);
  } catch (e) {
    if (e instanceof Error && /not found/i.test(e.message)) return null;
    throw e;
  }
}

export async function cloudflareAdminDetail(id: string): Promise<Property> {
  const response = await request<PropertyPayload>(`/v1/admin/properties/${encodeURIComponent(id)}`, {}, true);
  return toExistingProperty(response.data);
}

const allowed = new Set([
  'title', 'slug', 'description', 'property_type', 'status', 'price', 'province', 'district',
  'subdistrict', 'address', 'latitude', 'longitude', 'bedrooms', 'bathrooms', 'parking',
  'land_size', 'usable_area', 'year_built', 'furniture', 'features', 'featured',
  'published', 'facing_direction', 'feng_shui', 'video_url', 'videos', 'internal_notes', 'agent_id',
]);
function cleanOutgoing(value: Record<string, unknown>): Record<string, unknown> {
  const outgoing: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    if (!allowed.has(key) || field === undefined) continue;
    outgoing[key] = field;
  }
  if (outgoing.year_built === undefined && Object.prototype.hasOwnProperty.call(value, 'year_built'))
    outgoing.year_built = null;
  if (outgoing.internal_notes === undefined && Object.prototype.hasOwnProperty.call(value, 'internal_notes'))
    outgoing.internal_notes = null;
  return outgoing;
}

function mediaIdFromUrl(link: string): string | null {
  const match = /\/v1\/media\/properties\/([0-9a-f-]{36})$/i.exec(link);
  return match?.[1] || null;
}

async function uploadPhotos(propertyId: string, photos: string[]) {
  const paths: { id: string; path: string }[] = [];
  for (const encoded of photos) {
    // Only image data URL payloads generated by the existing image compressor.
    // Do not silently hotlink arbitrary remote URLs as fresh R2 listing photos.
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=]+)$/i.exec(encoded);
    if (!match) throw new Error('กรุณาอัปโหลดรูปภาพใหม่เป็น JPG, PNG หรือ WebP ก่อนใช้ Cloudflare');
    const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
    if (!bytes.length || bytes.byteLength > 2 * 1024 * 1024)
      throw new Error('รูปภาพแต่ละรูปต้องไม่เกิน 2 MB');
    const blob = new Blob([bytes], { type: match[1].toLowerCase() });
    const response = await request<{ media_id: string; media_path: string }>(
      `/v1/media/properties/${encodeURIComponent(propertyId)}`,
      { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob }, true);
    paths.push({ id: response.media_id, path: response.media_path });
  }
  return paths;
}

async function patch(id: string, expected: string, updates: Record<string, unknown>, coverId?: string | null): Promise<Property> {
  const payload: Record<string, unknown> = { updates, expected_updated_at: expected };
  if (coverId !== undefined) payload.cover_media_id = coverId;
  const response = await request<PropertyPayload>(
    `/v1/admin/properties/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }, true);
  return toExistingProperty(response.data);
}

export async function cloudflareCreateProperty(value: Omit<Property, 'id' | 'created_at'>): Promise<Property> {
  const requestedPublished = Boolean(value.published);
  const rawPhotos = [...new Set((value.images || []).filter(Boolean))];
  // No mutable images or arbitrary URLs accepted in the D1 listing record.
  const input = { ...cleanOutgoing(value as unknown as Record<string, unknown>), published: false };
  const response = await request<PropertyPayload>('/v1/admin/properties', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  }, true);
  let property = toExistingProperty(response.data);
  try {
    const uploaded = await uploadPhotos(property.id, rawPhotos);
    if (uploaded.length) {
      const coverId = mediaIdFromUrl(value.cover_image || '');
      const selected = uploaded.find(p => p.id === coverId) || uploaded[0];
      property = await patch(property.id, property.updated_at || '', { featured: Boolean(value.featured) }, selected.id);
    }
    if (requestedPublished) property = await patch(property.id, property.updated_at || '', { published: true });
    return property;
  } catch (e) {
    throw new Error(`สร้างประกาศฉบับร่างไว้แล้ว (${property.id}) แต่ยังดำเนินการต่อไม่สำเร็จ: ${e instanceof Error ? e.message : 'โปรดลองอีกครั้ง'}`);
  }
}

export async function cloudflareUpdateProperty(id: string, updates: Partial<Property>): Promise<Property> {
  let property = await cloudflareAdminDetail(id);
  const existingImageIds = new Set((property.images || []).map(mediaIdFromUrl).filter(Boolean));
  if (updates.images) {
    const supplied = new Set(updates.images.map(mediaIdFromUrl).filter(Boolean));
    if ([...existingImageIds].some(x => !supplied.has(x))) {
      throw new Error('การลบรูป R2 ยังไม่เปิดใช้งาน กรุณาคงรูปเดิมไว้ก่อน');
    }
    const newImages = updates.images.filter(x => !mediaIdFromUrl(x));
    const uploaded = await uploadPhotos(id, newImages);
    if (uploaded.length) property = await cloudflareAdminDetail(id);
  }
  const outgoing = cleanOutgoing(updates as Record<string, unknown>);
  if (Object.keys(outgoing).length === 0 && updates.cover_image === undefined) return property;
  let coverId: string | null | undefined;
  if (updates.cover_image !== undefined) {
    coverId = updates.cover_image ? mediaIdFromUrl(updates.cover_image) : null;
    if (updates.cover_image && !coverId) throw new Error('รูปปกต้องเป็นรูปที่อัปโหลดเข้า R2 แล้ว');
  }
  return await patch(id, property.updated_at || '', outgoing, coverId);
}

export async function cloudflareDeleteProperty(id: string): Promise<boolean> {
  const property = await cloudflareAdminDetail(id);
  await request<{ ok: boolean }>(
    `/v1/admin/properties/${encodeURIComponent(id)}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expected_updated_at: property.updated_at }),
    }, true);
  return true;
}
