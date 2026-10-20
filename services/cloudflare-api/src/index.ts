import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { and, desc, eq, gte, lte, lt, or } from 'drizzle-orm';
import { profiles, properties } from './db/schema.ts';
import { authorizeStaffProfile, extractBearer, firebaseProjectConfigured, verifyFirebaseIdToken } from './auth.ts';
import { encodeCursor, parsePropertyQuery } from './property-query.ts';

type Bindings = {
  DB: D1Database;
  // Bound but deliberately not exposed by any endpoint until authenticated upload/read PR.
  PROPERTY_MEDIA: R2Bucket;
  PRIVATE_MEDIA: R2Bucket;
  ALLOWED_ORIGIN: string;
  FIREBASE_PROJECT_ID: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  if (origin && origin === c.env?.ALLOWED_ORIGIN) {
    c.header('Access-Control-Allow-Origin', origin);
  }
  c.header('Vary', 'Origin');
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
  if (!firebaseProjectConfigured(c.env?.FIREBASE_PROJECT_ID)) {
    return c.json({ error: 'Authentication not configured' }, 503);
  }
  const bearer = extractBearer(c.req.header('Authorization'));
  if (!bearer) return c.json({ error: 'Authentication required' }, 401);
  const identity = await verifyFirebaseIdToken(bearer, c.env.FIREBASE_PROJECT_ID);
  if (!identity) return c.json({ error: 'Invalid or unverified Firebase token' }, 401);
  const [profile] = await drizzle(c.env.DB).select({
    uid: profiles.uid,
    fullName: profiles.fullName,
    role: profiles.role,
    authDisabled: profiles.authDisabled,
    tokensValidAfter: profiles.tokensValidAfter,
  }).from(profiles).where(eq(profiles.uid, identity.uid)).limit(1);
  const role = authorizeStaffProfile(identity, profile);
  if (!role) return c.json({ error: 'Insufficient privileges' }, 403);
  return c.json({ uid: identity.uid, full_name: profile.fullName, role });
});

// Explicit field allowlist prevents internal_notes, staff/customer contacts and other
// future private columns becoming visible when schema changes.
const publicFields = {
  id: properties.id,
  code: properties.code,
  slug: properties.slug,
  title: properties.title,
  description: properties.description,
  propertyType: properties.propertyType,
  status: properties.status,
  price: properties.price,
  province: properties.province,
  district: properties.district,
  subdistrict: properties.subdistrict,
  latitude: properties.latitude,
  longitude: properties.longitude,
  bedrooms: properties.bedrooms,
  bathrooms: properties.bathrooms,
  parking: properties.parking,
  landSize: properties.landSize,
  usableArea: properties.usableArea,
  featuresJson: properties.featuresJson,
  coverImage: properties.coverImage,
  featured: properties.featured,
  createdAt: properties.createdAt,
  updatedAt: properties.updatedAt,
};

function toPublicProperty<T extends { featuresJson: string }>(row: T) {
  const { featuresJson, ...fields } = row;
  let features: string[] = [];
  try {
    const raw: unknown = JSON.parse(featuresJson);
    if (Array.isArray(raw)) features = raw.filter((v): v is string => typeof v === 'string').slice(0, 30);
  } catch {
    // Malformed legacy JSON cannot crash a public listing page.
  }
  return { ...fields, features };
}

app.get('/v1/properties', async c => {
  const parsed = parsePropertyQuery(new URL(c.req.url).searchParams);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const f = parsed.value;

  const where = [eq(properties.published, true)];
  if (f.type) where.push(eq(properties.propertyType, f.type as (typeof properties.$inferSelect)['propertyType']));
  if (f.status) where.push(eq(properties.status, f.status as (typeof properties.$inferSelect)['status']));
  if (f.province) where.push(eq(properties.province, f.province));
  if (f.district) where.push(eq(properties.district, f.district));
  if (f.minPrice !== undefined) where.push(gte(properties.price, f.minPrice));
  if (f.maxPrice !== undefined) where.push(lte(properties.price, f.maxPrice));
  if (f.cursor) {
    const cursor = f.cursor;
    where.push(or(
      lt(properties.createdAt, cursor.createdAt),
      and(eq(properties.createdAt, cursor.createdAt), lt(properties.id, cursor.id))
    )!);
  }
  const db = drizzle(c.env.DB);
  const rows = await db.select(publicFields)
    .from(properties)
    .where(and(...where))
    .orderBy(desc(properties.createdAt), desc(properties.id))
    .limit(f.limit + 1);

  const hasMore = rows.length > f.limit;
  const visible = rows.slice(0, f.limit);
  const last = visible.at(-1);
  c.header('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=60');
  return c.json({
    data: visible.map(toPublicProperty),
    next_cursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
  });
});

app.get('/v1/properties/:identifier', async c => {
  const identifier = c.req.param('identifier');
  if (!/^[\p{L}\p{N}_-]{1,120}$/u.test(identifier)) {
    return c.json({ error: 'Invalid listing identifier' }, 400);
  }
  const db = drizzle(c.env.DB);
  const rows = await db.select(publicFields)
    .from(properties)
    .where(and(eq(properties.published, true), or(eq(properties.code, identifier), eq(properties.slug, identifier))))
    .limit(1);
  if (!rows.length) return c.json({ error: 'Property not found' }, 404);
  c.header('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=60');
  return c.json({ data: toPublicProperty(rows[0]) });
});

app.notFound(c => c.json({ error: 'Not found' }, 404));
app.onError((error, c) => {
  console.error('CLOUDFLARE_D1_API_ERROR', { kind: error.name });
  return c.json({ error: 'Service temporarily unavailable' }, 503);
});

export default app;
