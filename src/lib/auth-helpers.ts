import { auth, db, googleProvider } from '@/lib/firebase/client';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
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
let verifiedProfile: UserProfile | null = null;

function validRole(value: unknown): value is UserProfile['role'] {
  return typeof value === 'string' && VALID_ROLES.includes(value as UserProfile['role']);
}

function cacheProfile(profile: UserProfile | null) {
  verifiedProfile = profile;
  if (typeof window === 'undefined') return;
  try {
    if (isDemoAuthEnabled && profile) window.localStorage.setItem('chantakorn_auth_user', JSON.stringify(profile));
    else window.localStorage.removeItem('chantakorn_auth_user');
  } catch {}
}

export function notifyAuthChange(profile: UserProfile | null) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('chantakorn_auth_change', { detail: profile }));
  }
}

export async function syncFirebaseUserProfile(user: User, customFullName?: string, customPhone?: string): Promise<UserProfile> {
  if (dataBackend !== 'firebase' || !db) throw new Error('Firebase profile storage is not configured');
  const email = user.email || '';
  const userDocRef = doc(db, 'profiles', user.uid);
  const snapshot = await getDocFromServer(userDocRef);
  let data: Partial<UserProfile>;
  if (snapshot.exists()) {
    data = snapshot.data() as Partial<UserProfile>;
  } else {
    data = {
      id: user.uid,
      full_name: customFullName || user.displayName || email.split('@')[0] || 'ผู้ใช้งาน',
      email,
      role: 'USER',
      phone: customPhone || user.phoneNumber || '',
      avatar_url: user.photoURL || '',
      created_at: new Date().toISOString(),
    };
    await setDoc(userDocRef, data);
  }
  const profile: UserProfile = {
    ...data,
    id: user.uid,
    email,
    full_name: data.full_name || user.displayName || 'ผู้ใช้งาน',
    role: user.emailVerified && validRole(data.role) ? data.role : 'USER',
    avatar_url: data.avatar_url || user.photoURL || '',
  };
  cacheProfile(profile);
  notifyAuthChange(profile);
  return profile;
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  if (dataBackend === 'firebase' && auth) {
    await auth.authStateReady();
    if (auth.currentUser) return syncFirebaseUserProfile(auth.currentUser);
  } else if (dataBackend === 'supabase' && supabase) {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    const { data, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profileError) throw profileError;
    if (!data || !validRole(data.role)) return null;
    const profile = { ...data, id: user.id, email: user.email } as UserProfile;
    cacheProfile(profile);
    return profile;
  } else if (isDemoAuthEnabled) {
    return getStoredUser();
  }
  cacheProfile(null);
  return null;
}

export async function updateCurrentUserProfile(updates: ProfileUpdates): Promise<UserProfile> {
  const safeUpdates = Object.fromEntries(PROFILE_FIELDS.filter(key => updates[key] !== undefined).map(key => [key, updates[key]])) as ProfileUpdates;
  const current = await getCurrentUserProfile();
  if (!current) throw new Error('กรุณาเข้าสู่ระบบอีกครั้ง');
  const updatedAt = new Date().toISOString();
  let updatedProfile: UserProfile;
  if (dataBackend === 'firebase' && auth?.currentUser && db) {
    await setDoc(doc(db, 'profiles', auth.currentUser.uid), { ...safeUpdates, updated_at: updatedAt }, { merge: true });
    const authUpdates: { displayName?: string; photoURL?: string | null } = {};
    if (safeUpdates.full_name?.trim()) authUpdates.displayName = safeUpdates.full_name.trim().slice(0, 100);
    if (safeUpdates.avatar_url !== undefined) {
      const avatar = safeUpdates.avatar_url.trim();
      if (!avatar) authUpdates.photoURL = null;
      else if (/^https?:\/\//.test(avatar) && avatar.length <= 1500) authUpdates.photoURL = avatar;
    }
    if (Object.keys(authUpdates).length) await updateProfile(auth.currentUser, authUpdates).catch(() => undefined);
    updatedProfile = { ...current, ...safeUpdates, updated_at: updatedAt };
  } else if (dataBackend === 'supabase' && supabase) {
    const { data, error } = await supabase.from('profiles').update({ ...safeUpdates, updated_at: updatedAt }).eq('id', current.id).select('*').single();
    if (error || !data) throw error || new Error('ไม่พบข้อมูลสมาชิก');
    updatedProfile = { ...data, email: current.email } as UserProfile;
  } else if (isDemoAuthEnabled) {
    updatedProfile = { ...current, ...safeUpdates, updated_at: updatedAt };
  } else {
    throw new Error('ระบบสมาชิกยังไม่ได้ตั้งค่า');
  }
  cacheProfile(updatedProfile);
  notifyAuthChange(updatedProfile);
  return updatedProfile;
}

export async function signInWithGoogle(): Promise<UserProfile> {
  if (dataBackend !== 'firebase' || !auth) throw new Error('ระบบ Google Sign-In ยังไม่ได้ตั้งค่า');
  const result = await signInWithPopup(auth, googleProvider);
  return syncFirebaseUserProfile(result.user);
}

export async function loginWithEmail(email: string, password: string): Promise<UserProfile> {
  if (dataBackend !== 'firebase' || !auth) throw new Error('ระบบตรวจสอบสิทธิ์ Firebase ยังไม่พร้อมใช้งาน');
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  return syncFirebaseUserProfile(result.user);
}

export async function registerWithEmail(email: string, password: string, fullName: string, phone: string): Promise<UserProfile> {
  if (dataBackend !== 'firebase' || !auth) throw new Error('ระบบตรวจสอบสิทธิ์ Firebase ยังไม่พร้อมใช้งาน');
  const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const profile = await syncFirebaseUserProfile(result.user, fullName, phone);
  await sendEmailVerification(result.user);
  return profile;
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (dataBackend === 'firebase' && auth) {
    await sendPasswordResetEmail(auth, email.trim());
    return;
  }
  if (dataBackend === 'supabase' && supabase) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) throw error;
    return;
  }
  throw new Error('ระบบกู้คืนรหัสผ่านยังไม่ได้ตั้งค่า กรุณาติดต่อทีมงาน');
}

export async function logoutUser() {
  if (dataBackend === 'firebase' && auth) await firebaseSignOut(auth);
  else if (dataBackend === 'supabase' && supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
  cacheProfile(null);
  notifyAuthChange(null);
}

export function getStoredUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  if (!isDemoAuthEnabled) return verifiedProfile;
  try {
    const stored = window.localStorage.getItem('chantakorn_auth_user');
    if (!stored) return null;
    const profile = JSON.parse(stored) as Partial<UserProfile> | null;
    if (!profile || typeof profile.id !== 'string' || typeof profile.full_name !== 'string' || !validRole(profile.role)) return null;
    return profile as UserProfile;
  } catch {
    return null;
  }
}
