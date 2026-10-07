'use client';

import { auth } from '@/lib/firebase/client';
import { apiUrl } from '@/lib/api-url';
import { dataBackend, isDemoAuthEnabled } from '@/lib/backend';
import { getStoredUser } from '@/lib/auth-helpers';

/** Fetch a staff-only API with a short-lived Firebase ID token (หรือ demo token ในโหมด local). */
export async function fetchStaffApi(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);

  // โหมด local/demo: ใช้เซสชันทดลองจาก localStorage แทน Firebase ID token
  if (dataBackend === 'local' && isDemoAuthEnabled) {
    const user = getStoredUser();
    if (!user || !['ADMIN', 'AGENT'].includes(user.role)) {
      throw new Error('กรุณาเข้าสู่ระบบพนักงานก่อนดำเนินการ');
    }
    const demoToken = `demo ${btoa(`${user.email || 'demo'}|${user.role}`)}`;
    headers.set('Authorization', `Bearer ${demoToken}`);
    const target = typeof input === 'string' ? apiUrl(input) : input;
    return fetch(target, { ...init, headers });
  }

  const user = auth?.currentUser;
  if (!user) throw new Error('กรุณาเข้าสู่ระบบพนักงานก่อนดำเนินการ');

  headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  const target = typeof input === 'string' ? apiUrl(input) : input;
  return fetch(target, { ...init, headers });
}
