import { auth, db, googleProvider } from '@/lib/firebase/client';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  User,
} from 'firebase/auth';
import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { supabase } from '@/lib/supabase/client';
import { dataBackend, isDemoAuthEnabled } from '@/lib/backend';
import { UserProfile } from '@/lib/types';

const VALID_ROLES: UserProfile['role'][] = ['ADMIN', 'AGENT', 'USER'];
const PROFILE_FIELDS = ['full_name', 'phone', 'avatar_url', 'line_id', 'facebook', 'bio'] as const;

type ProfileUpdates = Partial<Pick<UserProfile, (typeof PROFILE_FIELDS)[number]>>;

function validRole(value: unknown): value is UserProfile['role'] {
  return typeof value === 'string' && VALID_ROLES.includes(value as UserProfile['role']);
}

function demoCacheProfile(profile: UserProfile | null) {
  if (typeof window === 'undefined' || !isDemoAuthEnabled) return;
  if (profile) localStorage.setItem('chantakorn_auth_user', JSON.stringify(profile));
  else localStorage.removeItem('chantakorn_auth_user');
}

export function notifyAuthChange(profile: UserProfile | null) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('chantakorn_auth_change', { detail: profile }));
  }
}

export async function syncFirebaseUserProfile(
  user: User,
  customFullName?: string,
  customPhone?: string,
): Promise<UserProfile> {
  if (dataBackend !== 'firebase' || !db) {
    throw new Error('Firebase profile storage is not configured');
  }

  const email = user.email || '';
  const isDefaultAdmin = email.toLowerCase() === 'benzttr12@gmail.com';
  const userDocRef = doc(db, 'profiles', user.uid);
  const snap = await getDocFromServer(userDocRef);
  let data: Partial<UserProfile> = {};

  if (snap.exists()) {
    data = snap.data() as Partial<UserProfile>;
    if (isDefaultAdmin && data.role !== 'ADMIN') {
      data.role = 'ADMIN';
      await setDoc(userDocRef, { role: 'ADMIN' }, { merge: true });
    }
  } else {
    data = {
      id: user.uid,
      full_name: customFullName || user.displayName || (isDefaultAdmin ? 'คุณฉันทากร (ผู้ดูแลระบบ)' : email.split('@')[0]) || 'ผู้ใช้งาน',
      email,
      role: isDefaultAdmin ? 'ADMIN' : 'USER',
      phone: customPhone || user.phoneNumber || (isDefaultAdmin ? '081-604-0097' : ''),
      avatar_url: user.photoURL || '',
      line_id: isDefaultAdmin ? '@chantakorn' : '',
      facebook: isDefaultAdmin ? 'https://www.facebook.com/chantakornproperty' : '',
      created_at: new Date().toISOString(),
    };
    await setDoc(userDocRef, data);
  }

  const profile: UserProfile = {
    id: user.uid,
    full_name: data.full_name || customFullName || user.displayName || email.split('@')[0] || 'ผู้ใช้งาน',
    email,
    role: isDefaultAdmin ? 'ADMIN' : (validRole(data.role) ? data.role : 'USER'),
    phone: data.phone || customPhone || user.phoneNumber || '',
    avatar_url: data.avatar_url || user.photoURL || '',
    line_id: data.line_id || '',
    facebook: data.facebook || '',
    bio: data.bio || '',
    created_at: data.created_at,
    updated_at: data.updated_at,
  };

  // Display state may use this event, but authorization always checks Firestore.
  notifyAuthChange(profile);
  return profile;
}

export async function updateCurrentUserProfile(updates: ProfileUpdates): Promise<UserProfile> {
  let updatedProfile: UserProfile;

  if (dataBackend === 'firebase') {
    if (!auth?.currentUser || !db) throw new Error('กรุณาเข้าสู่ระบบอีกครั้ง');

    const current = await syncFirebaseUserProfile(auth.currentUser);
    await updateProfile(auth.currentUser, {
      displayName: updates.full_name ?? auth.currentUser.displayName,
      photoURL: updates.avatar_url ?? auth.currentUser.photoURL,
    });

    const safeUpdates = Object.fromEntries(
      PROFILE_FIELDS
        .filter((key) => updates[key] !== undefined)
        .map((key) => [key, updates[key]]),
    ) as ProfileUpdates;
    const updatedAt = new Date().toISOString();
    await setDoc(
      doc(db, 'profiles', auth.currentUser.uid),
      { ...safeUpdates, updated_at: updatedAt },
      { merge: true },
    );
    updatedProfile = { ...current, ...safeUpdates, updated_at: updatedAt };
  } else if (dataBackend === 'supabase' && supabase) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw authError || new Error('กรุณาเข้าสู่ระบบอีกครั้ง');

    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', authData.user.id)
      .select('*')
      .single();
    if (error || !data || !validRole(data.role)) throw error || new Error('ไม่พบข้อมูลสมาชิก');
    updatedProfile = { ...data, email: authData.user.email } as UserProfile;
  } else if (isDemoAuthEnabled) {
    const current = getStoredUser();
    if (!current) throw new Error('กรุณาเข้าสู่ระบบทดลองอีกครั้ง');
    updatedProfile = { ...current, ...updates, updated_at: new Date().toISOString() };
    demoCacheProfile(updatedProfile);
  } else {
    throw new Error('ระบบสมาชิกยังไม่ได้ตั้งค่า');
  }

  notifyAuthChange(updatedProfile);
  return updatedProfile;
}

export async function signInWithGoogle(): Promise<UserProfile> {
  if (dataBackend !== 'firebase' || !auth) {
    throw new Error('Firebase Auth is not configured for this backend');
  }
  const result = await signInWithPopup(auth, googleProvider);
  return syncFirebaseUserProfile(result.user);
}

export async function loginWithEmail(email: string, pass: string): Promise<UserProfile> {
  if (dataBackend !== 'firebase' || !auth) {
    throw new Error('ระบบตรวจสอบสิทธิ์ Firebase ยังไม่พร้อมใช้งาน');
  }
  const result = await signInWithEmailAndPassword(auth, email, pass);
  return syncFirebaseUserProfile(result.user);
}

export async function registerWithEmail(
  email: string,
  pass: string,
  fullName: string,
  phone: string,
): Promise<UserProfile> {
  if (dataBackend !== 'firebase' || !auth) {
    throw new Error('ระบบตรวจสอบสิทธิ์ Firebase ยังไม่พร้อมใช้งาน');
  }
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  return syncFirebaseUserProfile(result.user, fullName, phone);
}

export async function logoutUser() {
  if (dataBackend === 'firebase' && auth) {
    await firebaseSignOut(auth).catch(() => undefined);
  } else if (dataBackend === 'supabase' && supabase) {
    await supabase.auth.signOut();
  }
  demoCacheProfile(null);
  notifyAuthChange(null);
}

export function getStoredUser(): UserProfile | null {
  if (typeof window === 'undefined' || !isDemoAuthEnabled) return null;
  const stored = localStorage.getItem('chantakorn_auth_user');
  if (!stored) return null;
  try {
    const profile = JSON.parse(stored) as Partial<UserProfile>;
    if (
      typeof profile.id !== 'string' ||
      typeof profile.full_name !== 'string' ||
      !validRole(profile.role)
    ) return null;
    return profile as UserProfile;
  } catch {
    return null;
  }
}
