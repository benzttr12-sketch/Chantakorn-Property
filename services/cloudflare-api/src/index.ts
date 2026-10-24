import { Hono } from 'hono';
import { publicCatalogPayload } from './public-catalog-cache.ts';
import mediaRoutes from './media-routes.ts';
import propertyAdmin, { mediaForRows, toEditorProperty } from './property-admin-routes.ts';
import { sweepPropertyMediaOrphans } from './media-orphan-sweep.ts';
import { drizzle } from 'drizzle-orm/d1';
import { and, asc, desc, eq, gte, lte, lt, or, isNull, sql } from 'drizzle-orm';
import { properties } from './db/schema.ts';
import { authorizePropertyStaff } from './property-auth.ts';
import { catalogCursor, parseCatalogQuery } from './catalog-query.ts';

type Bindings = {
  DB: D1Database;
  PUBLIC_CATALOG_CACHE_ENABLED?: string;
  // Bound but deliberately not exposed by any endpoint until authenticated upload/read PR.
  PROPERTY_MEDIA: R2Bucket;
  PRIVATE_MEDIA: R2Bucket;
  ALLOWED_ORIGIN: string;
  FIREBASE_PROJECT_ID: string;
  MEDIA_WRITES_ENABLED?: string;
  MEDIA_SWEEP_ENABLED?: string;
  PROPERTY_WRITES_ENABLED?: string;
  PROPERTY_PUBLICATION_ENABLED?: string;
  FIREBASE_WEB_API_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  if (origin && origin === c.env?.ALLOWED_ORIGIN) {
    c.header('Access-Control-Allow-Origin', origin);
  }
  c.header('Vary', 'Origin');
  c.header('Cache-Control', 'no-store');
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

app.get('/health', c => c.json({ ok: true, service: 'chantakorn-d1-api', version: 1 }));

app.options('/v1/staff/me', c => {
  if (!c.env?.ALLOWED_ORIGIN || c.req.header('Origin') !== c.env.ALLOWED_ORIGIN) {
    return c.json({ error: 'Forbidden origin' }, 403);
  }
  c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  c.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  c.header('Access-Control-Max-Age', '300');
  return c.body(null, 204);
});

// Preview-only private endpoint. No mutations and NO self-assigned roles.
// Requires a real signed Firebase ID token plus a pre-approved D1 staff profile.
app.get('/v1/staff/me', async c => {
  c.header('Cache-Control', 'private, no-store');
  const result = await authorizePropertyStaff(c.env, c.req.header('Authorization'), true);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json({ uid: result.uid, full_name: result.fullName, role: result.role });
});

// Public serialization uses an explicit field allowlist in toEditorProperty()
// (includePrivate=false). Drafts and soft-deleted listings are filtered in SQL.
app.get('/v1/properties', async c => {
  const parsed = parseCatalogQuery(new URL(c.req.url).searchParams);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const f = parsed.value;
  const result = await publicCatalogPayload(c.env, c.req.raw, async () => {

    const where = [eq(properties.published, true), isNull(properties.deletedAt)];
    if (f.type) where.push(eq(properties.propertyType, f.type as (typeof properties.$inferSelect)['propertyType']));
    if (f.status) where.push(eq(properties.status, f.status as (typeof properties.$inferSelect)['status']));
    if (f.province) where.push(sql`instr(lower(${properties.province}), lower(${f.province})) > 0`);
    if (f.district) where.push(sql`instr(lower(${properties.district}), lower(${f.district})) > 0`);
    if (f.subdistrict) where.push(sql`instr(lower(${properties.subdistrict}), lower(${f.subdistrict})) > 0`);
    if (f.minPrice !== undefined) where.push(gte(properties.price, f.minPrice));
    if (f.maxPrice !== undefined) where.push(lte(properties.price, f.maxPrice));
    if (f.bedrooms !== undefined) where.push(gte(properties.bedrooms, f.bedrooms));
    if (f.bathrooms !== undefined) where.push(gte(properties.bathrooms, f.bathrooms));
    if (f.featured !== undefined) where.push(eq(properties.featured, f.featured));
    if (f.hasVideo) where.push(sql`length(trim(coalesce(${properties.videoUrl}, ''))) > 0`);
    if (f.searchQuery) where.push(or(...[
      properties.title, properties.description, properties.province, properties.district,
      properties.subdistrict, properties.id, properties.code,
    ].map(field => sql`instr(lower(${field}), lower(${f.searchQuery})) > 0`))!);
    for (const feature of f.features) where.push(sql`EXISTS (
      SELECT 1 FROM json_each(${properties.featuresJson}) AS feature
      WHERE instr(lower(CAST(feature.value AS TEXT)), lower(${feature})) > 0)`);
    const sortColumn = f.sortBy === 'popular' ? properties.featured : properties.price;
    if (f.cursor) {
      const cursor = f.cursor;
      const newest = or(lt(properties.createdAt, cursor.createdAt),
        and(eq(properties.createdAt, cursor.createdAt), lt(properties.id, cursor.id)))!;
      where.push(f.sortBy === 'newest' ? newest : or(
        f.sortBy === 'price_asc' ? sql`${sortColumn} > ${f.sortValue}` : sql`${sortColumn} < ${f.sortValue}`,
        and(sql`${sortColumn} = ${f.sortValue}`, newest),
      )!);
    }
    const order = f.sortBy === 'newest' ? [] : [f.sortBy === 'price_asc' ? asc(sortColumn) : desc(sortColumn)];
    const db = drizzle(c.env.DB);
    const rows = await db.select()
      .from(properties)
      .where(and(...where))
      .orderBy(...order, desc(properties.createdAt), desc(properties.id))
      .limit(f.limit + 1);

    const hasMore = rows.length > f.limit;
    const visible = rows.slice(0, f.limit);
    const last = visible.at(-1);
    const media = await mediaForRows(db, visible);
    return {
      data: visible.map(row => toEditorProperty(row, media.get(row.id) || [], false)),
      next_cursor: hasMore && last ? catalogCursor(last, f.sortBy) : null,
    };
  });
  c.header('Cache-Control', 'no-store');
  c.header('X-Catalog-Cache', result.cache);
  return c.json(result.data);
});

app.get('/v1/properties/:identifier', async c => {
  const identifier = c.req.param('identifier');
  if (!/^[\p{L}\p{N}_-]{1,120}$/u.test(identifier)) {
    return c.json({ error: 'Invalid listing identifier' }, 400);
  }
  if (new URL(c.req.url).search) return c.json({ error: 'Unsupported query parameter' }, 400);
  const result = await publicCatalogPayload(c.env, c.req.raw, async () => {
    const db = drizzle(c.env.DB);
    const rows = await db.select()
      .from(properties)
      .where(and(eq(properties.published, true), isNull(properties.deletedAt), or(eq(properties.code, identifier), eq(properties.slug, identifier), eq(properties.id, identifier))))
      .limit(1);
    if (!rows.length) return null;
    const media = await mediaForRows(db, rows);
    return { data: toEditorProperty(rows[0], media.get(rows[0].id) || [], false) };
  });
  c.header('Cache-Control', 'no-store');
  c.header('X-Catalog-Cache', result.cache);
  if (!result.data) return c.json({ error: 'Property not found' }, 404);
  return c.json(result.data);
});

app.route('/', mediaRoutes);
app.route('/', propertyAdmin);

app.notFound(c => c.json({ error: 'Not found' }, 404));
app.onError((error, c) => {
  console.error('CLOUDFLARE_D1_API_ERROR', { kind: error.name });
  return c.json({ error: 'Service temporarily unavailable' }, 503);
});

/** Scheduled Workers Cron runs a bounded orphan sweep only when opted in. */
async function runScheduledMediaSweep(env: Bindings): Promise<void> {
  try {
    const result = await sweepPropertyMediaOrphans(env);
    if (result && (result.deleted > 0 || result.orphans > 0))
      console.warn('R2_MEDIA_SWEEP', JSON.stringify({
        scanned: result.scanned, orphans: result.orphans, deleted: result.deleted,
        skipped_recent: result.skipped_recent, truncated: result.truncated,
      }));
  } catch (error) {
    // Never throw from a scheduled invocation; surface a stable alert code.
    console.error('R2_MEDIA_SWEEP_FAILED', { kind: error instanceof Error ? error.name : 'unknown' });
  }
}

export { app };
export default {
  fetch: (request: Request, env: Bindings, ctx: ExecutionContext) => app.fetch(request, env, ctx),
  scheduled: (_controller: ScheduledController, env: Bindings, ctx: ExecutionContext) => {
    ctx.waitUntil(runScheduledMediaSweep(env));
  },
} satisfies ExportedHandler<Bindings>;
