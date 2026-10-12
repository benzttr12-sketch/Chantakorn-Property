import appletConfig from '../../firebase-applet-config.json';
import { serverFirestore } from './server-firestore';

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || appletConfig.projectId;
const databaseId = appletConfig.firestoreDatabaseId || '(default)';
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || appletConfig.apiKey;
const documentsUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents`;

function withApiKey(url: string): string {
  const target = new URL(url);
  if (apiKey) target.searchParams.set('key', apiKey);
  return target.toString();
}

function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [key, item] of Object.entries(value)) fields[key] = toFirestoreValue(item);
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

export async function getFirestoreDocument(collection: string, id: string, token?: string) {
  if (!token) {
    try {
      const snapshot = await serverFirestore().collection(collection).doc(id).get();
      if (!snapshot.exists) return Response.json({}, { status: 404 });
      const fields = Object.fromEntries(Object.entries(snapshot.data() || {}).map(([key, value]) => [key, toFirestoreValue(value)]));
      return Response.json({ name: snapshot.ref.path, fields });
    } catch { return Response.json({}, { status: 503 }); }
  }
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(withApiKey(`${documentsUrl}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`), {
    headers,
    signal: AbortSignal.timeout(10000),
  });
}

export async function patchFirestoreDocument(collection: string, id: string, fields: Record<string, unknown>, token?: string) {
  if (!token) {
    try {
      await serverFirestore().collection(collection).doc(id).set(fields, { merge: true });
      return Response.json({});
    } catch { return Response.json({}, { status: 503 }); }
  }
  const url = new URL(withApiKey(`${documentsUrl}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`));
  for (const field of Object.keys(fields)) url.searchParams.append('updateMask.fieldPaths', field);
  const firestoreFields: Record<string, FirestoreValue> = {};
  for (const [key, value] of Object.entries(fields)) firestoreFields[key] = toFirestoreValue(value);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields: firestoreFields }),
    signal: AbortSignal.timeout(10000),
  });
}

export async function createFirestoreDocument(collection: string, fields: Record<string, unknown>) {
  try {
    const result = await serverFirestore().collection(collection).add(fields);
    return Response.json({ name: result.path });
  } catch { return Response.json({}, { status: 503 }); }
}

/* User-authorized requests use REST; webhook and public projection queries use the server identity. */
export async function listFirestoreDocuments(collection: string, limit: number, options: { publishedOnly?: boolean } = {}) {
  const db = serverFirestore();
  const reference = db.collection(collection);
  const request = options.publishedOnly ? reference.where('published', '==', true) : reference;
  const result = await request.limit(Math.min(Math.max(limit, 1), 1000)).get();
  return result.docs.map(snapshot => ({ ...snapshot.data(), id: snapshot.id }));
}
