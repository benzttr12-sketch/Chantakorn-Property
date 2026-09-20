import { auth, db, googleProvider } from '@/lib/firebase/client';
import { dataBackend } from '@/lib/backend';
import { signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDocFromServer, runTransaction, updateDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';

function asProfile(id: string, value: unknown): UserProfile {
  const profile = value as UserProfile;
  if (!profile || !['ADMIN', 'AGENT', 'USER'].includes(profile.role) || typeof profile.full_name !== 'string') {
    throw new Error('ข้อมูลบัญชีไม่สมบูรณ์ กรุณาติดต่อผู้ดูแลระบบ');
  }
  return { ...profile, id };
}

export async function syncFirebaseUserProfile(user: User, fullName?: string, phone?: string): Promise<UserProfile> {
  if (!db) throw new Error('ยังไม่ได้ตั้งค่าฐานข้อมูล');
  const reference = doc(db, 'profiles', user.uid);
  // Only a trusted server may assign staff roles. Email domains grant no privileges.
  await runTransaction(db, async transaction => {
    const existing = await transaction.get(reference);
    if (!existing.exists()) {
      transaction.set(reference, {
        id: user.uid, full_name: fullName || user.displayName || 'สมาชิก',
        email: user.email || '', role: 'USER', phone: phone || '',
        avatar_url: user.photoURL || '', line_id: '', bio: '',
        created_at: new Date().toISOString(),
      });
    }
  });
  if (fullName !== undefined || phone !== undefined) {
    await updateDoc(reference, {
      ...(fullName !== undefined ? { full_name: fullName } : {}),
      ...(phone !== undefined ? { phone } : {}),
      updated_at: new Date().toISOString(),
    });
  }
  return asProfile(user.uid, (await getDocFromServer(reference)).data());
}

// Role changes and deleted profiles must immediately close staff screens. Never
// authenticate from localStorage or accept profile roles supplied by UI events.
export function subscribeToUserProfile(next: (profile: UserProfile | null) => void, fail: (error: Error) => void = () => {}) {
  let active = true;
  let generation = 0;
  let stopProfile = () => {};
  const emit = (profile: UserProfile | null) => { if (active) next(profile); };
  const reject = (error: unknown) => { emit(null); if (active) fail(error instanceof Error ? error : new Error('ตรวจสอบบัญชีไม่สำเร็จ')); };
  if (typeof window !== 'undefined') {
    try { window.localStorage.removeItem('chantakorn_auth_user'); } catch { /* Storage is optional. */ }
  }
  if (dataBackend === 'firebase' && auth && db) {
    const database = db;
    const stopAuth = onAuthStateChanged(auth, user => {
      generation++;
      const currentGeneration = generation;
      stopProfile();
      emit(null);
      if (!user) return;
      stopProfile = onSnapshot(doc(database, 'profiles', user.uid), snapshot => {
        if (currentGeneration !== generation || !active) return;
        try { emit(snapshot.exists() ? asProfile(user.uid, snapshot.data()) : null); }
        catch (error) { reject(error); }
      }, reject);
    }, reject);
    return () => { active = false; generation++; stopAuth(); stopProfile(); };
  }
  queueMicrotask(() => emit(null));
  return () => { active = false; };
}

export async function updateCurrentUserProfile(updates: Pick<UserProfile, 'full_name' | 'phone' | 'avatar_url' | 'line_id' | 'bio'>): Promise<UserProfile> {
  const fields = {
    full_name: updates.full_name.trim(), phone: updates.phone?.trim() || '',
    avatar_url: updates.avatar_url?.trim() || '', line_id: updates.line_id?.trim() || '', bio: updates.bio?.trim() || '',
  };
  if (!fields.full_name || fields.full_name.length > 120 || fields.phone.length > 30 || fields.line_id.length > 100 || fields.bio.length > 2000) {
    throw new Error('กรุณาตรวจสอบความยาวข้อมูลโปรไฟล์');
  }
  if (fields.avatar_url && !fields.avatar_url.startsWith('https://') && !(process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true' && fields.avatar_url.startsWith('http://127.0.0.1:9199/'))) {
    throw new Error('กรุณาอัปโหลดรูปโปรไฟล์ก่อนบันทึก');
  }
  if (!auth || !db) throw new Error('ระบบบัญชียังไม่พร้อมใช้งาน');
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('กรุณาเข้าสู่ระบบใหม่');
  // Firestore is the canonical profile; failures must reach the form.
  const reference = doc(db, 'profiles', user.uid);
  await updateDoc(reference, { ...fields, updated_at: new Date().toISOString() });
  return asProfile(user.uid, (await getDocFromServer(reference)).data());
}

export async function signInWithGoogle(): Promise<UserProfile> {
  if (dataBackend !== 'firebase' || !auth) throw new Error('ยังไม่ได้เปิดใช้งาน Google Sign-in');
  const result = await signInWithPopup(auth, googleProvider);
  return syncFirebaseUserProfile(result.user);
}
export async function loginWithEmail(email: string, password: string): Promise<UserProfile> {
  if (dataBackend !== 'firebase' || !auth) throw new Error('ระบบตรวจสอบสิทธิ์ยังไม่พร้อมใช้งาน');
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  return syncFirebaseUserProfile(result.user);
}
export async function registerWithEmail(email: string, password: string, fullName: string, phone: string): Promise<UserProfile> {
  if (dataBackend !== 'firebase' || !auth) throw new Error('ระบบตรวจสอบสิทธิ์ยังไม่พร้อมใช้งาน');
  const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(result.user, { displayName: fullName.trim() });
  return syncFirebaseUserProfile(result.user, fullName.trim(), phone.trim());
}
export async function logoutUser() {
  if (dataBackend === 'firebase' && auth) await signOut(auth);
  if (typeof window !== 'undefined') {
    try { window.localStorage.removeItem('chantakorn_auth_user'); } catch { /* No credentials are stored here. */ }
  }
}

export function safeRedirect(value: string | null): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') && !/[\\\u0000-\u0020]/.test(value) ? value : null;
}
