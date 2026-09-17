'use client';

import { Property, PropertyFilters, Inquiry, UserProfile } from '@/lib/types';
import { SAMPLE_PROPERTIES } from '@/data/sample-properties';
import { supabase } from '@/lib/supabase/client';
import { db } from '@/lib/firebase/client';
import { dataBackend, isDemoMode } from '@/lib/backend';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';

const STORAGE_KEY_PROPERTIES = 'chantakorn_properties';
const STORAGE_KEY_FAVORITES = 'chantakorn_favorites';
const STORAGE_KEY_INQUIRIES = 'chantakorn_inquiries';
const STORAGE_KEY_USERS = 'chantakorn_users';
const PROPERTY_SELECT = '*, agents(*), property_images(image_url, sort_order)';

let isSeedingFirebase = false;

async function seedFirebaseIfEmpty() {
  if (!db || isSeedingFirebase) return;
  try {
    isSeedingFirebase = true;
    const snap = await getDocs(collection(db, 'properties'));
    if (snap.empty) {
      for (const prop of SAMPLE_PROPERTIES) {
        const cleanProp = JSON.parse(JSON.stringify(prop));
        await setDoc(doc(db, 'properties', prop.id), cleanProp);
      }
    }
  } catch (err) {
    console.error('Failed to seed Firebase Firestore properties:', err);
  } finally {
    isSeedingFirebase = false;
  }
}

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
  // If no database client is available for the active backend, provide fallback
  if ((dataBackend === 'supabase' && !supabase) || (dataBackend === 'firebase' && !db)) {
    console.warn('Database connection not fully configured, falling back gracefully.');
  }
}

function requireDemo() {
  if (!isDemoMode) throw new Error('ข้อมูลนี้ต้องจัดการผ่านฐานข้อมูลที่เชื่อมต่ออยู่');
}

function requireStaffBackend() {
  requireConnection();
}

export function getLocalProperties(): Property[] {
  return readArray(STORAGE_KEY_PROPERTIES, SAMPLE_PROPERTIES, isProperty);
}

export function saveLocalProperties(properties: Property[]) {
  requireDemo();
  writeArray(STORAGE_KEY_PROPERTIES, properties);
}

type PropertyRow = Property & {
  agents?: Property['agent'];
  property_images?: { image_url: string; sort_order: number }[];
};

function rowToProperty(row: PropertyRow): Property {
  const { agents, property_images, ...property } = row;
  return {
    ...property,
    images: Array.isArray(property_images)
      ? [...property_images].sort((a, b) => a.sort_order - b.sort_order).map(image => image.image_url)
      : property.images || [],
    features: property.features || [],
    agent: agents || property.agent || undefined,
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
  requireConnection();
  if (dataBackend === 'supabase' && supabase) {
    try {
      let request = supabase.from('properties').select(PROPERTY_SELECT);
      if (!includeUnpublished) request = request.eq('published', true);
      const { data, error } = await request;
      if (error) throw error;
      return (data || []).map(row => rowToProperty(row as PropertyRow));
    } catch (err) {
      console.warn('Supabase loadProperties error, falling back to sample properties:', err);
      return SAMPLE_PROPERTIES.filter(p => includeUnpublished || p.published);
    }
  }
  if (dataBackend === 'firebase' && db) {
    try {
      const q = includeUnpublished
        ? query(collection(db, 'properties'))
        : query(collection(db, 'properties'), where('published', '==', true));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        await seedFirebaseIfEmpty();
        const seededSnap = await getDocs(q);
        return seededSnap.docs.map(item => rowToProperty({ ...item.data(), id: item.id } as PropertyRow));
      }
      return snapshot.docs.map(item => rowToProperty({ ...item.data(), id: item.id } as PropertyRow));
    } catch (err) {
      console.error('Firestore loadProperties error, falling back to sample properties:', err);
      return SAMPLE_PROPERTIES.filter(p => includeUnpublished || p.published);
    }
  }
  return getLocalProperties().filter(property => includeUnpublished || property.published);
}

export async function fetchProperties(filters?: PropertyFilters): Promise<Property[]> {
  return filterProperties(await loadProperties(false), filters);
}

export async function fetchAdminProperties(filters?: PropertyFilters): Promise<Property[]> {
  requireStaffBackend();
  return filterProperties(await loadProperties(true), filters);
}

