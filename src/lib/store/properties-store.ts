'use client';

import { Property, PropertyFilters, Inquiry, UserProfile } from '@/lib/types';
import { SAMPLE_PROPERTIES } from '@/data/sample-properties';
import { db } from '@/lib/firebase/client';
import { dataBackend } from '@/lib/backend';
import {
  collection,
  getDocs,
  getDocFromServer,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';

const STORAGE_KEY_PROPERTIES = 'chantakorn_properties';
const STORAGE_KEY_FAVORITES = 'chantakorn_favorites';

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
  return JSON.parse(JSON.stringify(fallback)) as T[];
}

function writeArray<T>(key: string, value: T[]) {
  if (typeof window === 'undefined') throw new Error('กรุณาเปิดหน้านี้ในเว็บเบราว์เซอร์');
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error('บันทึกข้อมูลในเบราว์เซอร์ไม่ได้ กรุณาตรวจสอบพื้นที่จัดเก็บและอนุญาตให้เว็บไซต์บันทึกข้อมูล');
  }
}

function isProperty(item: unknown): item is Property {
  if (!item || typeof item !== 'object') return false;
  const value = item as Property;
  return ['id', 'title', 'slug', 'description', 'province', 'district', 'cover_image', 'created_at']
    .every(key => typeof value[key as keyof Property] === 'string') &&
    typeof value.price === 'number' && Array.isArray(value.images) && Array.isArray(value.features);
}

function requireFirestore() {
  if (dataBackend !== 'firebase' || !db) {
    throw new Error('ระบบฐานข้อมูล Firebase ยังไม่ได้ตั้งค่า');
  }
  return db;
}

// Records contain plain JSON values. Firestore rejects optional undefined fields.
function withoutUndefined<T extends object>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getLocalProperties(): Property[] {
  return readArray(STORAGE_KEY_PROPERTIES, SAMPLE_PROPERTIES, isProperty);
}

function rowToProperty(property: Property): Property {
  const parsedLat = Number(property.latitude);
  const parsedLng = Number(property.longitude);
  const validLat = Number.isFinite(parsedLat) && Math.abs(parsedLat) <= 90;
  const validLng = Number.isFinite(parsedLng) && Math.abs(parsedLng) <= 180;
  return {
    ...property,
    price: Number(property.price) || 0,
    latitude: validLat && validLng ? parsedLat : 7.0084,
    longitude: validLat && validLng ? parsedLng : 100.4705,
    bedrooms: Number(property.bedrooms) || 0,
    bathrooms: Number(property.bathrooms) || 0,
    parking: Number(property.parking) || 0,
    land_size: Number(property.land_size) || 0,
    usable_area: Number(property.usable_area) || 0,
    images: property.images || [],
    features: property.features || [],
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
    if (filters?.searchQuery && ![property.title, property.description, property.province, property.district, property.subdistrict]
      .some(value => contains(value, filters.searchQuery!))) return false;
    if (filters?.features?.length && !filters.features.every(feature => property.features.some(value => contains(value, feature)))) return false;
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
  if (dataBackend === 'local' && !includeUnpublished) {
    return getLocalProperties().filter(property => property.published);
  }
  const firestore = requireFirestore();
  // Preserve standard queries for the rules-protected app and offline catalog
  // reads. Public queries must explicitly constrain published documents.
  const request = includeUnpublished
    ? collection(firestore, 'properties')
    : query(collection(firestore, 'properties'), where('published', '==', true));
  const snapshot = await getDocs(request);
  return snapshot.docs.map(item => rowToProperty({ ...item.data(), id: item.id } as Property));
}

export async function fetchProperties(filters?: PropertyFilters): Promise<Property[]> {
  return filterProperties(await loadProperties(false), filters);
}

export async function fetchAdminProperties(filters?: PropertyFilters): Promise<Property[]> {
  return filterProperties(await loadProperties(true), filters);
}

export async function fetchPropertyBySlug(slug: string): Promise<Property | null> {
  return (await loadProperties(false)).find(property => property.slug === slug) || null;
}

export async function createProperty(property: Omit<Property, 'id' | 'created_at'>): Promise<Property> {
  const firestore = requireFirestore();
  const newProperty = withoutUndefined({ ...property, id: crypto.randomUUID(), created_at: new Date().toISOString() });
  await setDoc(doc(firestore, 'properties', newProperty.id), newProperty);
  return newProperty;
}

export async function updateProperty(id: string, updates: Partial<Property>): Promise<Property | null> {
  const firestore = requireFirestore();
  const { id: ignoredId, created_at: ignoredCreated, ...fields } = updates;
  const changes = withoutUndefined({ ...fields, updated_at: new Date().toISOString() });
  const reference = doc(firestore, 'properties', id);
  // Only change submitted fields; a missing document must not be recreated.
  await updateDoc(reference, changes);
  const snapshot = await getDocFromServer(reference);
  if (!snapshot.exists()) throw new Error('ไม่พบประกาศที่ต้องการแก้ไข');
  return rowToProperty({ ...snapshot.data(), id: snapshot.id } as Property);
}

export async function deleteProperty(id: string): Promise<boolean> {
  await deleteDoc(doc(requireFirestore(), 'properties', id));
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
  if (dataBackend === 'local') {
    throw new Error('เว็บไซต์ตัวอย่างยังไม่เชื่อมต่อระบบรับข้อความ กรุณาติดต่อทีมงานทางโทรศัพท์หรือ LINE');
  }
  const firestore = requireFirestore();
  if (!inquiry.name.trim() || !inquiry.phone.trim() || !inquiry.message.trim()) {
    throw new Error('กรุณากรอกชื่อ เบอร์โทรศัพท์ และข้อความให้ครบถ้วน');
  }
  const result: Inquiry = withoutUndefined({
    ...inquiry,
    id: crypto.randomUUID(),
    status: 'new',
    created_at: new Date().toISOString(),
  });
  // Public inquiry submission must not require reading the private inbox.
  await setDoc(doc(firestore, 'inquiries', result.id), result);
  return result;
}

export async function fetchInquiries(): Promise<Inquiry[]> {
  const snapshot = await getDocs(collection(requireFirestore(), 'inquiries'));
  return snapshot.docs.map(item => ({ ...item.data(), id: item.id } as Inquiry))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function updateInquiryStatus(id: string, status: Inquiry['status']): Promise<Inquiry | null> {
  const reference = doc(requireFirestore(), 'inquiries', id);
  await updateDoc(reference, { status });
  const snapshot = await getDocFromServer(reference);
  if (!snapshot.exists()) throw new Error('ไม่พบข้อความที่ต้องการแก้ไข');
  return { ...snapshot.data(), id: snapshot.id } as Inquiry;
}

export async function fetchUsers(): Promise<UserProfile[]> {
  const snapshot = await getDocs(collection(requireFirestore(), 'profiles'));
  return snapshot.docs.map(item => ({ ...item.data(), id: item.id } as UserProfile))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export async function updateUserRole(userId: string, role: UserProfile['role']): Promise<UserProfile[]> {
  await updateDoc(doc(requireFirestore(), 'profiles', userId), { role, updated_at: new Date().toISOString() });
  return fetchUsers();
}

export async function updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile[]> {
  const fields = withoutUndefined({
    full_name: updates.full_name,
    phone: updates.phone,
    updated_at: new Date().toISOString(),
  });
  await updateDoc(doc(requireFirestore(), 'profiles', userId), fields);
  return fetchUsers();
}
