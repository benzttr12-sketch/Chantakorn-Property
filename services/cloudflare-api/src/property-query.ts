/** Public, bounded property-query parser. Intentionally independent from Hono/DB for offline tests. */
const TYPES = new Set(['house', 'land', 'condo', 'commercial', 'investment', 'consignment']);
const STATUSES = new Set(['sale', 'rent']);
const FIELDS = new Set(['limit', 'type', 'status', 'province', 'district', 'minPrice', 'maxPrice', 'cursor']);
const ISO_UTC = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const CURSOR_ID = /^[A-Za-z0-9_-]{1,64}$/;

export type Cursor = { createdAt: string; id: string };
export type PropertyQuery = {
  limit: number;
  type?: string;
  status?: string;
  province?: string;
  district?: string;
  minPrice?: number;
  maxPrice?: number;
  cursor?: Cursor;
};
export type ParsedQuery = { ok: true; value: PropertyQuery } | { ok: false; error: string };

export function encodeCursor(item: Cursor): string {
  return btoa(item.createdAt + '|' + item.id).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function decodeCursor(token: string): Cursor | null {
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(token)) return null;
  try {
    const base64 = token.replaceAll('-', '+').replaceAll('_', '/');
    const decoded = atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
    const parts = decoded.split('|');
    if (parts.length !== 2) return null;
    const [createdAt, id] = parts;
    if (!ISO_UTC.test(createdAt) || !CURSOR_ID.test(id)) return null;
    if (!Number.isFinite(Date.parse(createdAt)) || new Date(createdAt).toISOString() !== createdAt) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export function parsePropertyQuery(params: URLSearchParams): ParsedQuery {
  if ([...params.keys()].some(key => !FIELDS.has(key))) return { ok: false, error: 'Unsupported query parameter' };
  if ([...FIELDS].some(key => params.getAll(key).length > 1)) return { ok: false, error: 'Duplicate query parameter' };
  const requestedLimit = params.get('limit');
  const limit = requestedLimit === null ? 12 : Number(requestedLimit);
  if (requestedLimit !== null && !/^\d{1,2}$/.test(requestedLimit)) return { ok: false, error: 'Invalid limit' };
  if (!Number.isInteger(limit) || limit < 1 || limit > 30) return { ok: false, error: 'Limit must be from 1 to 30' };

  const type = params.get('type') || undefined;
  const status = params.get('status') || undefined;
  if (type && !TYPES.has(type)) return { ok: false, error: 'Invalid property type' };
  if (status && !STATUSES.has(status)) return { ok: false, error: 'Invalid listing status' };

  const province = params.get('province')?.trim() || undefined;
  const district = params.get('district')?.trim() || undefined;
  if ([province, district].some(v => v && v.length > 100)) return { ok: false, error: 'Location filter is too long' };
  const parsePrice = (key: string) => {
    const raw = params.get(key);
    if (raw === null) return undefined;
    if (!/^(?:\d{1,13})(?:\.\d{1,2})?$/.test(raw)) return null;
    const price = Number(raw);
    return Number.isFinite(price) ? price : null;
  };
  const minPrice = parsePrice('minPrice');
  const maxPrice = parsePrice('maxPrice');
  if (minPrice === null || maxPrice === null) return { ok: false, error: 'Invalid price' };
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    return { ok: false, error: 'Minimum price exceeds maximum price' };
  }

  const token = params.get('cursor');
  const cursor = token ? decodeCursor(token) : undefined;
  if (token !== null && !cursor) return { ok: false, error: 'Invalid cursor' };
  return { ok: true, value: { limit, type, status, province, district, minPrice, maxPrice, cursor } };
}