export async function fetchPropertyBySlug(slug: string): Promise<Property | null> {
  requireConnection();
  if (dataBackend === 'supabase' && supabase) {
    try {
      const { data, error } = await supabase.from('properties').select(PROPERTY_SELECT)
        .eq('slug', slug).eq('published', true).maybeSingle();
      if (error) throw error;
      return data ? rowToProperty(data as PropertyRow) : null;
    } catch (err) {
      console.warn('Supabase fetchPropertyBySlug error, falling back:', err);
      const all = await loadProperties(false);
      return all.find(property => property.slug === slug) || null;
    }
  }
  if (dataBackend === 'firebase' && db) {
    const all = await loadProperties(false);
    return all.find(property => property.slug === slug) || null;
  }
  // A single published query avoids requiring an additional Firestore composite index.
  return (await loadProperties(false)).find(property => property.slug === slug) || null;
}

export async function createProperty(property: Omit<Property, 'id' | 'created_at'>): Promise<Property> {
  requireStaffBackend();
  if (dataBackend === 'supabase' && supabase) {
    const { images, agent, ...row } = property;
    const { data, error } = await supabase.rpc('save_property', { p_property: row, p_images: images });
    if (error) throw error;
    return { ...(data as Property), images, agent };
  }
  if (dataBackend === 'firebase' && db) {
    const newId = crypto.randomUUID();
    const newProperty: Property = {
      ...property,
      id: newId,
      created_at: new Date().toISOString()
    };
    await setDoc(doc(db, 'properties', newId), JSON.parse(JSON.stringify(newProperty)));
    return newProperty;
  }
  const properties = getLocalProperties();
  if (properties.some(item => item.slug === property.slug)) throw new Error('ที่อยู่ประกาศ (Slug) นี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น');
  const newProperty: Property = { ...property, id: crypto.randomUUID(), created_at: new Date().toISOString() };
  saveLocalProperties([newProperty, ...properties]);
  return newProperty;
}

export async function updateProperty(id: string, updates: Partial<Property>): Promise<Property | null> {
  requireStaffBackend();
  const { id: ignoredId, created_at: ignoredCreated, images, agent, ...fields } = updates;
  const changes = { ...fields, updated_at: new Date().toISOString() };
  if (dataBackend === 'supabase' && supabase) {
    const { error } = await supabase.rpc('save_property', { p_property: { ...fields, id }, p_images: images ?? null });
    if (error) throw error;
    const { data, error: readError } = await supabase.from('properties').select(PROPERTY_SELECT).eq('id', id).maybeSingle();
    if (readError) throw readError;
    if (!data) throw new Error('ไม่พบประกาศหรือไม่มีสิทธิ์แก้ไข');
    return rowToProperty(data as PropertyRow);
  }
  if (dataBackend === 'firebase' && db) {
    const current = (await loadProperties(true)).find(p => p.id === id);
    if (!current) throw new Error('ไม่พบประกาศที่ต้องการแก้ไข');
    const updated = {
      ...current,
      ...changes,
      ...(images ? { images } : {}),
      ...(agent ? { agent } : {})
    };
    await setDoc(doc(db, 'properties', id), JSON.parse(JSON.stringify(updated)), { merge: true });
    return updated;
  }
  const properties = getLocalProperties();
  const index = properties.findIndex(property => property.id === id);
  if (index === -1) throw new Error('ไม่พบประกาศที่ต้องการแก้ไข');
  if (fields.slug && properties.some(property => property.id !== id && property.slug === fields.slug)) {
    throw new Error('ที่อยู่ประกาศ (Slug) นี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น');
  }
  const updated = { ...properties[index], ...changes, ...(images ? { images } : {}), ...(agent ? { agent } : {}) };
  properties[index] = updated;
  saveLocalProperties(properties);
  return updated;
}

