'use client';

import { Property, PropertyFilters, Inquiry, UserProfile } from '@/lib/types';
import { SAMPLE_PROPERTIES } from '@/data/sample-properties';
import { formatPropertyCode } from '@/lib/format-code';
import { db } from '@/lib/firebase/client';
import { dataBackend, useCloudflarePropertyBackend } from '@/lib/backend';
import { fetchStaffApi } from '@/lib/staff-api';
import { apiUrl } from '@/lib/api-url';
import { collectAdminCatalogPages } from '@/lib/admin-catalog';

import { preparePropertyMedia, removeUnusedPropertyMedia } from '@/lib/property-media';
import { submitFirebaseInquiry } from '@/lib/inquiry-submit';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteField,
  deleteDoc, 
  query, 
  where,
  Firestore
} from 'firebase/firestore';
import { getAgents, syncAgentsFromUsers } from '@/lib/store/agents-store';
import { logPropertyChanges, recordPropertyHistory } from '@/lib/store/property-history-store';
import { logSystemActivity } from '@/lib/store/activity-store';

const STORAGE_KEY_PROPERTIES = 'chantakorn_properties';
const STORAGE_KEY_FAVORITES = 'chantakorn_favorites';
const STORAGE_KEY_INQUIRIES = 'chantakorn_inquiries';
const STORAGE_KEY_USERS = 'chantakorn_users';

function readArray<T>(key: string, fallback: T[], valid: (item: unknown) => item is T): T[] {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed.filter(valid);
      }
    } catch {
      // Disabled storage and malformed old data must not break browsing.
    }
  }
  return fallback;
}

function writeArray<T>(key: string, value: T[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.warn('Cannot write to localStorage');
  }
}

function isProperty(item: unknown): item is Property {
  if (!item || typeof item !== 'object') return false;
  const value = item as Property;
  return ['id', 'title', 'slug', 'description', 'province', 'district', 'cover_image', 'created_at']
    .every(key => typeof value[key as keyof Property] === 'string') &&
    typeof value.price === 'number' && Array.isArray(value.images) && Array.isArray(value.features);
}

function isInquiry(item: unknown): item is Inquiry {
  if (!item || typeof item !== 'object') return false;
  const value = item as Inquiry;
  return typeof value.id === 'string' && typeof value.name === 'string' &&
    typeof value.phone === 'string' && typeof value.message === 'string';
}

function isUser(item: unknown): item is UserProfile {
  if (!item || typeof item !== 'object') return false;
  const value = item as UserProfile;
  return typeof value.id === 'string' && typeof value.full_name === 'string' &&
    ['ADMIN', 'AGENT', 'USER'].includes(value.role);
}

function requireConnection() {
  if (dataBackend === 'firebase' && !db) {
    throw new Error('ระบบฐานข้อมูล Firebase ยังไม่ได้ตั้งค่า');
  }
}

function requireStaffBackend() {
  requireConnection();
}

export function getLocalProperties(): Property[] {
  return readArray(STORAGE_KEY_PROPERTIES, SAMPLE_PROPERTIES, isProperty);
}

export function saveLocalProperties(properties: Property[]) {
  writeArray(STORAGE_KEY_PROPERTIES, properties);
}

