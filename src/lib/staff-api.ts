'use client';

import { auth } from '@/lib/firebase/client';
import { apiUrl } from '@/lib/api-url';

/** Fetch a staff-only API with a short-lived Firebase ID token. */
export async function fetchStaffApi(input: RequestInfo | URL, init: RequestInit = {}) {
  const user = auth?.currentUser;
  if (!user) throw new Error('กรุณาเข้าสู่ระบบพนักงานก่อนดำเนินการ');

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  const target = typeof input === 'string' ? apiUrl(input) : input;
  return fetch(target, { ...init, headers });
}
