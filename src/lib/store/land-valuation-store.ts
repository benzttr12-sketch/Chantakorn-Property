'use client';

import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { dataBackend } from '@/lib/backend';
import { auth, db } from '@/lib/firebase/client';
import {
  type LandValuationInput,
  validateLandValuation,
} from '@/lib/landsmaps';
import {
  type ParcelBoundaryCollection,
  parseParcelBoundaryFile,
  validateParcelBoundaries,
} from '@/lib/parcel-boundaries';

// Local/demo records are private to this loaded module and disappear on refresh.
// Coordinates and appraisal details never enter browser storage.
const localValuations = new Map<string, LandValuationInput>();
const localBoundaries = new Map<string, ParcelBoundaryCollection>();

function storageKey(
  prefix: 'land_valuation' | 'land_boundaries',
  key: string,
): string {
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(key))
    throw new Error('รหัสรายการประเมินไม่ถูกต้อง');
  return `${prefix}_${key}`;
}

async function requireFirebaseSession() {
  if (!db) throw new Error('ระบบฐานข้อมูล Firebase ยังไม่ได้ตั้งค่า');
  if (!auth)
    throw new Error(
      'กรุณาเข้าสู่ระบบเจ้าหน้าที่ก่อนเข้าถึงรายการประเมิน',
    );
  // A cached admin profile may render before Firebase finishes restoring the session.
  // Wait for restoration rather than treating that temporary state as a signed-out user.
  await auth.authStateReady();
  if (!auth.currentUser)
    throw new Error(
      'กรุณาเข้าสู่ระบบเจ้าหน้าที่ก่อนเข้าถึงรายการประเมิน',
    );
  return { database: db, userId: auth.currentUser.uid };
}

export async function loadLandValuation(
  key: string,
): Promise<LandValuationInput | null> {
  const id = storageKey('land_valuation', key);
  if (dataBackend === 'firebase') {
    const { database } = await requireFirebaseSession();
    // settings is staff-only under Firestore rules. Request the server so cached data
    // from another session cannot substitute for an authorization check.
    const snapshot = await getDocFromServer(doc(database, 'settings', id));
    return snapshot.exists()
      ? validateLandValuation(snapshot.data().input)
      : null;
  }
  if (dataBackend === 'supabase') {
    throw new Error(
      'ยังไม่ได้ตั้งค่าที่เก็บรายการประเมินส่วนตัวสำหรับ Supabase',
    );
  }
  const saved = localValuations.get(id);
  return saved === undefined ? null : validateLandValuation(saved);
}

export async function saveLandValuation(
  key: string,
  input: LandValuationInput,
): Promise<void> {
  const id = storageKey('land_valuation', key);
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
    throw new Error(
      'ยังไม่ได้ตั้งค่าที่เก็บรายการประเมินส่วนตัวสำหรับ Supabase',
    );
  }
  localValuations.set(id, validated);
}

export async function loadLandBoundaries(
  recordId: string,
): Promise<ParcelBoundaryCollection | null> {
  const id = storageKey('land_boundaries', recordId);
  if (dataBackend === 'firebase') {
    const { database } = await requireFirebaseSession();
    const snapshot = await getDocFromServer(doc(database, 'settings', id));
    if (!snapshot.exists()) return null;
    const serialized: unknown = snapshot.data().collection_json;
    if (typeof serialized !== 'string')
      throw new Error('ข้อมูลแนวเขตที่บันทึกไว้ไม่ถูกต้อง');
    return parseParcelBoundaryFile(serialized, 'boundaries.geojson');
  }
  if (dataBackend === 'supabase') {
    throw new Error(
      'ยังไม่ได้ตั้งค่าที่เก็บแนวเขตส่วนตัวสำหรับ Supabase',
    );
  }
  const saved = localBoundaries.get(id);
  return saved === undefined ? null : validateParcelBoundaries(saved);
}

export async function saveLandBoundaries(
  recordId: string,
  collection: ParcelBoundaryCollection,
): Promise<void> {
  const id = storageKey('land_boundaries', recordId);
  // Validation copies geometry, strips unrelated properties and enforces 512 KB.
  const validated = validateParcelBoundaries(collection);
  if (dataBackend === 'firebase') {
    const { database, userId } = await requireFirebaseSession();
    await setDoc(doc(database, 'settings', id), {
      // GeoJSON coordinates contain nested arrays, which Firestore does not support.
      collection_json: JSON.stringify(validated),
      source: 'user_supplied_boundary',
      officialDataFetched: false,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    });
    return;
  }
  if (dataBackend === 'supabase') {
    throw new Error(
      'ยังไม่ได้ตั้งค่าที่เก็บแนวเขตส่วนตัวสำหรับ Supabase',
    );
  }
  localBoundaries.set(id, validated);
}