function rowToProperty(property: Property): Property {
  const parsedLat = Number(property.latitude);
  const parsedLng = Number(property.longitude);
  const validLat = property.latitude != null && String(property.latitude).trim() !== '' && Number.isFinite(parsedLat) && Math.abs(parsedLat) <= 90;
  const validLng = property.longitude != null && String(property.longitude).trim() !== '' && Number.isFinite(parsedLng) && Math.abs(parsedLng) <= 180;

  let resolvedAgent = property.agent || undefined;
  if (typeof window !== 'undefined') {
    try {
      const allAgents = getAgents();
      // Match by agent_id, agent.id, or user id
      const matched = allAgents.find(a => 
        (property.agent_id && (a.id === property.agent_id || a.user_id === property.agent_id)) ||
        (resolvedAgent && (a.id === resolvedAgent.id || a.user_id === resolvedAgent.user_id || (a.email && a.email.toLowerCase() === resolvedAgent.email?.toLowerCase())))
      );

      if (matched) {
        resolvedAgent = matched;
      }
    } catch {}
  }

  return {
    ...property,
    coordinates_available: property.coordinates_available !== false && validLat && validLng && (parsedLat !== 0 || parsedLng !== 0),
    price: Number(property.price) || 0,
    latitude: validLat && validLng ? parsedLat : 7.0084, // Fallback to Hat Yai center if invalid/NaN
    longitude: validLat && validLng ? parsedLng : 100.4705,
    bedrooms: Number(property.bedrooms) || 0,
    bathrooms: Number(property.bathrooms) || 0,
    parking: Number(property.parking) || 0,
    land_size: Number(property.land_size) || 0,
    usable_area: Number(property.usable_area) || 0,
    images: property.images || [],
    features: property.features || [],
    agent: resolvedAgent,
  };
}

function filterProperties(properties: Property[], filters?: PropertyFilters): Property[] {
  const contains = (value: string | undefined, needle: string) => (value || '').toLowerCase().includes(needle.toLowerCase());
  const results = properties.filter(property => {
    if (filters?.type && filters.type !== 'all' && property.property_type !== filters.type) return false;
    if (filters?.status && filters.status !== 'all' && property.status !== filters.status) return false;
    if (filters?.province && !contains(property.province, filters.province)) return false;
    if (filters?.district && !contains(property.district, filters.district)) return false;
    if (filters?.subdistrict && !contains(property.subdistrict, filters.subdistrict)) return false;
    if (filters?.minPrice !== undefined && property.price < filters.minPrice) return false;
    if (filters?.maxPrice !== undefined && property.price > filters.maxPrice) return false;
    if (filters?.bedrooms && filters.bedrooms !== 'any' && property.bedrooms < filters.bedrooms) return false;
    if (filters?.bathrooms && filters.bathrooms !== 'any' && property.bathrooms < filters.bathrooms) return false;
    if (filters?.searchQuery && ![
      property.title,
      property.description,
      property.province,
      property.district,
      property.subdistrict,
      property.id,
      formatPropertyCode(property.id)
    ].some(value => contains(value, filters.searchQuery!))) return false;
    if (filters?.features?.length && !filters.features.every(feature => property.features.some(value => contains(value, feature)))) return false;
    if (filters?.hasVideo && !property.video_url) return false;
    if (filters?.featured !== undefined && Boolean(property.featured) !== filters.featured) return false;
    return true;
  });
  return results.sort((a, b) => {
    if (filters?.sortBy === 'price_asc') return a.price - b.price;
    if (filters?.sortBy === 'price_desc') return b.price - a.price;
    if (filters?.sortBy === 'popular') return Number(b.featured) - Number(a.featured);
    return b.created_at.localeCompare(a.created_at);
  });
}

async function loadProperties(includeUnpublished: boolean): Promise<Property[]> {
  requireConnection();
  if (useCloudflarePropertyBackend) {
    const { cloudflareListProperties } = await import('@/lib/cloudflare-properties');
    return (await cloudflareListProperties(includeUnpublished)).map(rowToProperty);
  }
  const firestore: Firestore | null = db;
  if (dataBackend === 'firebase') {
    if (firestore) {
      if (!includeUnpublished) {
        const response = await fetch(apiUrl('/api/properties'));
        const body = await response.json();
        if (!response.ok || !Array.isArray(body.properties)) throw new Error(body.error || 'โหลดรายการทรัพย์ไม่สำเร็จ');
        return body.properties.map((row: Property) => rowToProperty(row));
      }
      const q = includeUnpublished
        ? query(collection(firestore, 'properties'))
        : query(collection(firestore, 'properties'), where('published', '==', true));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(item => rowToProperty({ ...item.data(), id: item.id } as Property));
    }
    return [];
  }
  return getLocalProperties().filter(property => includeUnpublished || property.published);
}

