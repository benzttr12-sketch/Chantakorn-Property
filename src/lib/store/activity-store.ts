'use client';

import { SystemActivity } from '@/lib/types';
import { db } from '@/lib/firebase/client';
import { dataBackend } from '@/lib/backend';
import { getStoredUser } from '@/lib/auth-helpers';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';

export async function fetchSystemActivities(maxCount = 20): Promise<SystemActivity[]> {
  if (dataBackend === 'local') return [];
  if (!db) throw new Error('ระบบฐานข้อมูลประวัติกิจกรรมยังไม่ได้ตั้งค่า');
  const q = query(
    collection(db, 'system_activities'),
    orderBy('created_at', 'desc'),
    limit(maxCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => docSnap.data() as SystemActivity);
}

export async function logSystemActivity(
  activity: Omit<SystemActivity, 'id' | 'created_at'>
): Promise<SystemActivity> {
  const currentUser = getStoredUser();
  const id = `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const created_at = new Date().toISOString();

  const newActivity: SystemActivity = {
    ...activity,
    id,
    actor_name: activity.actor_name || currentUser?.full_name || 'ผู้ดูแลระบบ',
    actor_email: activity.actor_email || currentUser?.email || undefined,
    actor_role: activity.actor_role || currentUser?.role || 'ADMIN',
    created_at,
  };

  try {
    if (db) {
      await setDoc(doc(db, 'system_activities', id), newActivity);
    }
  } catch (err) {
    console.error('Failed to log system activity to Firestore:', err);
  }

  return newActivity;
}
