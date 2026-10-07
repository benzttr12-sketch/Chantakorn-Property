'use client';

import { Property, PropertyFilters, Inquiry, UserProfile, Agent, AgentRank } from '@/lib/types';
import { SAMPLE_PROPERTIES } from '@/data/sample-properties';
import { formatPropertyCode } from '@/lib/format-code';
import { supabase } from '@/lib/supabase/client';
import { db } from '@/lib/firebase/client';
import { dataBackend } from '@/lib/backend';
import { fetchStaffApi } from '@/lib/staff-api';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
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
const PROPERTY_SELECT = '*, agents(*), property_images(image_url, sort_order)';

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

type PropertyRow = Property & {
  agents?: Property['agent'];
  property_images?: { image_url: string; sort_order: number }[];
};

function rowToProperty(row: PropertyRow): Property {
  const { agents, property_images, ...property } = row;
  const parsedLat = Number(property.latitude);
  const parsedLng = Number(property.longitude);
  const validLat = property.latitude != null && String(property.latitude).trim() !== '' && Number.isFinite(parsedLat) && Math.abs(parsedLat) <= 90;
  const validLng = property.longitude != null && String(property.longitude).trim() !== '' && Number.isFinite(parsedLng) && Math.abs(parsedLng) <= 180;

  let resolvedAgent = agents || property.agent || undefined;
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
      } else if (resolvedAgent) {
        const stored = localStorage.getItem('chantakorn_auth_user');
        if (stored) {
          const u = JSON.parse(stored);
          if (u && (u.id === property.agent_id || (u.email && u.email.toLowerCase() === resolvedAgent.email?.toLowerCase()) || u.id === resolvedAgent.id)) {
            resolvedAgent = {
              ...resolvedAgent,
              photo_url: u.avatar_url || resolvedAgent.photo_url,
              name: u.full_name || resolvedAgent.name,
              phone: u.phone || resolvedAgent.phone,
              line_id: u.line_id || resolvedAgent.line_id,
            };
          }
        }
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
    images: Array.isArray(property_images)
      ? [...property_images].sort((a, b) => a.sort_order - b.sort_order).map(image => image.image_url)
      : property.images || [],
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
  if (dataBackend === 'supabase') {
    if (supabase) {
      let request = supabase.from('properties').select(PROPERTY_SELECT);
      if (!includeUnpublished) request = request.eq('published', true);
      const { data, error } = await request;
      if (error) throw error;
      return (data || []).map(row => rowToProperty(row as PropertyRow));
    }
    return [];
  }
  const firestore: Firestore | null = db;
  if (dataBackend === 'firebase') {
    if (firestore) {
      const q = includeUnpublished
        ? query(collection(firestore, 'properties'))
        : query(collection(firestore, 'properties'), where('published', '==', true));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(item => rowToProperty({ ...item.data(), id: item.id } as PropertyRow));
    }
    return [];
  }
  return getLocalProperties().filter(property => includeUnpublished || property.published);
}

export async function fetchProperties(filters?: PropertyFilters): Promise<Property[]> {
  return filterProperties(await loadProperties(false), filters);
}

export const getProperties = fetchProperties;

