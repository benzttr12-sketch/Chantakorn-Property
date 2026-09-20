import { auth, db, googleProvider } from '@/lib/firebase/client';
import { signInWithPopup, signOut as firebaseSignOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';
import { syncPropertiesAgentProfile } from '@/lib/store/properties-store';

export const ADMIN_EMAILS = [
  'benzttr12@gmail.com',
  'admin@chantakornproperty.com',
];

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  return ADMIN_EMAILS.includes(lower) || lower.endsWith('@chantakornproperty.com');
}

export function notifyAuthChange(profile: UserProfile | null) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('chantakorn_auth_change', { detail: profile }));
  }
}

export async function syncFirebaseUserProfile(user: User, customFullName?: string, customPhone?: string): Promise<UserProfile> {
  const email = user.email || '';
  const uid = user.uid;
  let role: UserProfile['role'] = isAdminEmail(email) ? 'ADMIN' : 'USER';
  let fullName = customFullName || user.displayName || email.split('@')[0] || 'ผู้ใช้งาน';
  let phone = customPhone || user.phoneNumber || '';
  let avatarUrl = user.photoURL || '';
  let lineId = '';
  let bio = '';

  if (db) {
    try {
      const userDocRef = doc(db, 'profiles', uid);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const data = snap.data() as Partial<UserProfile>;
        if (isAdminEmail(email)) {
          role = 'ADMIN';
        } else if (data.role) {
          role = data.role as UserProfile['role'];
        }
        if (data.full_name) fullName = data.full_name;
        if (data.phone) phone = data.phone;
        if (data.avatar_url) avatarUrl = data.avatar_url;
        if (data.line_id) lineId = data.line_id;
        if (data.bio) bio = data.bio;

        // Ensure Firestore has the ADMIN role if user is an admin email
        if (isAdminEmail(email) && data.role !== 'ADMIN') {
          await setDoc(userDocRef, { role: 'ADMIN', email, updated_at: new Date().toISOString() }, { merge: true });
        }
      } else {
        // Create initial profile in Firestore
        const newProfile: UserProfile = {
          id: uid,
          full_name: fullName,
          email,
          role,
          phone,
          avatar_url: avatarUrl,
          created_at: new Date().toISOString()
        };
        await setDoc(userDocRef, newProfile);
      }
    } catch (err) {
      console.warn('Could not sync Firestore profile:', err);
    }
  }

  const profile: UserProfile = {
    id: uid,
    full_name: fullName,
    email,
    role,
    phone,
    avatar_url: avatarUrl,
    line_id: lineId,
    bio,
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem('chantakorn_auth_user', JSON.stringify(profile));
    notifyAuthChange(profile);
  }

  return profile;
}

export async function updateCurrentUserProfile(updates: {
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  line_id?: string;
  bio?: string;
}): Promise<UserProfile> {
  const current = getStoredUser();
  const uid = auth?.currentUser?.uid || current?.id || `user-${Date.now()}`;
  const email = auth?.currentUser?.email || current?.email || '';
  const role = current?.role || (isAdminEmail(email) ? 'ADMIN' : 'USER');

  // Update Firebase Auth display info if user is authenticated
  if (auth?.currentUser) {
    try {
      await updateProfile(auth.currentUser, {
        displayName: updates.full_name !== undefined ? updates.full_name : auth.currentUser.displayName,
        photoURL: updates.avatar_url !== undefined ? updates.avatar_url : auth.currentUser.photoURL,
      });
    } catch (err) {
      console.warn('Could not update Firebase Auth profile:', err);
    }
  }

  // Update Firestore profile document
  if (db && uid) {
    try {
      const userDocRef = doc(db, 'profiles', uid);
      await setDoc(userDocRef, {
        ...updates,
        email,
        role,
        updated_at: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn('Could not update Firestore profile document:', err);
    }
  }

  const updatedProfile: UserProfile = {
    id: uid,
    email,
    role,
    full_name: updates.full_name ?? current?.full_name ?? 'ผู้ใช้งาน',
    phone: updates.phone ?? current?.phone ?? '',
    avatar_url: updates.avatar_url ?? current?.avatar_url ?? '',
    line_id: updates.line_id ?? current?.line_id ?? '',
    bio: updates.bio ?? current?.bio ?? '',
    created_at: current?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem('chantakorn_auth_user', JSON.stringify(updatedProfile));
    notifyAuthChange(updatedProfile);
  }

  // Propagate profile updates (including avatar_url, name, phone, etc.) to all posted properties
  try {
    await syncPropertiesAgentProfile(updatedProfile);
  } catch (syncErr) {
    console.warn('Could not sync properties with updated profile:', syncErr);
  }

  return updatedProfile;
}

export async function signInWithGoogle(): Promise<UserProfile> {
  if (!auth) {
    throw new Error('Firebase Auth is not configured');
  }
  const result = await signInWithPopup(auth, googleProvider);
  return syncFirebaseUserProfile(result.user);
}

export async function loginWithEmail(email: string, pass: string): Promise<UserProfile> {
  if (auth) {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return syncFirebaseUserProfile(result.user);
  }
  throw new Error('ระบบตรวจสอบสิทธิ์ยังไม่พร้อมใช้งาน');
}

export async function registerWithEmail(email: string, pass: string, fullName: string, phone: string): Promise<UserProfile> {
  if (auth) {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    return syncFirebaseUserProfile(result.user, fullName, phone);
  }
  throw new Error('ระบบตรวจสอบสิทธิ์ยังไม่พร้อมใช้งาน');
}

export async function logoutUser() {
  if (auth) {
    try {
      await firebaseSignOut(auth);
    } catch {}
  }
  if (typeof window !== 'undefined') {
    localStorage.removeItem('chantakorn_auth_user');
    notifyAuthChange(null);
  }
}

export function getStoredUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('chantakorn_auth_user');
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}
