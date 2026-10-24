import { Hono, type Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { propertyMedia, properties } from './db/schema.ts';
import { authorizePropertyStaff, canWriteProperties, type PropertyAuthEnv } from './property-auth.ts';
import { newPropertyIdentity, parseEditorInput, readBoundedJson } from './property-input.ts';
import { auditedMutation } from './audited-mutation.ts';
import { adminCursor, parseAdminQuery } from './admin-query.ts';
import { SWEEP_STATUS_KEY } from './media-orphan-sweep.ts';

type Env = PropertyAuthEnv & {
  PROPERTY_MEDIA: R2Bucket; PRIVATE_MEDIA: R2Bucket; MEDIA_SWEEP_ENABLED?: string;
};
type DbProperty = typeof properties.$inferSelect;
type MediaRecord = { propertyId: string; id: string; sortOrder: number };

export const propertyAdmin = new Hono<{ Bindings: Env }>();
type Ctx = Context<{ Bindings: Env }>;

const publicMediaPath = (id: string) => `/v1/media/properties/${id}`;
const jsonList = (value: string): string[] => {
  try {
    const items: unknown = JSON.parse(value);
    return Array.isArray(items) ? items.filter((v): v is string => typeof v === 'string').slice(0, 60) : [];
  } catch { return []; }
};
const jsonObject = (value: string | null): Record<string, unknown> | undefined => {
  if (!value) return undefined;
  try {
    const item: unknown = JSON.parse(value);
    return item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : undefined;
  } catch { return undefined; }
};
export function toEditorProperty(row: DbProperty, files: MediaRecord[], includePrivate: boolean) {
  const images = files.sort((a, b) => a.sortOrder - b.sortOrder).map(x => publicMediaPath(x.id));
  const fields = {
    id: row.id, code: row.code, title: row.title, slug: row.slug, description: row.description,
    property_type: row.propertyType, status: row.status, price: row.price,
    province: row.province, district: row.district, subdistrict: row.subdistrict || '',
    address: row.address || '', latitude: row.latitude ?? 0, longitude: row.longitude ?? 0,
    coordinates_available: row.latitude != null && row.longitude != null &&
      (row.latitude !== 0 || row.longitude !== 0),
    facing_direction: row.facingDirection || undefined, feng_shui: jsonObject(row.fengShuiJson),
    bedrooms: row.bedrooms, bathrooms: row.bathrooms, parking: row.parking,
    land_size: row.landSize, usable_area: row.usableArea, year_built: row.yearBuilt ?? undefined,
    furniture: row.furniture, features: jsonList(row.featuresJson),
    cover_image: row.coverImage || images[0] || '', images,
    video_url: row.videoUrl || '', videos: jsonList(row.videosJson),
    featured: row.featured, published: row.published,
    agent_id: row.agentId || undefined, created_at: row.createdAt, updated_at: row.updatedAt,
  };
  return includePrivate ? { ...fields, internal_notes: row.internalNotes ?? '' } : fields;
}

export async function mediaForRows(db: ReturnType<typeof drizzle>, rows: DbProperty[]) {
  if (!rows.length) return new Map<string, MediaRecord[]>();
  const records = await db.select({
    id: propertyMedia.id,
    propertyId: propertyMedia.propertyId,
    sortOrder: propertyMedia.sortOrder,
  }).from(propertyMedia).where(inArray(propertyMedia.propertyId, rows.map(r => r.id)))
    .orderBy(propertyMedia.sortOrder, propertyMedia.id);
  const map = new Map<string, MediaRecord[]>();
  for (const r of records) map.set(r.propertyId, [...(map.get(r.propertyId) || []), r]);
  return map;
}

function setPrivateHeaders(c: Ctx) {
  c.header('Cache-Control', 'private, no-store');
  c.header('Pragma', 'no-cache');
}

async function authorized(c: Ctx, write = false) {
  setPrivateHeaders(c);
  if (write && !canWriteProperties(c.env, c.req.header('Origin')))
    return { ok: false as const, status: 503 as const, error: 'Property mutations are disabled' };
  const result = await authorizePropertyStaff(c.env, c.req.header('Authorization'), true);
  if (!result.ok) return result;
  if (write && result.role !== 'ADMIN')
    return { ok: false as const, status: 403 as const, error: 'Only approved administrators may change properties' };
  return result;
}
function routeError(e: unknown, c: Ctx) {
  const type = e && typeof e === 'object' && 'message' in e ? String(e.message) : '';
  if (/UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i.test(type)) return c.json({ error: 'Property code or slug is already used' }, 409);
  if (/FOREIGN KEY constraint failed|SQLITE_CONSTRAINT_FOREIGNKEY/i.test(type)) return c.json({ error: 'Selected agent is not registered' }, 400);
  console.warn('D1_PROPERTY_MUTATION_FAILED');
  return c.json({ error: 'Could not save property' }, 503);
}
async function body(c: Ctx): Promise<unknown> {
  try { return await readBoundedJson(c.req.raw); }
  catch { return null; }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validId(id: string | undefined): id is string { return !!id && uuid.test(id); }

/** A successful save must consume its observed revision, even within one clock tick. */
export function nextPropertyRevision(previous: string, now = Date.now()): string {
  const previousTime = Date.parse(previous);
  if (!Number.isFinite(previousTime) || new Date(previousTime).toISOString() !== previous ||
      !Number.isSafeInteger(now)) throw new Error('Invalid property revision timestamp');
  return new Date(Math.max(now, previousTime + 1)).toISOString();
}

propertyAdmin.options('/v1/admin/properties/*', c => {
  if (c.req.header('Origin') !== c.env.ALLOWED_ORIGIN) return c.json({ error: 'Origin forbidden' }, 403);
  c.header('Access-Control-Allow-Origin', c.env.ALLOWED_ORIGIN);
  c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  c.header('Access-Control-Max-Age', '300');
  c.header('Vary', 'Origin');
  return c.body(null, 204);
});
propertyAdmin.options('/v1/admin/properties', c => {
  if (c.req.header('Origin') !== c.env.ALLOWED_ORIGIN) return c.json({ error: 'Origin forbidden' }, 403);
  c.header('Access-Control-Allow-Origin', c.env.ALLOWED_ORIGIN);
  c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  c.header('Access-Control-Max-Age', '300');
  return c.body(null, 204);
});
propertyAdmin.options('/v1/admin/media/*', c => {
  if (c.req.header('Origin') !== c.env.ALLOWED_ORIGIN) return c.json({ error: 'Origin forbidden' }, 403);
  c.header('Access-Control-Allow-Origin', c.env.ALLOWED_ORIGIN);
  c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  c.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  c.header('Access-Control-Max-Age', '300');
  c.header('Vary', 'Origin');
  return c.body(null, 204);
});

// Read-only status of the scheduled R2 orphan sweep. Maintenance insight only:
// it never accepts a request to run or delete anything.
propertyAdmin.get('/v1/admin/media/sweep', async c => {
  const staff = await authorized(c);
  if (!staff.ok) return c.json({ error: staff.error }, staff.status);
  if (staff.role !== 'ADMIN')
    return c.json({ error: 'Only approved administrators may inspect media maintenance' }, 403);
  const row = await c.env.DB.prepare('SELECT value_json FROM settings WHERE key = ?')
    .bind(SWEEP_STATUS_KEY).first<{ value_json: string }>();
  let status: unknown = null;
  if (row && typeof row.value_json === 'string') {
    try { status = JSON.parse(row.value_json); } catch { status = null; }
  }
  return c.json({ data: status, enabled: c.env.MEDIA_SWEEP_ENABLED === 'true' });
});

// Staff can preview a draft without granting anonymous access to the R2 object.
// Keep the property/media pairing explicit so an editor cannot reuse another
// property's image URL. Every read checks live Firebase account and D1 role state.
propertyAdmin.get('/v1/admin/properties/:id/media/:mediaId', async c => {
  const staff = await authorized(c);
  if (!staff.ok) return c.json({ error: staff.error }, staff.status);
  const id = c.req.param('id'), mediaId = c.req.param('mediaId');
  if (!validId(id) || !validId(mediaId)) return c.json({ error: 'Not found' }, 404);
  const [file] = await drizzle(c.env.DB).select({
    key: propertyMedia.objectKey, type: propertyMedia.contentType,
  }).from(propertyMedia).innerJoin(properties, eq(propertyMedia.propertyId, properties.id))
    .where(and(eq(properties.id, id), eq(propertyMedia.id, mediaId), isNull(properties.deletedAt))).limit(1);
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    return c.json({ error: 'Not found' }, 404);
  const object = await c.env.PROPERTY_MEDIA.get(file.key);
  if (!object || !('body' in object)) return c.json({ error: 'Not found' }, 404);
  return new Response(object.body, { headers: {
    'Content-Type': file.type,
    'Content-Disposition': 'inline',
    'Content-Length': String(object.size),
    'Cache-Control': 'private, no-store',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-site',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  } });
});

propertyAdmin.get('/v1/admin/properties', async c => {
  const staff = await authorized(c);
  if (!staff.ok) return c.json({ error: staff.error }, staff.status);
  const parsed = parseAdminQuery(new URL(c.req.url).searchParams);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const query = parsed.value;
  const base = [isNull(properties.deletedAt)];
  if (query.type) base.push(eq(properties.propertyType, query.type as (typeof properties.$inferSelect)['propertyType']));
  if (query.filter === 'sale' || query.filter === 'rent') base.push(eq(properties.status, query.filter));
  if (query.filter === 'featured') base.push(eq(properties.featured, true));
  if (query.filter === 'draft') base.push(eq(properties.published, false));
  if (query.filter === 'published') base.push(eq(properties.published, true));
  if (query.district) base.push(eq(properties.district, query.district));
  if (query.searchQuery) {
    const needle = query.searchQuery.toLowerCase();
    base.push(or(
      sql`instr(lower(${properties.title}), ${needle}) > 0`,
      sql`instr(lower(${properties.district}), ${needle}) > 0`,
      sql`instr(lower(${properties.id}), ${needle}) > 0`,
      sql`instr(lower(${properties.code}), ${needle}) > 0`,
    )!);
  }
  const predicates = [...base];
  if (query.cursor) {
    const cursor = query.cursor;
    const newestAfter = or(lt(properties.createdAt, cursor.createdAt),
      and(eq(properties.createdAt, cursor.createdAt), lt(properties.id, cursor.id)))!;
    const oldestAfter = or(gt(properties.createdAt, cursor.createdAt),
      and(eq(properties.createdAt, cursor.createdAt), gt(properties.id, cursor.id)))!;
    if (query.sortBy === 'newest') predicates.push(newestAfter);
    else if (query.sortBy === 'oldest') predicates.push(oldestAfter);
    else if (query.sortBy === 'price_desc') predicates.push(
      or(lt(properties.price, query.sortValue!), and(eq(properties.price, query.sortValue!), newestAfter))!);
    else if (query.sortBy === 'price_asc') predicates.push(
      or(gt(properties.price, query.sortValue!), and(eq(properties.price, query.sortValue!), newestAfter))!);
    else predicates.push(
      or(lt(properties.usableArea, query.sortValue!), and(eq(properties.usableArea, query.sortValue!), newestAfter))!);
  }
  const order = query.sortBy === 'newest' ? [desc(properties.createdAt), desc(properties.id)]
    : query.sortBy === 'oldest' ? [asc(properties.createdAt), asc(properties.id)]
    : query.sortBy === 'price_desc' ? [desc(properties.price), desc(properties.createdAt), desc(properties.id)]
    : query.sortBy === 'price_asc' ? [asc(properties.price), desc(properties.createdAt), desc(properties.id)]
    : [desc(properties.usableArea), desc(properties.createdAt), desc(properties.id)];
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(properties)
    .where(and(...predicates)).orderBy(...order).limit(query.limit + 1);
  const visible = rows.slice(0, query.limit);
  // Per-tab counts use the same search/type/district scope but ignore the active
  // tab and cursor, so the Admin UI can render badge numbers without loading all rows.
  const countRows = await db.select({
    published: properties.published,
    status: properties.status,
    featured: properties.featured,
    total: sql<number>`count(*)`,
  }).from(properties).where(and(...base))
    .groupBy(properties.published, properties.status, properties.featured);
  const counts = { all: 0, sale: 0, rent: 0, featured: 0, draft: 0, published: 0 };
  for (const row of countRows) {
    const amount = Number(row.total);
    counts.all += amount;
    counts[row.status] += amount;
    if (row.featured) counts.featured += amount;
    if (row.published) counts.published += amount;
    else counts.draft += amount;
  }
  const m = await mediaForRows(db, visible);
  const last = visible.at(-1);
  return c.json({
    data: visible.map(row => toEditorProperty(row, m.get(row.id) || [], true)),
    next_cursor: rows.length > query.limit && last ? adminCursor(last, query.sortBy) : null,
    total: counts.all,
    counts,
  });
});

propertyAdmin.get('/v1/admin/properties/:id', async c => {
  const staff = await authorized(c);
  if (!staff.ok) return c.json({ error: staff.error }, staff.status);
  const id = c.req.param('id');
  if (!validId(id)) return c.json({ error: 'Property not found' }, 404);
  const db = drizzle(c.env.DB);
  const [row] = await db.select().from(properties)
    .where(and(eq(properties.id, id), isNull(properties.deletedAt))).limit(1);
  if (!row) return c.json({ error: 'Property not found' }, 404);
  const m = await mediaForRows(db, [row]);
  return c.json({ data: toEditorProperty(row, m.get(id) || [], true) });
});

propertyAdmin.post('/v1/admin/properties', async c => {
  const staff = await authorized(c, true);
  if (!staff.ok) return c.json({ error: staff.error }, staff.status);
  const input = parseEditorInput(await body(c));
  if (!input.ok) return c.json({ error: input.error }, 400);
  const parsed = input.fields;
  const db = drizzle(c.env.DB);
  const now = new Date().toISOString();
  const identity = newPropertyIdentity(crypto.randomUUID());
  try {
    const mutation = db.insert(properties).values({
      ...parsed,
      id: identity.id, code: identity.code, createdAt: now, updatedAt: now,
      // Initial entry is a draft regardless of any client-supplied flag.
      // Explicit publication requires a separate reviewed PATCH action.
      published: false,
    } as typeof properties.$inferInsert).toSQL();
    await auditedMutation(c.env.DB, mutation, staff.uid, 'created', identity.id);
    const [row] = await db.select().from(properties).where(eq(properties.id, identity.id)).limit(1);
    return c.json({ data: toEditorProperty(row, [], true) }, 201);
  } catch (error) { return routeError(error, c); }
});

propertyAdmin.patch('/v1/admin/properties/:id', async c => {
  const staff = await authorized(c, true);
  if (!staff.ok) return c.json({ error: staff.error }, staff.status);
  const id = c.req.param('id');
  if (!validId(id)) return c.json({ error: 'Invalid property ID' }, 400);
  const input = await body(c);
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return c.json({ error: 'Invalid property update payload' }, 400);
  const reqBody = input as Record<string, unknown>;
  if (Object.keys(reqBody).some(k => !['updates', 'expected_updated_at', 'cover_media_id'].includes(k)))
    return c.json({ error: 'Unexpected update field' }, 400);
  const expected = reqBody.expected_updated_at;
  if (typeof expected !== 'string' || !/^\d{4}-\d\d-\d\dT.*Z$/.test(expected))
    return c.json({ error: 'expected_updated_at is required' }, 400);
  const parsed = parseEditorInput(reqBody.updates, true);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  if (parsed.fields.published === true && c.env.PROPERTY_PUBLICATION_ENABLED !== 'true')
    return c.json({ error: 'Publication is disabled until public catalog cutover' }, 503);
  const db = drizzle(c.env.DB);
  const [current] = await db.select().from(properties)
    .where(and(eq(properties.id, id), isNull(properties.deletedAt))).limit(1);
  if (!current) return c.json({ error: 'Property not found' }, 404);
  if (current.updatedAt !== expected)
    return c.json({ error: 'This listing has changed; reload before editing' }, 409);
  const coverRequested = Object.prototype.hasOwnProperty.call(reqBody, 'cover_media_id');
  let coverImage: string | null | undefined;
  if (coverRequested) {
    const mid = reqBody.cover_media_id;
    if (mid !== null && (typeof mid !== 'string' || !uuid.test(mid)))
      return c.json({ error: 'Invalid cover_media_id' }, 400);
    if (mid === null) coverImage = null;
    else {
      const [image] = await db.select({ id: propertyMedia.id }).from(propertyMedia)
        .where(and(eq(propertyMedia.id, mid as string), eq(propertyMedia.propertyId, id))).limit(1);
      if (!image) return c.json({ error: 'Cover image does not belong to this property' }, 400);
      coverImage = publicMediaPath(image.id);
    }
  }
  const changes = { ...parsed.fields, ...(coverRequested ? { coverImage } : {}) };
  if (!Object.keys(changes).length) return c.json({ error: 'Nothing to update' }, 400);
  // Optimistic lock prevents simultaneous edits from silently overwriting one another.
  const now = nextPropertyRevision(current.updatedAt);
  try {
    const mutation = db.update(properties).set({ ...changes, updatedAt: now })
      .where(and(eq(properties.id, id), eq(properties.updatedAt, expected), isNull(properties.deletedAt)))
      .returning({ id: properties.id }).toSQL();
    const result = await auditedMutation(c.env.DB, mutation, staff.uid, 'updated', id);
    if (!result.results.length) return c.json({ error: 'Listing changed during save' }, 409);
    const [row] = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
    const media = await mediaForRows(db, [row]);
    return c.json({ data: toEditorProperty(row, media.get(row.id) || [], true) });
  } catch (error) { return routeError(error, c); }
});

propertyAdmin.delete('/v1/admin/properties/:id', async c => {
  const staff = await authorized(c, true);
  if (!staff.ok) return c.json({ error: staff.error }, staff.status);
  const id = c.req.param('id');
  if (!validId(id)) return c.json({ error: 'Invalid property ID' }, 400);
  const input = await body(c);
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).length !== 1 || !('expected_updated_at' in input))
    return c.json({ error: 'Expected revision required' }, 400);
  const expected = (input as { expected_updated_at: unknown }).expected_updated_at;
  if (typeof expected !== 'string') return c.json({ error: 'Expected revision required' }, 400);
  const db = drizzle(c.env.DB);
  try {
    const now = new Date().toISOString();
    const mutation = db.update(properties).set({
      deletedAt: now, published: false, updatedAt: now,
    }).where(and(eq(properties.id, id), eq(properties.updatedAt, expected), isNull(properties.deletedAt)))
      .returning({ id: properties.id }).toSQL();
    const result = await auditedMutation(c.env.DB, mutation, staff.uid, 'soft_deleted', id);
    if (!result.results.length) return c.json({ error: 'Property not found or revision changed' }, 409);
    return c.json({ ok: true });
  } catch (error) { return routeError(error, c); }
});

export default propertyAdmin;
