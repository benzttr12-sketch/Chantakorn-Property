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
let verifiedProfileUser: User | null = null;
let sessionGeneration = 0;
let pendingSignOuts = 0;
let redirectCompletion: Promise<void> | undefined;
let pendingGoogleSignIn: Promise<UserProfile> | undefined;
type CredentialAttempt = { generation: number };
const credentialAttempts = new Set<CredentialAttempt>();
const rejectedCredentialUsers = new WeakSet<User>();

/** Read the redirect result once per page load. Firebase restores currentUser;
 * never retain a returned User that could resurrect a session after sign-out. */
function completeGoogleRedirect(): Promise<void> {
  if (!auth) return Promise.resolve();
  return redirectCompletion ||= getRedirectResult(auth).then(() => undefined);
}

function validRole(value: unknown): value is UserProfile['role'] {
  return typeof value === 'string' && VALID_ROLES.includes(value as UserProfile['role']);
}

function cacheProfile(profile: UserProfile | null, user: User | null = null) {
  verifiedProfile = profile;
  verifiedProfileUser = user;
  if (typeof window === 'undefined') return;
  try {
    // Browser-stored profiles cannot authorize a staff session.
    window.localStorage.removeItem('chantakorn_auth_user');
  } catch {}
}

function sessionChangedError() {
  return Object.assign(new Error('บัญชีเข้าสู่ระบบเปลี่ยนแล้ว กรุณาลองใหม่ด้วยบัญชีปัจจุบัน'), { code: 'auth/session-changed' });
}

function hasInvalidatedCredentialAttempt() {
  return Array.from(credentialAttempts).some(attempt => attempt.generation !== sessionGeneration);
}

function assertSessionGeneration(generation: number) {
  if (pendingSignOuts || generation !== sessionGeneration || hasInvalidatedCredentialAttempt()) {
    throw sessionChangedError();
  }
}

function assertCurrentSession(user: User, generation: number) {
  assertSessionGeneration(generation);
  if (auth?.currentUser !== user || rejectedCredentialUsers.has(user)) throw sessionChangedError();
}

function beginCredentialAttempt(): CredentialAttempt {
  assertSessionGeneration(sessionGeneration);
  const attempt = { generation: sessionGeneration };
  credentialAttempts.add(attempt);
  return attempt;
}

async function acceptCredentialUser(user: User, attempt: CredentialAttempt) {
  if (pendingSignOuts || attempt.generation !== sessionGeneration) {
    // Firebase may install a credential after signOut has already completed.
    // Keep observers blocked until that obsolete result has been discarded.
    rejectedCredentialUsers.add(user);
    if (auth?.currentUser === user) {
      cacheProfile(null);
      try { await firebaseSignOut(auth); } catch {
        // Failed disposal must not make this User eligible for profile reads.
      }
    }
    throw sessionChangedError();
  }
  // A fresh explicit credential can recover even if Firebase reused its User.
  rejectedCredentialUsers.delete(user);
  assertCurrentSession(user, attempt.generation);
}

export function notifyAuthChange(profile: UserProfile | null) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('chantakorn_auth_change', { detail: profile }));
  }
}

export async function syncFirebaseUserProfile(user: User, customFullName?: string, customPhone?: string): Promise<UserProfile> {
  if (dataBackend !== 'firebase' || !db) throw new Error('Firebase profile storage is not configured');
  const generation = sessionGeneration;
  assertCurrentSession(user, generation);
  const email = user.email || '';
  const userDocRef = doc(db, 'profiles', user.uid);
  const snapshot = await getDocFromServer(userDocRef);
  assertCurrentSession(user, generation);
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
    assertCurrentSession(user, generation);
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
  cacheProfile(profile, user);
  if (profileChanged) notifyAuthChange(profile);
  return profile;
}

export async function getCurrentUserProfile(options: { surfaceRedirectError?: boolean } = {}): Promise<UserProfile | null> {
  if (pendingSignOuts || hasInvalidatedCredentialAttempt()) return null;
  const generation = sessionGeneration;
  if (dataBackend === 'firebase' && auth) {
    let redirectFailure: unknown;
    try {
      await completeGoogleRedirect();
    } catch (error) {
      redirectFailure = error;
    }
    await auth.authStateReady();
    assertSessionGeneration(generation);
    if (auth.currentUser && rejectedCredentialUsers.has(auth.currentUser)) {
      cacheProfile(null);
      return null;
    }
    if (auth.currentUser) return syncFirebaseUserProfile(auth.currentUser);
    cacheProfile(null);
    if (redirectFailure && options.surfaceRedirectError) throw redirectFailure;
  }
  cacheProfile(null);
  return null;
}

