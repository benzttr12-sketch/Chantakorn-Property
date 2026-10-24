'use client';

import type { Property, PropertyFilters } from '@/lib/types';
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

/** One bounded request; callers control page navigation and abort obsolete searches. */
export async function cloudflarePropertyPage(filters: PropertyFilters = {}, cursor: string | null = null, signal?: AbortSignal) {
  const params = new URLSearchParams({ limit: '24' });
  for (const key of ['type', 'status', 'province', 'district', 'subdistrict', 'minPrice', 'maxPrice',
    'bedrooms', 'bathrooms', 'searchQuery', 'hasVideo', 'featured', 'sortBy'] as const) {
    const value = filters[key];
    if (value !== undefined && value !== '' && value !== 'all' && value !== 'any') params.set(key, String(value));
  }
  if (filters.features?.length) params.set('features', JSON.stringify(filters.features));
  if (cursor) params.set('cursor', cursor);
  const result = await request<{ data: Property[]; next_cursor: string | null }>(
    `/v1/properties?${params}`, { signal });
  if (!Array.isArray(result.data) || result.data.length > 24 ||
      (result.next_cursor !== null && (typeof result.next_cursor !== 'string' || result.next_cursor === cursor)))
    throw new Error('Cloudflare API ส่งข้อมูลหน้าถัดไปไม่ถูกต้อง');
  return { data: result.data.map(toExistingProperty), nextCursor: result.next_cursor };
}

export async function cloudflareListProperties(admin = false): Promise<Property[]> {
  const result: Property[] = [];
  let cursor: string | null = null;
  const visited = new Set<string>();
  // Temporary compatibility bridge for the existing unpaginated Admin UI.
  // Cap strictly at 800 Admin listings or 300 public listings; fail visibly rather than
  // pretending that a partial listing is the whole property catalog.
  for (let page = 0; page < 10; page++) {
    const size = admin ? 80 : 30;
    const path = admin ? '/v1/admin/properties' : '/v1/properties';
    const params = new URLSearchParams({ limit: String(size) });
    if (cursor) params.set('cursor', cursor);
    const response = await request<{ data: Property[]; next_cursor: string | null }>(
      `${path}?${params.toString()}`, {}, admin);
    if (!Array.isArray(response.data) || response.data.length > size ||
        (response.next_cursor !== null && (typeof response.next_cursor !== 'string' ||
          response.next_cursor.length === 0 || response.next_cursor.length > 512))) {
      throw new Error('Cloudflare API ส่งข้อมูลหน้าถัดไปไม่ถูกต้อง');
    }
    result.push(...response.data.map(toExistingProperty));
    if (response.next_cursor === null) return result;
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

function preparePhotos(photos: string[]): Blob[] {
  return photos.map(encoded => {
    // Only image data URL payloads generated by the existing image compressor.
    // Do not silently hotlink arbitrary remote URLs as fresh R2 listing photos.
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/]+={0,2})$/i.exec(encoded);
    if (!match) throw new Error('กรุณาอัปโหลดรูปภาพใหม่เป็น JPG, PNG หรือ WebP ก่อนใช้ Cloudflare');
    if (match[2].length > Math.ceil((2 * 1024 * 1024) / 3) * 4)
      throw new Error('รูปภาพแต่ละรูปต้องไม่เกิน 2 MB');
    let decoded: string;
    try { decoded = atob(match[2]); }
    catch { throw new Error('ข้อมูลรูปภาพไม่ถูกต้อง กรุณาอัปโหลดรูปใหม่'); }
    if (!decoded.length || decoded.length > 2 * 1024 * 1024)
      throw new Error('รูปภาพแต่ละรูปต้องไม่เกิน 2 MB');
    return new Blob([Uint8Array.from(decoded, c => c.charCodeAt(0))], { type: match[1].toLowerCase() });
  });
}

async function uploadPhotos(propertyId: string, photos: Blob[]) {
  const paths: { id: string; path: string }[] = [];
  for (const blob of photos) {
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

/** Draft-only removal; the Worker deletes the D1 row before the R2 object. */
async function removePhoto(propertyId: string, mediaId: string) {
  await request<{ ok: boolean }>(
    `/v1/media/properties/${encodeURIComponent(propertyId)}/${encodeURIComponent(mediaId)}`,
    { method: 'DELETE' }, true);
}

export async function cloudflareCreateProperty(value: Omit<Property, 'id' | 'created_at'>): Promise<Property> {
  const requestedPublished = Boolean(value.published);
  const rawPhotos = [...new Set([...(value.images || []), value.cover_image || ''].filter(Boolean))];
  const preparedPhotos = preparePhotos(rawPhotos);
  // No mutable images or arbitrary URLs accepted in the D1 listing record.
  const input = { ...cleanOutgoing(value as unknown as Record<string, unknown>), published: false };
  const response = await request<PropertyPayload>('/v1/admin/properties', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  }, true);
  let property = toExistingProperty(response.data);
  try {
    const uploaded = await uploadPhotos(property.id, preparedPhotos);
    if (uploaded.length) {
      const chosenIndex = rawPhotos.indexOf(value.cover_image || '');
      const selected = uploaded[chosenIndex >= 0 ? chosenIndex : 0];
      property = await patch(property.id, property.updated_at || '', { featured: Boolean(value.featured) }, selected.id);
    }
    if (requestedPublished) property = await patch(property.id, property.updated_at || '', { published: true });
    return property;
  } catch (e) {
    throw new Error(`สร้างประกาศฉบับร่างไว้แล้ว (${property.id}) แต่ยังดำเนินการต่อไม่สำเร็จ: ${e instanceof Error ? e.message : 'โปรดลองอีกครั้ง'}`);
  }
}

function requireObservedRevision(value: string | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error('กรุณาโหลดประกาศใหม่ก่อนบันทึกหรือลบรายการ');
  }
  return value;
}

