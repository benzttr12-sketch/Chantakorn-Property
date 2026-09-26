'use client';

import { PropertyHistoryLog, Property, PropertyHistoryChangeType } from '@/lib/types';
import { db } from '@/lib/firebase/client';
import { dataBackend } from '@/lib/backend';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { getStoredUser } from '@/lib/auth-helpers';
import { formatPrice } from '@/lib/utils';

const STORAGE_KEY_PROPERTY_HISTORY = 'chantakorn_property_history_logs';

function getLocalHistoryLogs(): PropertyHistoryLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PROPERTY_HISTORY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function saveLocalHistoryLogs(logs: PropertyHistoryLog[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY_PROPERTY_HISTORY, JSON.stringify(logs));
  } catch {
    // ignore
  }
}

/**
 * Generate sensible initial creation / baseline logs for a property if none exist yet
 */
export function generateInitialHistoryLogs(property: Property): PropertyHistoryLog[] {
  const createdAt = property.created_at || new Date().toISOString();
  const logs: PropertyHistoryLog[] = [
    {
      id: `init_create_${property.id}`,
      property_id: property.id,
      property_title: property.title,
      change_type: 'created',
      new_value: property.price,
      diff_summary: `ลงประกาศทรัพย์ในระบบ ราคาตั้งต้น ${formatPrice(property.price, property.status)}`,
      actor_name: property.agent?.name || 'คุณฉันทากร (ผู้ดูแลระบบ)',
      actor_role: property.agent?.rank || 'ADMIN',
      timestamp: createdAt,
      notes: `ทำเล: ${property.district}, ${property.province} | ประเภท: ${property.property_type}`,
    }
  ];

  // If status is rent
  if (property.status === 'rent') {
    logs.push({
      id: `init_status_${property.id}`,
      property_id: property.id,
      property_title: property.title,
      change_type: 'status_change',
      new_value: 'rent',
      diff_summary: 'กำหนดสถานะทรัพย์เป็น "ให้เช่า"',
      actor_name: property.agent?.name || 'คุณฉันทากร (ผู้ดูแลระบบ)',
      actor_role: property.agent?.rank || 'ADMIN',
      timestamp: new Date(new Date(createdAt).getTime() + 60000).toISOString(),
    });
  }

  // If featured
  if (property.featured) {
    logs.push({
      id: `init_featured_${property.id}`,
      property_id: property.id,
      property_title: property.title,
      change_type: 'featured_change',
      new_value: true,
      diff_summary: 'ปักหมุดเป็น "ทรัพย์เด่น (Featured)" ประจำหน้าแรก',
      actor_name: 'คุณฉันทากร (ผู้ดูแลระบบ)',
      actor_role: 'ADMIN',
      timestamp: new Date(new Date(createdAt).getTime() + 120000).toISOString(),
    });
  }

  return logs;
}

/**
 * Fetch all history logs for a specific property
 */