export async function fetchProperties(filters?: PropertyFilters): Promise<Property[]> {
  return filterProperties(await loadProperties(false), filters);
}

export async function fetchPropertyPage(filters: PropertyFilters, cursor: string | null = null, signal?: AbortSignal) {
  if (useCloudflarePropertyBackend) {
    const { cloudflarePropertyPage } = await import('@/lib/cloudflare-properties');
    const page = await cloudflarePropertyPage(filters, cursor, signal);
    return { ...page, data: page.data.map(rowToProperty) };
  }
  return { data: await fetchProperties(filters), nextCursor: null as string | null };
}

export async function fetchAdminProperties(filters?: PropertyFilters): Promise<Property[]> {
  requireStaffBackend();
  return filterProperties(await loadProperties(true), filters);
}

type AdminPageFilters = {
  searchQuery?: string; filter?: string; type?: string; district?: string; sortBy?: string;
};

/** Native Admin pagination on the Cloudflare backend; Firebase/local keep their full list. */
export async function fetchAdminPropertiesPage(
  filters: AdminPageFilters = {}, cursor: string | null = null,
) {
  requireStaffBackend();
  if (useCloudflarePropertyBackend) {
    const { cloudflareAdminPropertyPage } = await import('@/lib/cloudflare-properties');
    const page = await cloudflareAdminPropertyPage(filters, cursor);
    return {
      data: page.data.map(rowToProperty), total: page.total,
      nextCursor: page.nextCursor, counts: page.counts, paginated: true as const,
    };
  }
  const data = await fetchAdminProperties();
  const counts = { all: data.length, sale: 0, rent: 0, featured: 0, draft: 0, published: 0 };
  for (const property of data) {
    if (property.status === 'sale') counts.sale += 1; else counts.rent += 1;
    if (property.featured) counts.featured += 1;
    if (property.published) counts.published += 1; else counts.draft += 1;
  }
  return { data, total: data.length, nextCursor: null as string | null, counts, paginated: false as const };
}

/** Direct editor load: one detail request instead of scanning the whole Admin list. */
export async function fetchAdminPropertyById(id: string): Promise<Property | null> {
  requireStaffBackend();
  if (useCloudflarePropertyBackend) {
    const { cloudflareAdminDetail } = await import('@/lib/cloudflare-properties');
    try {
      return rowToProperty(await cloudflareAdminDetail(id));
    } catch (error) {
      if (error instanceof Error && /not found/i.test(error.message)) return null;
      throw error;
    }
  }
  return (await fetchAdminProperties()).find(property => property.id === id) ?? null;
}

/**
 * Whole-catalog helper for the dashboard/automation/map screens, which still
 * need every listing for client-side charts and matching. It walks the native
 * keyset pages (100 rows each) instead of the old capped bridge, and fails
 * visibly at the shared row/page ceiling rather than silently truncating.
 */
export async function fetchAdminCatalog(): Promise<Property[]> {
  requireStaffBackend();
  if (!useCloudflarePropertyBackend) return fetchAdminProperties();
  const { cloudflareAdminPropertyPage } = await import('@/lib/cloudflare-properties');
  const rows = await collectAdminCatalogPages<Property>(cursor =>
    cloudflareAdminPropertyPage({ sortBy: 'newest' }, cursor, 100)
      .then(page => ({ data: page.data, nextCursor: page.nextCursor })));
  return rows.map(rowToProperty);
}

function matchesPropertyKey(property: Property, key: string): boolean {
  const normalized = key.trim().toLowerCase();
  if (!normalized) return false;
  if (property.slug && property.slug.toLowerCase() === normalized) return true;
  if (property.id && property.id.toLowerCase() === normalized) return true;
  const code = formatPropertyCode(property.id);
  return code !== '-' && code.toLowerCase() === normalized;
}

export async function fetchPropertyBySlug(slug: string): Promise<Property | null> {
  requireConnection();
  if (useCloudflarePropertyBackend) {
    const { cloudflarePublicDetail } = await import('@/lib/cloudflare-properties');
    const result = await cloudflarePublicDetail(slug);
    return result ? rowToProperty(result) : null;
  }
  return (await loadProperties(false)).find(property => matchesPropertyKey(property, slug)) || null;
}

