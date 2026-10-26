import { auth, db, googleProvider } from '@/lib/firebase/client';
import {
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  User,
} from 'firebase/auth';
import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { dataBackend } from '@/lib/backend';
import { UserProfile } from '@/lib/types';

const VALID_ROLES: UserProfile['role'][] = ['ADMIN', 'AGENT', 'USER'];
const PROFILE_FIELDS = ['full_name', 'phone', 'avatar_url', 'line_id', 'facebook', 'bio'] as const;
type ProfileUpdates = Partial<Pick<UserProfile, (typeof PROFILE_FIELDS)[number]>>;
let verifiedProfile: UserProfile | null = null;
let redirectCompletion: Promise<void> | undefined;
let pendingGoogleSignIn: Promise<UserProfile> | undefined;

/** Read the redirect result once per page load. Firebase restores currentUser;
 * never retain a returned User that could resurrect a session after sign-out. */
function completeGoogleRedirect(): Promise<void> {
  if (!auth) return Promise.resolve();
  return redirectCompletion ||= getRedirectResult(auth).then(() => undefined);
}

function validRole(value: unknown): value is UserProfile['role'] {
  return typeof value === 'string' && VALID_ROLES.includes(value as UserProfile['role']);
}

function cacheProfile(profile: UserProfile | null) {
  verifiedProfile = profile;
  if (typeof window === 'undefined') return;
  try {
    // Browser-stored profiles cannot authorize a staff session.
    window.localStorage.removeItem('chantakorn_auth_user');
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
  const previousProfile = JSON.stringify(verifiedProfile, Object.keys(verifiedProfile || {}).sort());
  const nextProfile = JSON.stringify(profile, Object.keys(profile).sort());
  const profileChanged = previousProfile !== nextProfile;
  cacheProfile(profile);
  if (profileChanged) notifyAuthChange(profile);
  return profile;
}

export async function getCurrentUserProfile(options: { surfaceRedirectError?: boolean } = {}): Promise<UserProfile | null> {
  if (dataBackend === 'firebase' && auth) {
    let redirectFailure: unknown;
    try {
      await completeGoogleRedirect();
    } catch (error) {
      redirectFailure = error;
    }
    await auth.authStateReady();
    if (auth.currentUser) return syncFirebaseUserProfile(auth.currentUser);
    cacheProfile(null);
    if (redirectFailure && options.surfaceRedirectError) throw redirectFailure;
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
  } else {
    throw new Error('ระบบสมาชิกยังไม่ได้ตั้งค่า');
  }
  cacheProfile(updatedProfile);
  notifyAuthChange(updatedProfile);
  return updatedProfile;
}

/** One Firebase flow: popup when available, redirect only when it is blocked.
 * Cancellation, configuration errors and profile failures must never redirect. */
export function signInWithGoogle(): Promise<UserProfile> {
  if (dataBackend !== 'firebase' || !auth)
    return Promise.reject(new Error('ระบบ Google Sign-In ยังไม่ได้ตั้งค่า'));
  if (pendingGoogleSignIn) return pendingGoogleSignIn;
  const currentAuth = auth;
  const signIn = async (): Promise<UserProfile> => {
    let result;
    try {
      result = await signInWithPopup(currentAuth, googleProvider);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment')
        return await signInWithRedirect(currentAuth, googleProvider);
      throw error;
    }
    redirectCompletion = Promise.resolve();
    return syncFirebaseUserProfile(result.user);
  };
  pendingGoogleSignIn = signIn().finally(() => { pendingGoogleSignIn = undefined; });
  return pendingGoogleSignIn;
}

export async function loginWithEmail(email: string, password: string): Promise<UserProfile> {
  if (dataBackend !== 'firebase' || !auth) throw new Error('กรุณาตั้งค่า Firebase เพื่อเข้าสู่ระบบสมาชิก');
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  return syncFirebaseUserProfile(result.user);
}

export async function registerWithEmail(email: string, password: string, fullName: string, phone: string): Promise<UserProfile> {
  if (dataBackend !== 'firebase' || !auth) throw new Error('กรุณาตั้งค่า Firebase เพื่อสมัครสมาชิก');
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
  throw new Error('กรุณาตั้งค่า Firebase เพื่อกู้คืนรหัสผ่าน');
}

export async function logoutUser() {
  if (dataBackend === 'firebase' && auth) await firebaseSignOut(auth);
  cacheProfile(null);
  notifyAuthChange(null);
}

export function getStoredUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  return verifiedProfile;
}