export async function deleteProperty(id: string): Promise<boolean> {
  requireStaffBackend();
  if (dataBackend === 'supabase' && supabase) {
    const { data, error } = await supabase.from('properties').delete().eq('id', id).select('id');
    if (error) throw error;
    return Boolean(data?.length);
  }
  if (dataBackend === 'firebase' && db) {
    await deleteDoc(doc(db, 'properties', id));
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
  if (isDemoMode) {
    throw new Error('เว็บไซต์ตัวอย่างยังไม่เชื่อมต่อระบบรับข้อความ กรุณาติดต่อทีมงานทางโทรศัพท์หรือ LINE');
  }
  if (!inquiry.name.trim() || !inquiry.phone.trim() || !inquiry.message.trim()) {
    throw new Error('กรุณากรอกชื่อ เบอร์โทรศัพท์ และข้อความให้ครบถ้วน');
  }
  const result: Inquiry = { ...inquiry, id: crypto.randomUUID(), status: 'new', created_at: new Date().toISOString() };
  if (dataBackend === 'supabase' && supabase) {
    // Anonymous visitors may insert inquiries but may never read the private inbox.
    const { error } = await supabase.from('inquiries').insert(result);
    if (error) throw error;
    return result;
  }
  if (dataBackend === 'firebase' && db) {
    // Firestore rejects undefined optional fields. JSON also strips them recursively.
    await setDoc(doc(db, 'inquiries', result.id), JSON.parse(JSON.stringify(result)));
    return result;
  }
  throw new Error('ไม่สามารถเชื่อมต่อระบบรับข้อความ กรุณาติดต่อทางโทรศัพท์หรือ LINE');
}

export function getLocalInquiries(): Inquiry[] {
  return readArray(STORAGE_KEY_INQUIRIES, [], isInquiry);
}

export async function fetchInquiries(): Promise<Inquiry[]> {
  requireStaffBackend();
  if (dataBackend === 'supabase' && supabase) {
    const { data, error } = await supabase.from('inquiries').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as Inquiry[];
  }
  if (dataBackend === 'firebase' && db) {
    try {
      const snap = await getDocs(collection(db, 'inquiries'));
      const inqs = snap.docs.map(d => ({ ...d.data(), id: d.id } as Inquiry));
      return inqs.sort((a, b) => b.created_at.localeCompare(a.created_at));
    } catch (err) {
      console.error('Firestore fetchInquiries error:', err);
      return getLocalInquiries();
    }
  }
  return getLocalInquiries();
}

export async function updateInquiryStatus(id: string, status: Inquiry['status']): Promise<Inquiry | null> {
  requireStaffBackend();
  if (dataBackend === 'supabase' && supabase) {
    const { data, error } = await supabase.from('inquiries').update({ status }).eq('id', id).select().maybeSingle();
    if (error) throw error;
    return data as Inquiry | null;
  }
  if (dataBackend === 'firebase' && db) {
    try {
      await setDoc(doc(db, 'inquiries', id), { status }, { merge: true });
      const snap = await getDocs(collection(db, 'inquiries'));
      const found = snap.docs.find(d => d.id === id);
      return found ? ({ ...found.data(), id: found.id } as Inquiry) : null;
    } catch (err) {
      console.error('Firestore updateInquiryStatus error:', err);
    }
  }
  const inquiries = getLocalInquiries();
  const inquiry = inquiries.find(item => item.id === id);
  if (!inquiry) return null;
  const updated = { ...inquiry, status };
  writeArray(STORAGE_KEY_INQUIRIES, inquiries.map(item => item.id === id ? updated : item));
  return updated;
}

export function getLocalUsers(): UserProfile[] {
  return readArray<UserProfile>(STORAGE_KEY_USERS, [
    { id: 'demo-admin', full_name: 'ผู้ดูแลตัวอย่าง', email: 'admin@example.com', role: 'ADMIN' },
    { id: 'demo-agent', full_name: 'นายหน้าตัวอย่าง', email: 'agent@example.com', role: 'AGENT' },
    { id: 'demo-user', full_name: 'สมาชิกตัวอย่าง', email: 'user@example.com', role: 'USER' },
  ], isUser);
}

export function saveLocalUsers(users: UserProfile[]) {
  requireDemo();
  writeArray(STORAGE_KEY_USERS, users);
}

export async function fetchUsers(): Promise<UserProfile[]> {
  requireStaffBackend();
  if (dataBackend === 'supabase' && supabase) {
    const { data, error } = await supabase.from('profiles').select('*').order('full_name');
    if (error) throw error;
    return (data || []) as UserProfile[];
  }
  return getLocalUsers();
}

export async function updateUserRole(userId: string, role: UserProfile['role']): Promise<UserProfile[]> {
  return updateUserProfile(userId, { role });
}

export function addLocalUser(user: UserProfile): UserProfile[] {
  requireDemo();
  const users = getLocalUsers();
  if (user.email && users.some(item => item.email?.toLowerCase() === user.email!.toLowerCase())) {
    throw new Error('อีเมลนี้มีอยู่แล้ว');
  }
  const updated = [user, ...users];
  saveLocalUsers(updated);
  return updated;
}

export async function updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile[]> {
  requireStaffBackend();
  const { id: ignoredId, ...fields } = updates;
  if (dataBackend === 'supabase' && supabase) {
    const { data, error } = await supabase.from('profiles').update(fields).eq('id', userId).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('ไม่สามารถแก้ไขผู้ใช้นี้ได้ กรุณาตรวจสอบสิทธิ์');
    return fetchUsers();
  }
  const users = getLocalUsers();
  const updated = users.map(user => user.id === userId ? { ...user, ...fields } : user);
  saveLocalUsers(updated);
  return updated;
}

export function deleteLocalUser(userId: string): UserProfile[] {
  requireDemo();
  const updated = getLocalUsers().filter(user => user.id !== userId);
  saveLocalUsers(updated);
  return updated;
}