export async function cloudflareUpdateProperty(id: string, updates: Partial<Property>, expectedUpdatedAt?: string): Promise<Property> {
  const expected = requireObservedRevision(expectedUpdatedAt);
  const property = await cloudflareAdminDetail(id);
  if (property.updated_at !== expected) {
    throw new Error('ประกาศมีการแก้ไขแล้ว กรุณาโหลดใหม่ก่อนบันทึก');
  }
  const existingImageIds = new Set((property.images || []).map(mediaIdFromUrl).filter((x): x is string => Boolean(x)));
  let removedIds: string[] = [];
  if (updates.images) {
    const supplied = new Set(updates.images.map(mediaIdFromUrl).filter((x): x is string => Boolean(x)));
    if ([...supplied].some(x => !existingImageIds.has(x)))
      throw new Error('รูปภาพต้องเป็นรูป R2 ของประกาศนี้หรือรูปที่อัปโหลดใหม่');
    // Only saved photos can be removed; data URLs below are new uploads.
    removedIds = [...existingImageIds].filter(x => !supplied.has(x));
  }
  const newImages = [...new Set((updates.images || []).filter(x => !mediaIdFromUrl(x)))];
  let coverId: string | null | undefined;
  let uploadedCoverIndex = -1;
  if (updates.cover_image !== undefined) {
    coverId = updates.cover_image ? mediaIdFromUrl(updates.cover_image) : null;
    uploadedCoverIndex = newImages.indexOf(updates.cover_image || '');
    if (updates.cover_image && !(coverId && existingImageIds.has(coverId)) && uploadedCoverIndex < 0)
      throw new Error('รูปปกต้องเป็นรูป R2 ของประกาศนี้หรือรูปใหม่ในรายการอัปโหลด');
  }
  if ((newImages.length || removedIds.length) && property.published)
    throw new Error('กรุณายกเลิกการเผยแพร่ประกาศและโหลดใหม่ก่อนเพิ่มหรือลบรูปภาพ แล้วเผยแพร่อีกครั้งหลังตรวจรูป');
  if (removedIds.length) {
    // The Worker refuses to delete the current cover, so fail before uploading.
    const nextCover = updates.cover_image !== undefined
      ? coverId
      : mediaIdFromUrl(property.cover_image || property.images?.[0] || '');
    if (nextCover && removedIds.includes(nextCover))
      throw new Error('รูปปกต้องไม่ใช่รูปที่จะลบ กรุณาเลือกปกใหม่ก่อนบันทึก');
  }
  // Validate the whole batch and cover before the first upload can persist a file.
  const preparedPhotos = preparePhotos(newImages);
  const outgoing = cleanOutgoing(updates as Record<string, unknown>);
  const uploaded = await uploadPhotos(id, preparedPhotos);
  if (uploadedCoverIndex >= 0) coverId = uploaded[uploadedCoverIndex].id;
  const needsPatch = Object.keys(outgoing).length > 0 || updates.cover_image !== undefined;
  const saved = needsPatch ? await patch(id, expected, outgoing, coverId) : null;
  if (removedIds.length) {
    for (const mediaId of removedIds) {
      try {
        await removePhoto(id, mediaId);
      } catch (error) {
        throw new Error(`บันทึกข้อมูลแล้ว แต่ลบรูปภาพไม่สำเร็จ กรุณาโหลดใหม่และลบรูปที่เหลือ: ${error instanceof Error ? error.message : 'โปรดลองอีกครั้ง'}`);
      }
    }
    return await cloudflareAdminDetail(id);
  }
  if (saved) return saved;
  // Keep the revision the editor actually read, including across image uploads.
  // A later server read must never turn an old form into an accepted overwrite.
  return uploaded.length ? await cloudflareAdminDetail(id) : property;
}

export async function cloudflareDeleteProperty(id: string, expectedUpdatedAt?: string): Promise<boolean> {
  const expected = requireObservedRevision(expectedUpdatedAt);
  await request<{ ok: boolean }>(
    `/v1/admin/properties/${encodeURIComponent(id)}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expected_updated_at: expected }),
    }, true);
  return true;
}
