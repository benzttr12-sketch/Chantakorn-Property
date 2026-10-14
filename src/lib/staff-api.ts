'use client';

import { auth } from '@/lib/firebase/client';
import { apiUrl } from '@/lib/api-url';
import { dataBackend } from '@/lib/backend';

/** Fetch a staff-only API with a short-lived Firebase ID token. */
export async function fetchStaffApi(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (dataBackend !== 'firebase' || !auth) throw new Error('กรุณาตั้งค่า Firebase เพื่อเข้าสู่ระบบพนักงาน');
  await auth.authStateReady();
  const user = auth?.currentUser;
  if (!user) throw new Error('กรุณาเข้าสู่ระบบพนักงานก่อนดำเนินการ');

  headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  const target = typeof input === 'string' ? apiUrl(input) : input;
  return fetch(target, { ...init, headers });
}
