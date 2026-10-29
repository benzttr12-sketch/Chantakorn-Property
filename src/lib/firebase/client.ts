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

// Storage-partitioned browsers (Safari ITP, Brave, in-app webviews) block the
// cross-origin firebaseapp.com handler, killing both popup and redirect
// sign-in with "missing initial state". Serving the auth handler first-party
// through the main site's proxy (see vercel.json rewrites /__/auth/*) fixes
// it: run the handshake on the site's own origin when we are on it.
const AUTH_HANDLER_HOSTS = new Set(['chantakornproperty.com', 'www.chantakornproperty.com']);
const sameOriginAuthDomain = typeof window !== 'undefined'
  && AUTH_HANDLER_HOSTS.has(window.location.hostname)
  ? window.location.hostname
  : '';

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
// A different Google account may be needed to access the staff workspace.
googleProvider.setCustomParameters({ prompt: 'select_account' });

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp({
      ...firebaseConfig,
      ...(sameOriginAuthDomain ? { authDomain: sameOriginAuthDomain } : {}),
    });
    db = getFirestore(app, databaseId);
    auth = getAuth(app);
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
}

export { app, db, auth, googleProvider };