export async function updateCurrentUserProfile(updates: ProfileUpdates): Promise<UserProfile> {
  const generation = sessionGeneration;
  const safeUpdates = Object.fromEntries(PROFILE_FIELDS.filter(key => updates[key] !== undefined).map(key => [key, updates[key]])) as ProfileUpdates;
  const current = await getCurrentUserProfile();
  if (!current) throw new Error('กรุณาเข้าสู่ระบบอีกครั้ง');
  const updatedAt = new Date().toISOString();
  let updatedProfile: UserProfile;
  if (dataBackend === 'firebase' && auth?.currentUser && db) {
    const user = auth.currentUser;
    if (user.uid !== current.id) throw sessionChangedError();
    assertCurrentSession(user, generation);
    await setDoc(doc(db, 'profiles', user.uid), { ...safeUpdates, updated_at: updatedAt }, { merge: true });
    assertCurrentSession(user, generation);
    const authUpdates: { displayName?: string; photoURL?: string | null } = {};
    if (safeUpdates.full_name?.trim()) authUpdates.displayName = safeUpdates.full_name.trim().slice(0, 100);
    if (safeUpdates.avatar_url !== undefined) {
      const avatar = safeUpdates.avatar_url.trim();
      if (!avatar) authUpdates.photoURL = null;
      else if (/^https?:\/\//.test(avatar) && avatar.length <= 1500) authUpdates.photoURL = avatar;
    }
    if (Object.keys(authUpdates).length) await updateProfile(user, authUpdates).catch(() => undefined);
    assertCurrentSession(user, generation);
    updatedProfile = { ...current, ...safeUpdates, updated_at: updatedAt };
    cacheProfile(updatedProfile, user);
  } else {
    throw new Error('ระบบสมาชิกยังไม่ได้ตั้งค่า');
  }
  notifyAuthChange(updatedProfile);
  return updatedProfile;
}

/** One Firebase flow: popup when available, redirect only when it is blocked.
 * Cancellation, configuration errors and profile failures must never redirect. */
export function signInWithGoogle(): Promise<UserProfile> {
  if (dataBackend !== 'firebase' || !auth)
    return Promise.reject(new Error('ระบบ Google Sign-In ยังไม่ได้ตั้งค่า'));
  if (pendingSignOuts || hasInvalidatedCredentialAttempt()) return Promise.reject(sessionChangedError());
  if (pendingGoogleSignIn) return pendingGoogleSignIn;
  const attempt = beginCredentialAttempt();
  const generation = attempt.generation;
  const currentAuth = auth;
  const signIn = async (): Promise<UserProfile> => {
    try {
      let result;
      try {
        result = await signInWithPopup(currentAuth, googleProvider);
      } catch (error) {
        assertSessionGeneration(generation);
        const code = (error as { code?: string })?.code;
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment')
          return await signInWithRedirect(currentAuth, googleProvider);
        throw error;
      }
      await acceptCredentialUser(result.user, attempt);
      redirectCompletion = Promise.resolve();
      return await syncFirebaseUserProfile(result.user);
    } finally {
      credentialAttempts.delete(attempt);
    }
  };
  pendingGoogleSignIn = signIn().finally(() => { pendingGoogleSignIn = undefined; });
  return pendingGoogleSignIn;
}

export async function loginWithEmail(email: string, password: string): Promise<UserProfile> {
  if (dataBackend !== 'firebase' || !auth) throw new Error('กรุณาตั้งค่า Firebase เพื่อเข้าสู่ระบบสมาชิก');
  const attempt = beginCredentialAttempt();
  try {
    const result = await signInWithEmailAndPassword(auth, email.trim(), password);
    await acceptCredentialUser(result.user, attempt);
    return await syncFirebaseUserProfile(result.user);
  } finally {
    credentialAttempts.delete(attempt);
  }
}

export async function registerWithEmail(email: string, password: string, fullName: string, phone: string): Promise<UserProfile> {
  if (dataBackend !== 'firebase' || !auth) throw new Error('กรุณาตั้งค่า Firebase เพื่อสมัครสมาชิก');
  const attempt = beginCredentialAttempt();
  try {
    const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await acceptCredentialUser(result.user, attempt);
    const profile = await syncFirebaseUserProfile(result.user, fullName, phone);
    assertCurrentSession(result.user, attempt.generation);
    await sendEmailVerification(result.user);
    assertCurrentSession(result.user, attempt.generation);
    return profile;
  } finally {
    credentialAttempts.delete(attempt);
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (dataBackend === 'firebase' && auth) {
    await sendPasswordResetEmail(auth, email.trim());
    return;
  }
  throw new Error('กรุณาตั้งค่า Firebase เพื่อกู้คืนรหัสผ่าน');
}

export async function logoutUser() {
  // Invalidate in-flight profile work before Firebase's asynchronous sign-out.
  // A failed sign-out requires a fresh check; never revive the previous cache.
  sessionGeneration += 1;
  pendingSignOuts += 1;
  cacheProfile(null);
  notifyAuthChange(null);
  try {
    if (dataBackend === 'firebase' && auth) await firebaseSignOut(auth);
  } finally {
    pendingSignOuts -= 1;
  }
}

export function getStoredUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  if (pendingSignOuts || hasInvalidatedCredentialAttempt() || !auth?.currentUser
    || rejectedCredentialUsers.has(auth.currentUser) || verifiedProfileUser !== auth.currentUser) {
    cacheProfile(null);
    return null;
  }
  return verifiedProfile;
}
