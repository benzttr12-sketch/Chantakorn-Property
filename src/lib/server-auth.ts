import { jsonResponse } from '@/lib/api-response';
import appletConfig from '../../firebase-applet-config.json';


type FirebaseLookupResponse = {
  users?: Array<{
    localId?: string;
    email?: string;
    emailVerified?: boolean;
    disabled?: boolean;
  }>;
};

type FirestoreProfileResponse = {
  fields?: {
    role?: { stringValue?: string };
  };
};

/** Verify the caller's Firebase ID token and server-controlled staff role. */
export async function requireStaff(req: Request): Promise<Response | null> {
  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return jsonResponse({ error: 'กรุณาเข้าสู่ระบบพนักงาน' }, { status: 401 });
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || appletConfig.apiKey;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || appletConfig.projectId;
  if (!apiKey || !projectId) {
    return jsonResponse({ error: 'ระบบยืนยันตัวตนยังไม่ได้ตั้งค่า' }, { status: 503 });
  }

  try {
    const lookupResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!lookupResponse.ok) {
      return jsonResponse({ error: 'เซสชันหมดอายุหรือไม่ถูกต้อง' }, { status: 401 });
    }

    const lookup = (await lookupResponse.json()) as FirebaseLookupResponse;
    const user = lookup.users?.[0];
    if (!user?.localId || !user.emailVerified || user.disabled) {
      return jsonResponse({ error: 'บัญชีนี้ไม่มีสิทธิ์เข้าถึง API' }, { status: 403 });
    }

    const databaseId = appletConfig.firestoreDatabaseId || '(default)';
    const profileResponse = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents/profiles/${encodeURIComponent(user.localId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!profileResponse.ok) {
      return jsonResponse({ error: 'ไม่พบสิทธิ์พนักงานในโปรไฟล์' }, { status: 403 });
    }

    const profile = (await profileResponse.json()) as FirestoreProfileResponse;
    const role = profile.fields?.role?.stringValue;
    if (role !== 'ADMIN' && role !== 'AGENT') {
      return jsonResponse({ error: 'บัญชีนี้ไม่มีสิทธิ์เข้าถึง API' }, { status: 403 });
    }

    return null;
  } catch (error) {
    console.error('Could not verify staff identity:', error);
    return jsonResponse({ error: 'ยืนยันตัวตนไม่สำเร็จ กรุณาลองอีกครั้ง' }, { status: 503 });
  }
}
