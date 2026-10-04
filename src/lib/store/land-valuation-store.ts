'use client';

import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { dataBackend } from '@/lib/backend';
import { auth, db } from '@/lib/firebase/client';
import { type LandValuationInput, validateLandValuation } from '@/lib/landsmaps';

function storageKey(key: string): string {
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(key)) throw new Error('รหัสรายการประเมินไม่ถูกต้อง');
  return `land_valuation_${key}`;
}

async function requireFirebaseSession() {
  if (!db) throw new Error('ระบบฐานข้อมูล Firebase ยังไม่ได้ตั้งค่า');
  if (!auth) throw new Error('กรุณาเข้าสู่ระบบเจ้าหน้าที่ก่อนเข้าถึงรายการประเมิน');
  // A cached admin profile may render before Firebase finishes restoring the session.
  // Wait for restoration rather than treating that temporary state as a signed-out user.
  await auth.authStateReady();
  if (!auth.currentUser) throw new Error('กรุณาเข้าสู่ระบบเจ้าหน้าที่ก่อนเข้าถึงรายการประเมิน');
  return { database: db, userId: auth.currentUser.uid };
}

export async function loadLandValuation(key: string): Promise<LandValuationInput | null> {
  const id = storageKey(key);
  if (dataBackend === 'firebase') {
    const { database } = await requireFirebaseSession();
    // settings is staff-only under Firestore rules. Request the server so cached data
    // from another session cannot substitute for an authorization check.
    const snapshot = await getDocFromServer(doc(database, 'settings', id));
    return snapshot.exists() ? validateLandValuation(snapshot.data().input) : null;
  }
  if (dataBackend === 'supabase') {
    throw new Error('ยังไม่ได้ตั้งค่าที่เก็บรายการประเมินส่วนตัวสำหรับ Supabase');
  }
  if (typeof window === 'undefined') throw new Error('ที่เก็บรายการประเมินในเครื่องใช้ได้เฉพาะเบราว์เซอร์นี้');
  const saved = window.localStorage.getItem(`chantakorn_${id}`);
  return saved === null ? null : validateLandValuation(JSON.parse(saved));
}

export async function saveLandValuation(key: string, input: LandValuationInput): Promise<void> {
  const id = storageKey(key);
  const validated = validateLandValuation(input);
  if (dataBackend === 'firebase') {
    const { database, userId } = await requireFirebaseSession();
    await setDoc(doc(database, 'settings', id), {
      input: validated,
      source: 'manual_official_lookup',
      officialDataFetched: false,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    });
    return;
  }
  if (dataBackend === 'supabase') {
    throw new Error('ยังไม่ได้ตั้งค่าที่เก็บรายการประเมินส่วนตัวสำหรับ Supabase');
  }
  if (typeof window === 'undefined') throw new Error('ที่เก็บรายการประเมินในเครื่องใช้ได้เฉพาะเบราว์เซอร์นี้');
  // Explicit demo/local backend only; production never silently falls back to this.
  window.localStorage.setItem(`chantakorn_${id}`, JSON.stringify(validated));
}