export async function fetchAdminProperties(filters?: PropertyFilters): Promise<Property[]> {
  requireStaffBackend();
  return filterProperties(await loadProperties(true), filters);
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
  if (dataBackend === 'supabase') {
    if (supabase) {
      const { data, error } = await supabase.from('properties').select(PROPERTY_SELECT)
        .eq('slug', slug).eq('published', true).maybeSingle();
      if (error) throw error;
      if (data) return rowToProperty(data as PropertyRow);
      const all = await loadProperties(false);
      return all.find(property => matchesPropertyKey(property, slug)) || null;
    }
    return null;
  }
  const firestore: Firestore | null = db;
  if (dataBackend === 'firebase') {
    if (firestore) {
      const all = await loadProperties(false);
      return all.find(property => matchesPropertyKey(property, slug)) || null;
    }
    return null;
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
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  try {
    const res = await fetchStaffApi('/api/line/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...property, notifyCustomers: true }),
    });
    const data = await res.json();
    if (data.success) {
      const customerNotice = typeof data.customerRecipients === 'number' && data.customerRecipients > 0
        ? ` (แจ้งเตือนลูกค้าผู้ติดตาม OA แล้ว ${data.customerDelivered}/${data.customerRecipients} คน)`
        : '';
      logSystemActivity({
        category: 'system',
        action: 'system_notification',
        title: 'แจ้งเตือน LINE OA อัตโนมัติ',
        description: `ระบบได้ส่งข้อมูลประกาศอสังหาฯ ใหม่ "${property.title}" เข้าไลน์ออฟฟิเชียลแอคเคานต์ https://lin.ee/NMSe28T3${customerNotice} ${data.simulated ? '(โหมดทดสอบจำลอง)' : '(ส่งแจ้งเตือนจริง)'} เรียบร้อยแล้ว`,
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
  if (dataBackend === 'supabase' && supabase) {
    const { images, agent, ...row } = property;
    const { data, error } = await supabase.rpc('save_property', { p_property: row, p_images: images });
    if (error) throw error;
    const created = { ...(data as Property), images, agent };
    recordPropertyHistory({
      property_id: created.id,
      property_title: created.title,
      change_type: 'created',
      new_value: created.price,
      diff_summary: `สร้างประกาศทรัพย์ใหม่ "${created.title}" ในระบบ`,
    }).catch(() => undefined);
    triggerLineNotification(created).catch(() => undefined);
    return created;
  }
  const firestore: Firestore | null = db;
  if (dataBackend === 'firebase' && firestore) {
    const newId = generateShortPropertyId();
    const newProperty: Property = {
      ...property,
      id: newId,
      created_at: new Date().toISOString()
    };
    await setDoc(doc(firestore, 'properties', newId), JSON.parse(JSON.stringify(newProperty)));
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
    const result = rowToProperty(data as PropertyRow);
    logPropertyChanges(result, updates).catch(() => undefined);
    return result;
  }
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
    await setDoc(doc(firestore, 'properties', id), JSON.parse(JSON.stringify(updated)), { merge: true });
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

export async function deleteProperty(id: string): Promise<boolean> {
  requireStaffBackend();
  if (dataBackend === 'supabase' && supabase) {
    const { data, error } = await supabase.from('properties').delete().eq('id', id).select('id');
    if (error) throw error;
    return Boolean(data?.length);
  }
  const firestore: Firestore | null = db;
  if (dataBackend === 'firebase' && firestore) {
    await deleteDoc(doc(firestore, 'properties', id));
    return true;
  }
  const properties = getLocalProperties();
  if (!properties.some(property => property.id === id)) return false;
  saveLocalProperties(properties.filter(property => property.id !== id));
  return true;
}

export async function syncPropertiesAgentProfile(profile: UserProfile): Promise<void> {
  if (!profile) return;
  const newAvatar = profile.avatar_url || '';
  const newName = profile.full_name || '';
  const newPhone = profile.phone || '';
  const newLine = profile.line_id || '';
  const newEmail = profile.email || '';

  // 1. Sync in Firebase Firestore if connected
  if (dataBackend === 'firebase' && db) {
    try {
      const snap = await getDocs(collection(db, 'properties'));
      for (const docSnap of snap.docs) {
        const p = docSnap.data() as Property;
        const isMatch = 
          (p.agent_id && (p.agent_id === profile.id || p.agent_id === profile.email)) ||
          (p.agent && (p.agent.id === profile.id || (profile.email && p.agent.email?.toLowerCase() === profile.email.toLowerCase())));

        if (isMatch) {
          const resolvedRank: AgentRank = profile.role === 'ADMIN' ? 'แอดมิน' : 'นายหน้า';
          const updatedAgent: Agent = {
            id: p.agent?.id || profile.id,
            name: newName || p.agent?.name || 'ตัวแทน Chantakorn Property',
            rank: resolvedRank,
            title: resolvedRank,
            phone: newPhone || p.agent?.phone || '081-604-0097',
            line_id: newLine || p.agent?.line_id || 'LINE Official Account',
            email: newEmail || p.agent?.email || '',
            photo_url: newAvatar || p.agent?.photo_url || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80',
            bio: p.agent?.bio || (profile.bio || (resolvedRank === 'แอดมิน' ? 'ผู้ดูแลระบบและที่ปรึกษาอสังหาริมทรัพย์ Chantakorn Property' : 'ตัวแทนนายหน้าอสังหาริมทรัพย์')),
            facebook: p.agent?.facebook
          };
          await setDoc(doc(db, 'properties', docSnap.id), {
            agent: updatedAgent,
            agent_id: profile.id,
            updated_at: new Date().toISOString()
          }, { merge: true });
        }
      }
    } catch (err) {
      console.warn('Firebase syncPropertiesAgentProfile error:', err);
    }
  }

  // 2. Sync in Local Storage
  try {
    const localProps = getLocalProperties();
    let hasChanges = false;
    const updated = localProps.map(p => {
      const isMatch = 
        (p.agent_id && (p.agent_id === profile.id || p.agent_id === profile.email)) ||
        (p.agent && (p.agent.id === profile.id || (profile.email && p.agent.email?.toLowerCase() === profile.email.toLowerCase())));

      if (isMatch) {
        hasChanges = true;
        const resolvedRank: AgentRank = profile.role === 'ADMIN' ? 'แอดมิน' : 'นายหน้า';
        const updatedAgent: Agent = {
          id: p.agent?.id || profile.id,
          name: newName || p.agent?.name || 'ตัวแทน Chantakorn Property',
          rank: resolvedRank,
          title: resolvedRank,
          phone: newPhone || p.agent?.phone || '081-604-0097',
          line_id: newLine || p.agent?.line_id || 'LINE Official Account',
          email: newEmail || p.agent?.email || '',
          photo_url: newAvatar || p.agent?.photo_url || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80',
          bio: p.agent?.bio || (profile.bio || (resolvedRank === 'แอดมิน' ? 'ผู้ดูแลระบบและที่ปรึกษาอสังหาริมทรัพย์ Chantakorn Property' : 'ตัวแทนนายหน้าอสังหาริมทรัพย์')),
          facebook: p.agent?.facebook
        };
        return {
          ...p,
          agent: updatedAgent,
          agent_id: profile.id,
          updated_at: new Date().toISOString()
        };
      }
      return p;
    });

    if (hasChanges) {
      saveLocalProperties(updated);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('properties-updated'));
    }
  } catch (err) {
    console.warn('Local storage syncPropertiesAgentProfile error:', err);
  }
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
  const result: Inquiry = { ...inquiry, id: crypto.randomUUID(), status: 'new', created_at: new Date().toISOString() };
  const firestore: Firestore | null = db;
  if (dataBackend === 'firebase' && firestore) {
    // Firestore rejects undefined optional fields. JSON also strips them recursively.
    await setDoc(doc(firestore, 'inquiries', result.id), JSON.parse(JSON.stringify(result)));
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      fetch('/api/line/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      }).catch(() => undefined);
    }
    return result;
  }
  if (dataBackend === 'supabase' && supabase) {
    // Anonymous visitors may insert inquiries but may never read the private inbox.
    const { error } = await supabase.from('inquiries').insert(result);
    if (error) throw error;
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      fetch('/api/line/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      }).catch(() => undefined);
    }
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
  if (dataBackend === 'supabase' && supabase) {
    const { data, error } = await supabase.from('inquiries').update({ status }).eq('id', id).select().maybeSingle();
    if (error) throw error;
    updatedInquiry = data as Inquiry | null;
  } else {
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
  let usersList: UserProfile[] = [];
  const firestore: Firestore | null = db;
  if (dataBackend === 'supabase' && supabase) {
    const { data, error } = await supabase.from('profiles').select('*').order('full_name');
    if (error) throw error;
    usersList = (data || []) as UserProfile[];
  } else if (dataBackend === 'firebase' && firestore) {
    const snap = await getDocs(collection(firestore, 'profiles'));
    if (!snap.empty) {
      usersList = snap.docs.map(d => ({ ...d.data(), id: d.id } as UserProfile));
    } else {
      const defaultUsers: UserProfile[] = [
        { 
          id: 'user-benz', 
          full_name: 'คุณเบนซ์ (ผู้บริหาร & แอดมิน)', 
          email: 'benzttr12@gmail.com', 
          role: 'ADMIN',
          phone: '081-604-0097',
          line_id: '@930xzcyi',
          facebook: 'https://www.facebook.com/chantakornproperty',
          avatar_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80',
          bio: 'ผู้ก่อตั้งและผู้บริหาร Chantakorn Property ยินดีให้คำปรึกษาอสังหาริมทรัพย์ระดับมืออาชีพในหาดใหญ่และสงขลา'
        },
        { 
          id: 'user-pim', 
          full_name: 'คุณพิมลภัส รัตนวิจิตร', 
          email: 'agent@chantakornproperty.com', 
          role: 'AGENT',
          phone: '082-456-7890',
          line_id: 'pim_realty',
          facebook: 'https://www.facebook.com/chantakornproperty',
          avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
          bio: 'เชี่ยวชาญคอนโดและบ้านเดี่ยวโซน ม.อ. – คอหงส์ ประสบการณ์กว่า 4 ปี'
        },
      ];
      try {
        const promises = defaultUsers.map(u => 
          setDoc(doc(firestore, 'profiles', u.id), JSON.parse(JSON.stringify(u)))
        );
        await Promise.all(promises);
      } catch (seedErr) {
        console.warn('Seed profiles to Firestore warning:', seedErr);
      }
      usersList = defaultUsers;
    }
  } else {
    usersList = getLocalUsers();
  }

  // Automatically sync to agents store
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
  if (dataBackend === 'supabase' && supabase) {
    const { data, error } = await supabase.from('profiles').update(fields).eq('id', userId).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('ไม่สามารถแก้ไขผู้ใช้นี้ได้ กรุณาตรวจสอบสิทธิ์');
    all = await fetchUsers();
  } else {
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