function generateShortPropertyId(): string {
  const chars = '23456789abcdefghjkmnpqrstuvwxyz';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ck-${rand}`;
}

async function triggerLineNotification(property: Property) {
  if (!property.published) return;
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  try {
    const res = await fetchStaffApi('/api/line/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...property, notifyCustomers: true }),
    });
    const data = await res.json();
    if (res.ok && data.isRealSent === true) {
      const customerNotice = typeof data.customerRecipients === 'number' && data.customerRecipients > 0
        ? ` (แจ้งเตือนลูกค้าผู้ติดตาม OA แล้ว ${data.customerDelivered}/${data.customerRecipients} คน)`
        : '';
      logSystemActivity({
        category: 'system',
        action: 'system_notification',
        title: 'LINE รับคำขอแจ้งเตือนทีม',
        description: `LINE รับคำขอส่งข้อมูลทรัพย์ "${property.title}" ถึงบัญชีเจ้าหน้าที่ที่กำหนดไว้แล้ว${customerNotice} กรุณาตรวจการได้รับข้อความที่บัญชีผู้รับ`,
        target_id: property.id,
        target_name: property.title,
        actor_name: 'ระบบอัตโนมัติ',
      }).catch(() => undefined);
    }
  } catch (err) {
    console.warn('Failed to send LINE notification:', err);
  }
}

export async function createProperty(property: Omit<Property, 'id' | 'created_at'>): Promise<Property> {
  requireStaffBackend();
  if (useCloudflarePropertyBackend) {
    const { cloudflareCreateProperty } = await import('@/lib/cloudflare-properties');
    return cloudflareCreateProperty(property);
  }
  const firestore: Firestore | null = db;
  if (dataBackend === 'firebase' && firestore) {
    const newId = generateShortPropertyId();
    const newProperty: Property = {
      ...property,
      id: newId,
      created_at: new Date().toISOString()
    };
    const media = await preparePropertyMedia(firestore, newId, newProperty.images, newProperty.cover_image);
    newProperty.images = media.images;
    newProperty.cover_image = media.cover_image;
    try { await setDoc(doc(firestore, 'properties', newId), JSON.parse(JSON.stringify(newProperty))); }
    catch (error) { await media.cleanup(); throw error; }
    recordPropertyHistory({
      property_id: newProperty.id,
      property_title: newProperty.title,
      change_type: 'created',
      new_value: newProperty.price,
      diff_summary: `สร้างประกาศทรัพย์ใหม่ "${newProperty.title}" ในระบบ Cloud Firestore`,
    }).catch(() => undefined);
    logSystemActivity({
      category: 'property',
      action: 'property_created',
      title: 'เพิ่มทรัพย์ใหม่ในระบบ',
      description: `เพิ่มอสังหาริมทรัพย์ใหม่ "${newProperty.title}" มูลค่า ฿${newProperty.price?.toLocaleString() || 0}`,
      target_id: newProperty.id,
      target_name: newProperty.title,
      actor_name: 'ผู้ดูแลระบบ',
    }).catch(() => undefined);
    triggerLineNotification(newProperty).catch(() => undefined);
    return newProperty;
  }
  const properties = getLocalProperties();
  if (properties.some(item => item.slug === property.slug)) throw new Error('ที่อยู่ประกาศ (Slug) นี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น');
  const newProperty: Property = { ...property, id: generateShortPropertyId(), created_at: new Date().toISOString() };
  saveLocalProperties([newProperty, ...properties]);
  recordPropertyHistory({
    property_id: newProperty.id,
    property_title: newProperty.title,
    change_type: 'created',
    new_value: newProperty.price,
    diff_summary: `สร้างประกาศทรัพย์ใหม่ "${newProperty.title}" ในระบบ`,
  }).catch(() => undefined);
  triggerLineNotification(newProperty).catch(() => undefined);
  return newProperty;
}

export async function updateProperty(id: string, updates: Partial<Property>, expectedUpdatedAt?: string): Promise<Property | null> {
  requireStaffBackend();
  if (useCloudflarePropertyBackend) {
    const { cloudflareUpdateProperty } = await import('@/lib/cloudflare-properties');
    return cloudflareUpdateProperty(id, updates, expectedUpdatedAt);
  }
  const { id: ignoredId, created_at: ignoredCreated, images, agent, ...fields } = updates;
  const changes = { ...fields, updated_at: new Date().toISOString() };
  const firestore: Firestore | null = db;
  if (dataBackend === 'firebase' && firestore) {
    const current = (await loadProperties(true)).find(p => p.id === id);
    if (!current) throw new Error('ไม่พบประกาศที่ต้องการแก้ไข');
    const updated = {
      ...current,
      ...changes,
      ...(current.coordinates_available === false &&
        typeof updates.latitude === 'number' && Number.isFinite(updates.latitude) && Math.abs(updates.latitude) <= 90 &&
        typeof updates.longitude === 'number' && Number.isFinite(updates.longitude) && Math.abs(updates.longitude) <= 180 &&
        (updates.latitude !== current.latitude || updates.longitude !== current.longitude)
        ? { coordinates_available: true } : {}),
      ...(images ? { images } : {}),
      ...(agent ? { agent } : {})
    };
    const previousPhotos = [...current.images, current.cover_image];
    const media = await preparePropertyMedia(firestore, id, updated.images, updated.cover_image, previousPhotos.filter(photo => photo.startsWith('data:')));
    updated.images = media.images;
    updated.cover_image = media.cover_image;
    const persisted = JSON.parse(JSON.stringify(updated));
    // An explicitly cleared optional year must also be removed from a merged cloud document.
    if (Object.prototype.hasOwnProperty.call(updates, 'year_built') && updates.year_built === undefined) {
      persisted.year_built = deleteField();
    }
    try { await setDoc(doc(firestore, 'properties', id), persisted, { merge: true }); }
    catch (error) { await media.cleanup(); throw error; }
    await removeUnusedPropertyMedia(firestore, id, previousPhotos, [...updated.images, updated.cover_image]);
    logPropertyChanges(current, updates).catch(() => undefined);
    return updated;
  }
  const properties = getLocalProperties();
  const index = properties.findIndex(property => property.id === id);
  if (index === -1) throw new Error('ไม่พบประกาศที่ต้องการแก้ไข');
  if (fields.slug && properties.some(property => property.id !== id && property.slug === fields.slug)) {
    throw new Error('ที่อยู่ประกาศ (Slug) นี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น');
  }
  const current = properties[index];
  const updated = { ...current, ...changes, ...(images ? { images } : {}), ...(agent ? { agent } : {}) };
  properties[index] = updated;
  saveLocalProperties(properties);
  logPropertyChanges(current, updates).catch(() => undefined);
  return updated;
}

export async function deleteProperty(id: string, expectedUpdatedAt?: string): Promise<boolean> {
  requireStaffBackend();
  if (useCloudflarePropertyBackend) {
    const { cloudflareDeleteProperty } = await import('@/lib/cloudflare-properties');
    return cloudflareDeleteProperty(id, expectedUpdatedAt);
  }
  const firestore: Firestore | null = db;
  if (dataBackend === 'firebase' && firestore) {
    await deleteDoc(doc(firestore, 'properties', id));
    // Remove private media only after the parent deletion succeeds.
    // If cleanup is interrupted, the published-parent image check still denies access.
    try {
      const photos = await getDocs(query(collection(firestore, 'property_media'), where('property_id', '==', id)));
      await Promise.allSettled(photos.docs.map(photo => deleteDoc(doc(firestore, 'property_media', photo.id))));
    } catch { console.warn('Property deleted; media cleanup could not finish'); }
    return true;
  }
  const properties = getLocalProperties();
  if (!properties.some(property => property.id === id)) return false;
  saveLocalProperties(properties.filter(property => property.id !== id));
  return true;
}

export function getFavoriteIds(): string[] {
  return readArray(STORAGE_KEY_FAVORITES, [], (item): item is string => typeof item === 'string');
}

export function toggleFavoriteId(propertyId: string): boolean {
  const current = getFavoriteIds();
  const exists = current.includes(propertyId);
  writeArray(STORAGE_KEY_FAVORITES, exists ? current.filter(id => id !== propertyId) : [...current, propertyId]);
  window.dispatchEvent(new Event('favorites-updated'));
  return !exists;
}

export async function submitInquiry(inquiry: Omit<Inquiry, 'id' | 'created_at'>): Promise<Inquiry> {
  requireConnection();
  if (!inquiry.name.trim() || !inquiry.phone.trim() || !inquiry.message.trim()) {
    throw new Error('กรุณากรอกชื่อ เบอร์โทรศัพท์ และข้อความให้ครบถ้วน');
  }
  const firestore: Firestore | null = db;
  if (dataBackend === 'firebase' && firestore) {
    return submitFirebaseInquiry(inquiry);
  }
  throw new Error('ไม่สามารถเชื่อมต่อระบบรับข้อความ กรุณาติดต่อทางโทรศัพท์หรือ LINE');
}

export function getLocalInquiries(): Inquiry[] {
  return readArray(STORAGE_KEY_INQUIRIES, [], isInquiry);
}

export async function fetchInquiries(): Promise<Inquiry[]> {
  requireStaffBackend();
  const firestore: Firestore | null = db;
  if (dataBackend === 'firebase' && firestore) {
    const snap = await getDocs(collection(firestore, 'inquiries'));
    const inqs = snap.docs.map(d => ({ ...d.data(), id: d.id } as Inquiry));
    return inqs.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return getLocalInquiries();
}

export async function updateInquiryStatus(id: string, status: Inquiry['status']): Promise<Inquiry | null> {
  requireStaffBackend();
  let updatedInquiry: Inquiry | null = null;
  const firestore: Firestore | null = db;
  if (dataBackend === 'firebase' && firestore) {
    try {
      await setDoc(doc(firestore, 'inquiries', id), { status }, { merge: true });
      const snap = await getDocs(collection(firestore, 'inquiries'));
      const found = snap.docs.find(d => d.id === id);
      updatedInquiry = found ? ({ ...found.data(), id: found.id } as Inquiry) : null;
    } catch (err) {
      console.error('Firestore updateInquiryStatus error:', err);
    }
  } else {
    const inquiries = getLocalInquiries();
    const inquiry = inquiries.find(item => item.id === id);
    if (inquiry) {
      const updated = { ...inquiry, status };
      writeArray(STORAGE_KEY_INQUIRIES, inquiries.map(item => item.id === id ? updated : item));
      updatedInquiry = updated;
    }
  }

  if (updatedInquiry) {
    const statusLabel = status === 'contacted' ? 'ติดต่อแล้ว' : 'รอดำเนินการ';
    logSystemActivity({
      category: 'inquiry',
      action: 'inquiry_status_updated',
      title: 'อัปเดตสถานะผู้สนใจ',
      description: `เปลี่ยนสถานะผู้ติดต่อ คุณ "${updatedInquiry.name}" เป็น "${statusLabel}"`,
      target_id: updatedInquiry.id,
      target_name: updatedInquiry.name,
      actor_name: 'ผู้ดูแลระบบ',
    }).catch(() => undefined);
  }

  return updatedInquiry;
}

export function getLocalUsers(): UserProfile[] {
  return readArray<UserProfile>(STORAGE_KEY_USERS, [
    { id: 'user-benz', full_name: 'คุณเบนซ์ (ผู้ดูแลระบบ)', email: 'benzttr12@gmail.com', role: 'ADMIN' },
    { id: 'user-pim', full_name: 'คุณพิมลภัส (นายหน้า)', email: 'agent@chantakornproperty.com', role: 'AGENT' },
  ], isUser);
}

export function saveLocalUsers(users: UserProfile[]) {
  writeArray(STORAGE_KEY_USERS, users);
}

export async function fetchUsers(): Promise<UserProfile[]> {
  requireStaffBackend();
  let usersList: UserProfile[];
  if (dataBackend === 'firebase') {
    if (!db) throw new Error('ระบบฐานข้อมูล Firebase ยังไม่ได้ตั้งค่า');
    const snapshot = await getDocs(collection(db, 'profiles'));
    usersList = snapshot.docs.map(item => ({ ...item.data(), id: item.id } as UserProfile));
  } else {
    usersList = getLocalUsers();
  }
  // A view projection only: fetching profiles never creates cloud agents or profiles.
  syncAgentsFromUsers(usersList);
  return usersList;
}

export async function updateUserRole(userId: string, role: UserProfile['role']): Promise<UserProfile[]> {
  return updateUserProfile(userId, { role });
}

export async function addUser(user: UserProfile): Promise<UserProfile[]> {
  const firestore: Firestore | null = db;
  if (dataBackend === 'firebase' && firestore) {
    const newId = user.id || `user-${Date.now()}`;
    const newUser = { ...user, id: newId, created_at: new Date().toISOString() };
    await setDoc(doc(firestore, 'profiles', newId), JSON.parse(JSON.stringify(newUser)));
    const all = await fetchUsers();
    syncAgentsFromUsers(all);
    return all;
  }
  const updated = addLocalUser(user);
  syncAgentsFromUsers(updated);
  return updated;
}

export function addLocalUser(user: UserProfile): UserProfile[] {
  const users = getLocalUsers();
  if (user.email && users.some(item => item.email?.toLowerCase() === user.email!.toLowerCase())) {
    throw new Error('อีเมลนี้มีอยู่แล้ว');
  }
  const updated = [user, ...users];
  saveLocalUsers(updated);
  syncAgentsFromUsers(updated);
  return updated;
}

export async function updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile[]> {
  requireStaffBackend();
  const { id: ignoredId, ...fields } = updates;
  let all: UserProfile[] = [];
  const firestore: Firestore | null = db;
  if (dataBackend === 'firebase' && firestore) {
    await setDoc(doc(firestore, 'profiles', userId), fields, { merge: true });
    all = await fetchUsers();
  } else {
    const users = getLocalUsers();
    const updated = users.map(user => user.id === userId ? { ...user, ...fields } : user);
    saveLocalUsers(updated);
    all = updated;
  }

  // Sync to agents store
  syncAgentsFromUsers(all);

  // If role is updated, log to system activities
  if (updates.role) {
    const targetUser = all.find(u => u.id === userId);
    if (targetUser) {
      const roleLabels: Record<string, string> = {
        'ADMIN': 'ผู้ดูแลระบบ (ADMIN)',
        'AGENT': 'นายหน้า (AGENT)',
        'USER': 'ผู้ใช้งานทั่วไป (USER)',
      };
      const roleLabel = roleLabels[updates.role] || updates.role;
      logSystemActivity({
        category: 'user_role',
        action: 'user_role_updated',
        title: 'เปลี่ยนสิทธิ์การเข้าใช้งานระบบ',
        description: `อัปเดตระดับสิทธิ์ผู้ใช้งาน "${targetUser.full_name}" เป็น "${roleLabel}"`,
        target_id: userId,
        target_name: targetUser.full_name,
        actor_name: 'ผู้ดูแลระบบ',
      }).catch(() => undefined);
    }
  }

  return all;
}

export async function deleteUser(userId: string): Promise<UserProfile[]> {
  const firestore: Firestore | null = db;
  if (dataBackend === 'firebase' && firestore) {
    await deleteDoc(doc(firestore, 'profiles', userId));
    const all = await fetchUsers();
    syncAgentsFromUsers(all);
    return all;
  }
  const updated = deleteLocalUser(userId);
  syncAgentsFromUsers(updated);
  return updated;
}

export function deleteLocalUser(userId: string): UserProfile[] {
  const updated = getLocalUsers().filter(user => user.id !== userId);
  saveLocalUsers(updated);
  syncAgentsFromUsers(updated);
  return updated;
}