export async function fetchPropertyHistory(property: Property): Promise<PropertyHistoryLog[]> {
  const propertyId = property.id;
  const initialBaseline = generateInitialHistoryLogs(property);

  if (dataBackend === 'firebase' && db) {
    try {
      const colRef = collection(db, 'property_history');
      const q = query(colRef, where('property_id', '==', propertyId));
      const snap = await getDocs(q);

      const firestoreLogs: PropertyHistoryLog[] = snap.docs.map(docSnap => docSnap.data() as PropertyHistoryLog);

      // Merge firestore logs with local & baseline
      const localLogs = getLocalHistoryLogs().filter(l => l.property_id === propertyId);
      const combinedMap = new Map<string, PropertyHistoryLog>();

      initialBaseline.forEach(l => combinedMap.set(l.id, l));
      localLogs.forEach(l => combinedMap.set(l.id, l));
      firestoreLogs.forEach(l => combinedMap.set(l.id, l));

      const sorted = Array.from(combinedMap.values()).sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return sorted;
    } catch (err) {
      console.warn('Could not fetch from Firestore, using local history cache:', err);
    }
  }

  // Local fallback
  const localLogs = getLocalHistoryLogs().filter(l => l.property_id === propertyId);
  const combinedMap = new Map<string, PropertyHistoryLog>();
  initialBaseline.forEach(l => combinedMap.set(l.id, l));
  localLogs.forEach(l => combinedMap.set(l.id, l));

  return Array.from(combinedMap.values()).sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Record a new history log entry into Firestore and local cache
 */
export async function recordPropertyHistory(
  log: Omit<PropertyHistoryLog, 'id' | 'timestamp' | 'actor_name'> & { 
    id?: string; 
    timestamp?: string;
    actor_name?: string;
  }
): Promise<PropertyHistoryLog> {
  const currentUser = getStoredUser();
  const id = log.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const timestamp = log.timestamp || new Date().toISOString();

  const fullLog: PropertyHistoryLog = {
    id,
    property_id: log.property_id,
    property_title: log.property_title,
    change_type: log.change_type,
    previous_value: log.previous_value !== undefined ? log.previous_value : null,
    new_value: log.new_value !== undefined ? log.new_value : null,
    diff_summary: log.diff_summary,
    actor_name: log.actor_name || currentUser?.full_name || 'คุณฉันทากร (ผู้ดูแลระบบ)',
    actor_email: log.actor_email || currentUser?.email || 'benzttr12@gmail.com',
    actor_role: log.actor_role || currentUser?.role || 'ADMIN',
    timestamp,
    notes: log.notes || '',
  };

  // 1. Save to local cache
  const localLogs = getLocalHistoryLogs();
  const filtered = localLogs.filter(l => l.id !== fullLog.id);
  saveLocalHistoryLogs([fullLog, ...filtered]);

  // 2. Save to Firestore if available
  if (dataBackend === 'firebase' && db) {
    try {
      await setDoc(doc(db, 'property_history', fullLog.id), fullLog);
    } catch (err) {
      console.error('Failed to write history log to Firestore:', err);
    }
  }

  return fullLog;
}

/**
 * Automatically inspect diff between original property and updates, creating respective log entries
 */
export async function logPropertyChanges(
  original: Property, 
  updates: Partial<Property>,
  customActor?: { name?: string; email?: string; role?: string }
) {
  const currentUser = getStoredUser();
  const actorName = customActor?.name || currentUser?.full_name || 'คุณฉันทากร (ผู้ดูแลระบบ)';
  const actorEmail = customActor?.email || currentUser?.email || 'benzttr12@gmail.com';
  const actorRole = customActor?.role || currentUser?.role || 'ADMIN';

  // 1. Price Change
  if (updates.price !== undefined && updates.price !== original.price) {
    const oldP = original.price;
    const newP = updates.price;
    const diff = newP - oldP;
    const percentDiff = oldP > 0 ? ((diff / oldP) * 100).toFixed(1) : '0';
    const direction = diff < 0 ? `ลดราคา ฿${Math.abs(diff).toLocaleString()} (${percentDiff}%)` : `ปรับราคาขึ้น +฿${diff.toLocaleString()} (+${percentDiff}%)`;
    
    await recordPropertyHistory({
      property_id: original.id,
      property_title: original.title,
      change_type: 'price_change',
      previous_value: oldP,
      new_value: newP,
      diff_summary: `ปรับราคาจาก ฿${oldP.toLocaleString()} เป็น ฿${newP.toLocaleString()} (${direction})`,
      actor_name: actorName,
      actor_email: actorEmail,
      actor_role: actorRole,
    });
  }

  // 2. Status Change (Sale / Rent)
  if (updates.status !== undefined && updates.status !== original.status) {
    const oldStatusLabel = original.status === 'rent' ? 'เช่า' : 'ขาย';
    const newStatusLabel = updates.status === 'rent' ? 'เช่า' : 'ขาย';

    await recordPropertyHistory({
      property_id: original.id,
      property_title: original.title,
      change_type: 'status_change',
      previous_value: original.status,
      new_value: updates.status,
      diff_summary: `เปลี่ยนประเภทการขายจาก "${oldStatusLabel}" เป็น "${newStatusLabel}"`,
      actor_name: actorName,
      actor_email: actorEmail,
      actor_role: actorRole,
    });
  }

  // 3. Agent Change
  if (
    (updates.agent !== undefined && updates.agent?.name !== original.agent?.name) ||
    (updates.agent_id !== undefined && updates.agent_id !== original.agent_id)
  ) {
    const oldAgent = original.agent?.name || 'Chantakorn Property';
    const newAgent = updates.agent?.name || 'ผู้ดูแลใหม่';

    await recordPropertyHistory({
      property_id: original.id,
      property_title: original.title,
      change_type: 'agent_change',
      previous_value: oldAgent,
      new_value: newAgent,
      diff_summary: `โอนย้ายนายหน้าผู้ดูแลจาก "${oldAgent}" เป็น "${newAgent}"`,
      actor_name: actorName,
      actor_email: actorEmail,
      actor_role: actorRole,
    });
  }

  // 4. Published Toggle
  if (updates.published !== undefined && updates.published !== original.published) {
    const wasPublished = original.published !== false;
    const nowPublished = updates.published !== false;

    await recordPropertyHistory({
      property_id: original.id,
      property_title: original.title,
      change_type: 'published_change',
      previous_value: wasPublished,
      new_value: nowPublished,
      diff_summary: nowPublished ? 'เผยแพร่ออนไลน์บนเว็บไซต์' : 'เปลี่ยนสถานะเป็นแบบร่าง (ซ่อนจากหน้าเว็บ)',
      actor_name: actorName,
      actor_email: actorEmail,
      actor_role: actorRole,
    });
  }

  // 5. Featured Toggle
  if (updates.featured !== undefined && updates.featured !== original.featured) {
    await recordPropertyHistory({
      property_id: original.id,
      property_title: original.title,
      change_type: 'featured_change',
      previous_value: original.featured,
      new_value: updates.featured,
      diff_summary: updates.featured ? 'ตั้งค่าเป็นทรัพย์เด่น (Featured)' : 'ยกเลิกสถานะทรัพย์เด่น',
      actor_name: actorName,
      actor_email: actorEmail,
      actor_role: actorRole,
    });
  }

  // 6. Title or core details update
  if (updates.title && updates.title !== original.title) {
    await recordPropertyHistory({
      property_id: original.id,
      property_title: updates.title,
      change_type: 'info_update',
      previous_value: original.title,
      new_value: updates.title,
      diff_summary: `แก้ไขชื่อทรัพย์เป็น "${updates.title}"`,
      actor_name: actorName,
      actor_email: actorEmail,
      actor_role: actorRole,
    });
  }
}
