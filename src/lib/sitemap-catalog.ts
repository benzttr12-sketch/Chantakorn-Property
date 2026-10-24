type CatalogRow = Record<string, unknown>;

/** Read-only, bounded catalog inventory. Never import demo data or grant roles. */
export async function sitemapCatalog(): Promise<CatalogRow[]> {
  if (process.env.NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND === 'cloudflare') {
    const origin = new URL(process.env.NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN || '');
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash)
      throw new Error('Invalid sitemap API origin');
    const rows: CatalogRow[] = [];
    const visited = new Set<string>();
    const signal = AbortSignal.timeout(15000);
    let cursor: string | null = null;
    for (let page = 0; page < 100; page++) {
      const url = new URL('/v1/properties', origin);
      url.searchParams.set('limit', '30');
      if (cursor) url.searchParams.set('cursor', cursor);
      const response = await fetch(url, { signal, redirect: 'error', next: { revalidate: 3600 } });
      if (!response.ok) throw new Error('Sitemap catalog unavailable');
      const body = await response.json();
      if (!Array.isArray(body.data) || body.data.length > 30 ||
          (body.next_cursor !== null && (typeof body.next_cursor !== 'string' || !body.next_cursor || body.next_cursor.length > 512)))
        throw new Error('Invalid sitemap page');
      rows.push(...body.data);
      if (body.next_cursor === null) return rows;
      if (visited.has(body.next_cursor)) throw new Error('Repeated sitemap cursor');
      visited.add(body.next_cursor); cursor = body.next_cursor;
    }
    throw new Error('Sitemap requires partitioning beyond 3000 listings');
  }
  if (process.env.NEXT_PUBLIC_DATA_BACKEND === 'local') return [];
  const { serverFirestore } = await import('@/lib/server-firestore');
  const snapshot = await serverFirestore().collection('properties').where('published', '==', true)
    .select('slug', 'code', 'published', 'deleted_at', 'updated_at', 'created_at').limit(1000).get();
  if (snapshot.size >= 1000) throw new Error('Firestore sitemap requires partitioning');
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}
