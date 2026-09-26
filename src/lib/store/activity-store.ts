'use client';

import { SystemActivity } from '@/lib/types';
import { db } from '@/lib/firebase/client';
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

const SAMPLE_ACTIVITIES: SystemActivity[] = [
  {
    id: 'act-1',
    category: 'property',
    action: 'property_created',
    title: 'ลงประกาศอสังหาริมทรัพย์ใหม่',
    description: 'เพิ่มทรัพย์ใหม่ "บ้านเดี่ยว 2 ชั้น คอหงส์ หาดใหญ่" มูลค่า ฿4,500,000 เข้าสู่ระบบ',
    target_id: 'prop-1',
    target_name: 'บ้านเดี่ยว 2 ชั้น คอหงส์ หาดใหญ่',
    actor_name: 'คุณจันทรกร (Admin)',
    actor_email: 'admin@chantakorn.com',
    actor_role: 'ADMIN',
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: 'act-2',
    category: 'inquiry',
    action: 'inquiry_status_updated',
    title: 'อัปเดตสถานะการติดต่อลูกค้า',
    description: 'เปลี่ยนสถานะลูกค้า "คุณสมชาย ใจดี" เป็น [ติดต่อแล้ว - นัดชมบ้านพรุ่งนี้]',
    target_id: 'inq-101',
    target_name: 'คุณสมชาย ใจดี',
    actor_name: 'คุณพิชชา (Agent)',
    actor_email: 'pitcha@chantakorn.com',
    actor_role: 'AGENT',
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'act-3',
    category: 'user_role',
    action: 'user_role_updated',
    title: 'ปรับเปลี่ยนบทบาทสมาชิก',
    description: 'ยกระดับสิทธิ์ผู้ใช้งาน "คุณธนกฤต" จาก [USER] เป็น [AGENT (นายหน้า)]',
    target_id: 'usr-202',
    target_name: 'คุณธนกฤต',
    actor_name: 'คุณจันทรกร (Admin)',
    actor_email: 'admin@chantakorn.com',
    actor_role: 'ADMIN',
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: 'act-4',
    category: 'property',
    action: 'price_updated',
    title: 'ปรับเปลี่ยนราคาทรัพย์',
    description: 'ปรับลดราคา "คอนโดมิเนียมใจกลางเมืองหาดใหญ่" จาก ฿2,200,000 เหลือ ฿1,980,000',
    target_id: 'prop-3',
    target_name: 'คอนโดมิเนียมใจกลางเมืองหาดใหญ่',
    actor_name: 'คุณพงศกร (Agent)',
    actor_email: 'pongsakorn@chantakorn.com',
    actor_role: 'AGENT',
    created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
  },
  {
    id: 'act-5',
    category: 'system',
    action: 'landsmaps_synced',
    title: 'เชื่อมโยงข้อมูลรูปแปลง LandsMaps',
    description: 'ตรวจสอบพิกัด GPS และรูปแปลงโฉนดกรมที่ดินสำเร็จสำหรับทรัพย์ #CK-8821',
    target_id: 'prop-2',
    target_name: 'ที่ดินเปล่า 100 ตร.วา ควนลัง',
    actor_name: 'ระบบอัตโนมัติ (DOL Bot)',
    actor_role: 'SYSTEM',
    created_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
  }
];

export async function fetchSystemActivities(maxCount = 20): Promise<SystemActivity[]> {
  try {
    if (db) {
      const q = query(
        collection(db, 'system_activities'),
        orderBy('created_at', 'desc'),
        limit(maxCount)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return snapshot.docs.map(docSnap => docSnap.data() as SystemActivity);
      }
    }
  } catch (err) {
    console.warn('Failed to fetch system activities from Firestore, using memory store:', err);
  }

  // Fallback / Initial seed
  return SAMPLE_ACTIVITIES;
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

  // Add to local array for instant responsiveness
  SAMPLE_ACTIVITIES.unshift(newActivity);

  try {
    if (db) {
      await setDoc(doc(db, 'system_activities', id), newActivity);
    }
  } catch (err) {
    console.error('Failed to log system activity to Firestore:', err);
  }

  return newActivity;
}
