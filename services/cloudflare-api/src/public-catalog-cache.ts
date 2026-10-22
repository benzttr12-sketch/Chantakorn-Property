type CacheEnv = { DB: D1Database; PUBLIC_CATALOG_CACHE_ENABLED?: string };

/** Only call after validating a public catalog route, with an allowlisted loader.
 * Read the current generation from primary D1 on every request. SQL triggers
 * invalidate all previous keys atomically, including direct operator SQL writes.
 * Never cache the generation itself or use a lagging replica for this check.
 */
export async function publicCatalogPayload<T>(
  env: CacheEnv, request: Request, load: () => Promise<T | null>,
): Promise<{ data: T | null; cache: 'HIT' | 'MISS' | 'BYPASS' }> {
  if (env.PUBLIC_CATALOG_CACHE_ENABLED !== 'true' || request.method !== 'GET' ||
      request.headers.has('Authorization') || request.headers.has('Cookie'))
    return { data: await load(), cache: 'BYPASS' };
  const generation = await env.DB.prepare('SELECT version FROM catalog_generation WHERE id=1')
    .first<{ version: string }>();
  if (!generation || !/^[0-9a-f]{32}$/.test(generation.version))
    throw new Error('Catalog generation unavailable');
  const key = new URL(request.url);
  key.searchParams.sort();
  key.searchParams.set('__catalog_generation', generation.version);
  // New serialization contracts must bump this namespace.
  let cache: Cache;
  try { cache = await caches.open('public-catalog-v2'); }
  catch { return { data: await load(), cache: 'BYPASS' }; }
  let hit: Response | undefined;
  try { hit = await cache.match(key.toString()); } catch { /* Origin remains available. */ }
  if (hit) {
    try { return { data: await hit.json() as T, cache: 'HIT' }; } catch { /* Rebuild malformed cache. */ }
  }
  const data = await load();
  if (data !== null) {
    // Cache only the public payload, never caller cookies/CORS/token headers.
    try { await cache.put(key.toString(), Response.json(data, {
      headers: { 'Cache-Control': 'public, max-age=60' },
    })); } catch { /* Cache failures must not make a valid origin result fail. */ }
  }
  return { data, cache: 'MISS' };
}
