import { decodeCursor, encodeCursor, parsePropertyQuery, type Cursor, type PropertyQuery } from './property-query.ts';

const EXTRA = ['subdistrict', 'bedrooms', 'bathrooms', 'searchQuery', 'features', 'hasVideo', 'featured', 'sortBy'];
export type Sort = 'newest' | 'price_asc' | 'price_desc' | 'popular';
export type CatalogQuery = PropertyQuery & {
  subdistrict?: string; bedrooms?: number; bathrooms?: number; searchQuery?: string;
  features: string[]; hasVideo: boolean; featured?: boolean; sortBy: Sort; sortValue?: number;
};

export function catalogCursor(row: { createdAt: string; id: string; price: number; featured: boolean }, sort: Sort): string {
  const after = encodeCursor(row);
  if (sort === 'newest') return after;
  return btoa(JSON.stringify({ after, sort, value: sort === 'popular' ? Number(row.featured) : row.price }))
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function parseCatalogQuery(params: URLSearchParams): { ok: true; value: CatalogQuery } | { ok: false; error: string } {
  const invalid = (error: string) => ({ ok: false as const, error });
  if ([...params.keys()].some(key => params.getAll(key).length > 1)) return invalid('Duplicate query parameter');
  const sortBy = (params.get('sortBy') || 'newest') as Sort;
  if (!['newest', 'price_asc', 'price_desc', 'popular'].includes(sortBy)) return invalid('Invalid sort order');
  const base = new URLSearchParams(params);
  for (const key of EXTRA) base.delete(key);
  let sortedCursor: Cursor | undefined;
  let sortValue: number | undefined;
  if (sortBy !== 'newest' && params.has('cursor')) {
    const token = params.get('cursor')!;
    if (!/^[A-Za-z0-9_-]{1,512}$/.test(token)) return invalid('Invalid cursor');
    try {
      const encoded = token.replaceAll('-', '+').replaceAll('_', '/');
      const decoded = JSON.parse(atob(encoded + '='.repeat((4 - encoded.length % 4) % 4)));
      sortedCursor = typeof decoded.after === 'string' ? decodeCursor(decoded.after) ?? undefined : undefined;
      if (!sortedCursor || decoded.sort !== sortBy || typeof decoded.value !== 'number' ||
          !Number.isFinite(decoded.value) || decoded.value < 0 || decoded.value > 1e13 ||
          (sortBy === 'popular' && ![0, 1].includes(decoded.value))) return invalid('Invalid cursor');
      sortValue = decoded.value;
      base.delete('cursor');
    } catch { return invalid('Invalid cursor'); }
  }
  const parsed = parsePropertyQuery(base);
  if (!parsed.ok) return parsed;
  const subdistrict = params.get('subdistrict')?.trim() || undefined;
  const searchQuery = params.get('searchQuery')?.trim() || undefined;
  if ((subdistrict?.length || 0) > 100 || (searchQuery?.length || 0) > 120) return invalid('Search text is too long');
  const rooms = (key: string) => {
    const value = params.get(key);
    return value === null ? undefined : /^\d{1,2}$/.test(value) ? Number(value) : null;
  };
  const bedrooms = rooms('bedrooms'), bathrooms = rooms('bathrooms');
  if (bedrooms === null || bathrooms === null) return invalid('Invalid room count');
  for (const key of ['hasVideo', 'featured'])
    if (params.has(key) && !['true', 'false'].includes(params.get(key)!)) return invalid('Invalid boolean filter');
  let features: string[] = [];
  if (params.has('features')) {
    const raw = params.get('features')!;
    if (raw.length > 1000) return invalid('Too many feature filters');
    try {
      const value: unknown = JSON.parse(raw);
      if (!Array.isArray(value) || value.length > 10 || value.some(x => typeof x !== 'string' || !x.trim() || x.length > 80))
        return invalid('Invalid feature filters');
      features = value;
    } catch { return invalid('Invalid feature filters'); }
  }
  return { ok: true, value: { ...parsed.value, cursor: sortedCursor || parsed.value.cursor, sortValue,
    subdistrict, bedrooms, bathrooms, searchQuery, features, sortBy,
    hasVideo: params.get('hasVideo') === 'true',
    featured: params.has('featured') ? params.get('featured') === 'true' : undefined,
  } };
}
