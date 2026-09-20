import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import projectConfig from '../../../firebase.web.json';

// Public settings must belong to the selected deployment, never a fallback project.
const firebaseConfig = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} : { ...projectConfig, storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET };
const usable = (value: string | undefined) => Boolean(value && !/YOUR_|your-project|51895189zaza/.test(value));
export const isFirebaseConfigured = [firebaseConfig.apiKey, firebaseConfig.projectId, firebaseConfig.authDomain, firebaseConfig.appId].every(usable);
const selected = process.env.NEXT_PUBLIC_DATA_BACKEND;
const enabled = isFirebaseConfigured && (!selected || selected === 'firebase');
export const app = enabled ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;
export const db = app ? getFirestore(app, process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || (firebaseConfig.projectId === projectConfig.projectId ? projectConfig.databaseId : '(default)')) : null;
export const auth = app ? getAuth(app) : null;
export const storage = app && usable(firebaseConfig.storageBucket) ? getStorage(app) : null;
export const googleProvider = new GoogleAuthProvider();

const emulatorGlobal = globalThis as typeof globalThis & { chantakornEmulatorsConnected?: boolean };
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true'
  && ['localhost', '127.0.0.1'].includes(window.location.hostname) && !emulatorGlobal.chantakornEmulatorsConnected && auth && db) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  if (storage) connectStorageEmulator(storage, '127.0.0.1', 9199);
  emulatorGlobal.chantakornEmulatorsConnected = true;
}
