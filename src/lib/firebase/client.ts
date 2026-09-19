// src/lib/firebase/client.ts
// Firebase configuration for Chantakorn Property
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
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

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

export async function testConnection() {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is currently offline or unreachable.');
    }
  }
}

if (typeof window !== 'undefined') {
  testConnection();
}

export { app, db, auth, googleProvider };


