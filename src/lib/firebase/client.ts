// src/lib/firebase/client.ts
// Firebase configuration for Chantakorn Property
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import appletConfig from '../../../firebase-applet-config.json';

function getValidConfigValue(envVal: string | undefined, fallback: string | undefined): string {
  if (envVal && !envVal.includes('your-project-id') && envVal !== '51895189zaza' && !envVal.includes('YOUR_')) {
    return envVal;
  }
  return fallback || '';
}

const firebaseConfig = {
  apiKey: getValidConfigValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, appletConfig.apiKey) || appletConfig.apiKey,
  authDomain: getValidConfigValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, appletConfig.authDomain) || appletConfig.authDomain,
  projectId: getValidConfigValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, appletConfig.projectId) || appletConfig.projectId,
  storageBucket: getValidConfigValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, appletConfig.storageBucket) || appletConfig.storageBucket,
  messagingSenderId: getValidConfigValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, appletConfig.messagingSenderId) || appletConfig.messagingSenderId,
  appId: getValidConfigValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, appletConfig.appId) || appletConfig.appId,
};

const databaseId = appletConfig.firestoreDatabaseId || '(default)';

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  !firebaseConfig.projectId.includes('your-project-id')
);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
const googleProvider = new GoogleAuthProvider();

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app, databaseId);
    auth = getAuth(app);
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
}

export { app, db, auth, googleProvider };


