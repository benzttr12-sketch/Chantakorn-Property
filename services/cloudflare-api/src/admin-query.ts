/** Bounded parser + keyset cursors for the authenticated Admin property list. */
import { decodeCursor, encodeCursor, type Cursor } from './property-query.ts';

const TYPES = new Set(['house', 'land', 'condo', 'commercial', 'investment', 'consignment']);
/** The Admin UI's combined status tabs map onto exact SQL predicates. */
export const ADMIN_FILTERS = new Set(['sale', 'rent', 'featured', 'draft', 'published']);
export const ADMIN_SORTS = ['newest', 'oldest', 'price_desc', 'price_asc', 'area_desc'] as const;
export type AdminSort = typeof ADMIN_SORTS[number];
export type AdminPropertyQuery = {
  limit: number;
  sortBy: AdminSort;
  searchQuery?: string;
  filter?: 'sale' | 'rent' | 'featured' | 'draft' | 'published';
  type?: string;
  district?: string;
  cursor?: Cursor;
  sortValue?: number;
};
const FIELDS = new Set(['limit', 'sortBy', 'searchQuery', 'filter', 'type', 'district', 'cursor']);

export function adminCursor(
  row: { createdAt: string; id: string; price: number; usableArea: number }, sort: AdminSort,
): string {
  const after = encodeCursor({ createdAt: row.createdAt, id: row.id });
  if (sort === 'newest' || sort === 'oldest') return after;
  const value = sort === 'area_desc' ? row.usableArea : row.price;
  return btoa(JSON.stringify({ after, sort, value }))
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decodeSortedCursor(token: string, sort: AdminSort): { cursor: Cursor; value: number } | null {
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(token)) return null;
  try {
    const encoded = token.replaceAll('-', '+').replaceAll('_', '/');
    const decoded: unknown = JSON.parse(atob(encoded + '='.repeat((4 - encoded.length % 4) % 4)));
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return null;
    const data = decoded as { after?: unknown; sort?: unknown; value?: unknown };
    if (data.sort !== sort || typeof data.value !== 'number' || !Number.isFinite(data.value) ||
        data.value < 0 || data.value > 1e13 || typeof data.after !== 'string') return null;
    const cursor = decodeCursor(data.after);
    return cursor ? { cursor, value: data.value } : null;
  } catch { return null; }
}

export function parseAdminQuery(
  params: URLSearchParams,
): { ok: true; value: AdminPropertyQuery } | { ok: false; error: string } {
  const invalid = (error: string) => ({ ok: false as const, error });
  if ([...params.keys()].some(key => !FIELDS.has(key))) return invalid('Unsupported query parameter');
  if ([...params.keys()].some(key => params.getAll(key).length > 1)) return invalid('Duplicate query parameter');

  const rawLimit = params.get('limit');
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  if (rawLimit !== null && !/^\d{1,3}$/.test(rawLimit)) return invalid('Invalid limit');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return invalid('Limit must be from 1 to 100');

  const sortBy = (params.get('sortBy') || 'newest') as AdminSort;
  if (params.has('sortBy') && !params.get('sortBy')) return invalid('Invalid sort order');
  if (!(ADMIN_SORTS as readonly string[]).includes(sortBy)) return invalid('Invalid sort order');

  const searchQuery = params.get('searchQuery')?.trim() || undefined;
  if ((searchQuery?.length || 0) > 120) return invalid('Search text is too long');
  const district = params.get('district')?.trim() || undefined;
  if (params.has('district') && !district) return invalid('Invalid district filter');
  if ((district?.length || 0) > 100) return invalid('Invalid district filter');
  const type = params.get('type') || undefined;
  if (params.has('type') && !type) return invalid('Invalid property type');
  if (type && !TYPES.has(type)) return invalid('Invalid property type');
  const filter = params.get('filter') || undefined;
  if (params.has('filter') && !filter) return invalid('Invalid listing filter');
  if (filter && !ADMIN_FILTERS.has(filter)) return invalid('Invalid listing filter');

  const token = params.get('cursor');
  let cursor: Cursor | undefined;
  let sortValue: number | undefined;
  if (token !== null) {
    if (sortBy === 'newest' || sortBy === 'oldest') {
      cursor = decodeCursor(token) ?? undefined;
      if (!cursor) return invalid('Invalid cursor');
    } else {
      const sorted = decodeSortedCursor(token, sortBy);
      if (!sorted) return invalid('Invalid cursor');
      cursor = sorted.cursor;
      sortValue = sorted.value;
    }
  }
  return {
    ok: true,
    value: {
      limit, sortBy, searchQuery,
      filter: filter as AdminPropertyQuery['filter'],
      type, district, cursor, sortValue,
    },
  };
}
