import { getFirestoreDocument, listFirestoreDocuments } from '@/lib/firestore-rest';
import { publicProperty } from '@/lib/public-property';
import type { Property } from '@/lib/types';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_LISTINGS = 200;

function cloudflareCatalog(): boolean {
  const backend = (process.env.NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND || 'cloudflare').trim().toLowerCase();
  if (backend !== 'cloudflare' && backend !== 'firebase') throw new Error('Invalid property backend');
  return backend === 'cloudflare';
}

function apiOrigin(): string {
  const url = new URL((process.env.NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN || '').trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/')
    throw new Error('Invalid property API origin');
  return url.origin;
}

async function publicRequest(path: string, signal: AbortSignal): Promise<Response> {
  // This endpoint contains published listings only. Never forward a staff token,
  // caller cookies, LINE credentials, or an unvalidated redirect to this service.
  return fetch(apiOrigin() + path, {
    method: 'GET', cache: 'no-store', credentials: 'omit', redirect: 'error', signal,
  });
}

async function boundedJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error('Property catalog unavailable');
  }
  const declared = response.headers.get('Content-Length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_RESPONSE_BYTES)) {
    await response.body.cancel();
    throw new Error('Property catalog response too large');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new Error('Property catalog response too large');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const data: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid property catalog response');
  return data as Record<string, unknown>;
}

function publishedCloudflareRow(value: unknown): Property | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid property record');
  const row = value as Record<string, unknown>;
  if (row.published !== true || row.deleted_at != null || row.deletedAt != null) return null;
  if (typeof row.id !== 'string' || !row.id || row.id.length > 120) throw new Error('Invalid property identity');
  const origin = apiOrigin();
  const result = publicProperty(row, origin)!;
  const absoluteMedia = (media: unknown) => typeof media === 'string' && /^\/v1\/media\/properties\/[0-9a-f-]{36}$/i.test(media)
    ? origin + media : media;
  result.images = Array.isArray(result.images) ? result.images.map(absoluteMedia) : [];
  result.cover_image = absoluteMedia(result.cover_image);
  return result as unknown as Property;
}

function firestoreValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number' && Number.isFinite(value))
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === 'object') return { mapValue: { fields: Object.fromEntries(
    Object.entries(value).map(([key, field]) => [key, firestoreValue(field)]),
  ) } };
  return { nullValue: null };
}

/** Existing LINE card/photo builders use Firestore's field representation.
 * Adapt the selected public catalog without reading legacy listings in D1 mode. */
export async function getPublishedPropertyDocument(id: string, staffToken?: string): Promise<Response> {
  if (!cloudflareCatalog()) return getFirestoreDocument('properties', id, staffToken);
  if (!/^[\p{L}\p{N}_-]{1,120}$/u.test(id)) return Response.json({}, { status: 404 });
  const response = await publicRequest(`/v1/properties/${encodeURIComponent(id)}`, AbortSignal.timeout(10000));
  if (response.status === 403 || response.status === 404) {
    await response.body?.cancel();
    return Response.json({}, { status: 404 });
  }
  const body = await boundedJson(response);
  const property = publishedCloudflareRow(body.data);
  if (!property) return Response.json({}, { status: 404 });
  const fields = Object.fromEntries(Object.entries(property).map(([key, value]) => [key, firestoreValue(value)]));
  return Response.json({ fields });
}

/** Bounded published slice for customer replies/diagnostics; never an Admin list.
 * One deadline covers all pages and malformed/cyclic cursors fail visibly. */
export async function listPublishedProperties(limit: number): Promise<Property[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LISTINGS) throw new Error('Invalid property catalog limit');
  if (!cloudflareCatalog()) {
    return (await listFirestoreDocuments('properties', limit, { publishedOnly: true }) as Property[])
      .filter(property => property.published === true);
  }
  const pageSize = Math.min(limit, 30);
  const rows: Property[] = [];
  const visited = new Set<string>();
  const signal = AbortSignal.timeout(10000);
  let cursor: string | null = null;
  for (let page = 0; page < Math.ceil(limit / pageSize); page++) {
    const query = new URLSearchParams({ limit: String(pageSize) });
    if (cursor) query.set('cursor', cursor);
    const body = await boundedJson(await publicRequest(`/v1/properties?${query}`, signal));
    if (!Array.isArray(body.data) || body.data.length > pageSize ||
        (body.next_cursor !== null && (typeof body.next_cursor !== 'string' || !body.next_cursor || body.next_cursor.length > 512)))
      throw new Error('Invalid property catalog page');
    rows.push(...body.data.map(publishedCloudflareRow).filter((row): row is Property => row !== null));
    if (body.next_cursor === null || rows.length >= limit) return rows.slice(0, limit);
    if (visited.has(body.next_cursor as string)) throw new Error('Repeated property catalog cursor');
    visited.add(body.next_cursor as string);
    cursor = body.next_cursor as string;
  }
  throw new Error('Property catalog exceeded the bounded page count');
}
