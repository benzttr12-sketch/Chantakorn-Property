import appletConfig from '../../firebase-applet-config.json';

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
};

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

function fromFirestoreValue(value: FirestoreValue): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in value) return fromFirestoreFields(value.mapValue.fields || {});
  return null;
}

function fromFirestoreFields(fields: Record<string, FirestoreValue> = {}): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, fromFirestoreValue(value)]));
}

export async function getFirestoreDocument(collection: string, id: string, token?: string) {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(withApiKey(`${documentsUrl}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`), {
    headers,
    signal: AbortSignal.timeout(10000),
  });
}

export async function patchFirestoreDocument(collection: string, id: string, fields: Record<string, unknown>, token: string) {
  const url = new URL(withApiKey(`${documentsUrl}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`));
  for (const field of Object.keys(fields)) url.searchParams.append('updateMask.fieldPaths', field);
  const firestoreFields: Record<string, FirestoreValue> = {};
  for (const [key, value] of Object.entries(fields)) firestoreFields[key] = toFirestoreValue(value);
  return fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: firestoreFields }),
    signal: AbortSignal.timeout(10000),
  });
}

export async function createFirestoreDocument(collection: string, fields: Record<string, unknown>) {
  const firestoreFields: Record<string, FirestoreValue> = {};
  for (const [key, value] of Object.entries(fields)) firestoreFields[key] = toFirestoreValue(value);
  return fetch(withApiKey(`${documentsUrl}/${encodeURIComponent(collection)}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: firestoreFields }),
    signal: AbortSignal.timeout(10000),
  });
}

export async function listFirestoreDocuments(collection: string, limit: number) {
  const url = withApiKey(`${documentsUrl}:runQuery`);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], limit } }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Firestore query failed with status ${response.status}`);
  const rows = (await response.json()) as Array<{ document?: FirestoreDocument }>;
  return rows.flatMap((row) => {
    if (!row.document?.name) return [];
    const id = row.document.name.split('/').pop() || '';
    return [{ id, ...fromFirestoreFields(row.document.fields) }];
  });
}
