import { Hono, type Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq, sql, isNull } from 'drizzle-orm';
import { inquiryMedia, inquiries, properties, propertyMedia } from './db/schema.ts';
import { authorizePropertyStaff } from './property-auth.ts';
import {
  MAX_INQUIRY_IMAGES, MAX_PROPERTY_IMAGES, mediaExtension,
  readBoundedImage, validBrowserOrigin, validMediaId, validOwnerId,
} from './media-validation.ts';

type Env = {
  DB: D1Database;
  PROPERTY_MEDIA: R2Bucket; // Must stay PRIVATE at the bucket origin: draft files exist here.
  PRIVATE_MEDIA: R2Bucket;  // NEVER enable public bucket access.
  ALLOWED_ORIGIN: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_WEB_API_KEY?: string;
  MEDIA_WRITES_ENABLED?: string; // OFF by default; image and abuse validation gates remain.
};
type Staff = { uid: string; role: 'ADMIN' | 'AGENT' };
type StaffCheck = { staff: Staff } | { status: 401 | 403 | 503; error: string };

async function requireStaff(env: Env, auth: string | undefined): Promise<StaffCheck> {
  const result = await authorizePropertyStaff(env, auth, true);
  if (!result.ok) return { status: result.status, error: result.error };
  return { staff: { uid: result.uid, role: result.role } };
}

const media = new Hono<{ Bindings: Env }>();

// Browser CORS preflight for authenticated image uploads/reads.
media.options('/v1/media/*', c => {
  if (!validBrowserOrigin(c.req.header('Origin') ?? null, c.env.ALLOWED_ORIGIN))
    return c.json({ error: 'Forbidden origin' }, 403);
  c.header('Access-Control-Allow-Origin', c.env.ALLOWED_ORIGIN);
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Content-Length');
  c.header('Access-Control-Max-Age', '300');
  c.header('Vary', 'Origin');
  return c.body(null, 204);
});

function objectHeaders(type: string, etag: string, isPrivate: boolean): Headers {
  const headers = new Headers({
    'Content-Type': type,
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': isPrivate ? 'same-site' : 'cross-origin',
    'Cache-Control': isPrivate ? 'private, no-store' : 'public, max-age=86400, s-maxage=86400',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  });
  if (etag) headers.set('ETag', etag);
  return headers;
}

// Public objects are only served if a referenced property is currently PUBLISHED.
// Never enable public R2 custom-domain access to this bucket: it also contains draft photos.
media.get('/v1/media/properties/:mediaId', async c => {
  const mediaId = c.req.param('mediaId');
  if (!validMediaId(mediaId)) return c.json({ error: 'Not found' }, 404);
  const [row] = await drizzle(c.env.DB).select({
    key: propertyMedia.objectKey, type: propertyMedia.contentType,
  }).from(propertyMedia).innerJoin(properties, eq(propertyMedia.propertyId, properties.id))
    .where(and(eq(propertyMedia.id, mediaId), eq(properties.published, true), isNull(properties.deletedAt))).limit(1);
  if (!row) return c.json({ error: 'Not found' }, 404);
  const object = await c.env.PROPERTY_MEDIA.get(row.key);
  if (!object || !('body' in object)) return c.json({ error: 'Not found' }, 404);
  // Don't allow a stale edge response to linger across unpublish; short TTL until
  // asset promotion/versioned public-only bucket is implemented.
  const headers = objectHeaders(row.type, object.httpEtag, false);
  headers.set('Cache-Control', 'public, max-age=30, s-maxage=30');
  return new Response(object.body, { status: 200, headers });
});

// Customer images NEVER have an anonymous delivery route.
media.get('/v1/media/inquiries/:mediaId', async c => {
  const mediaId = c.req.param('mediaId');
  c.header('Cache-Control', 'private, no-store');
  if (!validMediaId(mediaId)) return c.json({ error: 'Not found' }, 404);
  const allowed = await requireStaff(c.env, c.req.header('Authorization'));
  if (!('staff' in allowed)) return c.json({ error: allowed.error }, allowed.status);

  const [row] = await drizzle(c.env.DB).select({
    key: inquiryMedia.objectKey, type: inquiryMedia.contentType,
  }).from(inquiryMedia).where(eq(inquiryMedia.id, mediaId)).limit(1);
  if (!row) return c.json({ error: 'Not found' }, 404);
  const object = await c.env.PRIVATE_MEDIA.get(row.key);
  if (!object || !('body' in object)) return c.json({ error: 'Not found' }, 404);
  return new Response(object.body, { status: 200, headers: objectHeaders(row.type, object.httpEtag, true) });
});

async function upload(c: Context<{ Bindings: Env }>, kind: 'property' | 'inquiry') {
  c.header('Cache-Control', 'private, no-store');
  // Controlled rollout: never allow production writes merely from a JWT.
  if (c.env.MEDIA_WRITES_ENABLED !== 'true') return c.json({ error: 'Media uploads are disabled' }, 503);
  if (!validBrowserOrigin(c.req.header('Origin') ?? null, c.env.ALLOWED_ORIGIN)) {
    return c.json({ error: 'Forbidden origin' }, 403);
  }
  const allowed = await requireStaff(c.env, c.req.header('Authorization'));
  if (!('staff' in allowed)) return c.json({ error: allowed.error }, allowed.status);

  if (kind === 'property' && allowed.staff.role !== 'ADMIN')
    return c.json({ error: 'Only approved administrators may change property images' }, 403);

  const ownerId = c.req.param('ownerId') ?? '';
  if (!validOwnerId(ownerId)) return c.json({ error: 'Invalid owner ID' }, 400);
  const database = drizzle(c.env.DB);
  if (kind === 'property') {
    const [owner] = await database.select({ id: properties.id }).from(properties)
      .where(and(eq(properties.id, ownerId), isNull(properties.deletedAt))).limit(1);
    if (!owner) return c.json({ error: 'Property not found' }, 404);
  } else {
    const [owner] = await database.select({ id: inquiries.id }).from(inquiries)
      .where(eq(inquiries.id, ownerId)).limit(1);
    if (!owner) return c.json({ error: 'Inquiry not found' }, 404);
  }
  const limit = kind === 'property' ? MAX_PROPERTY_IMAGES : MAX_INQUIRY_IMAGES;
  const [count] = kind === 'property'
    ? await database.select({ total: sql<number>`count(*)` }).from(propertyMedia).where(eq(propertyMedia.propertyId, ownerId))
    : await database.select({ total: sql<number>`count(*)` }).from(inquiryMedia).where(eq(inquiryMedia.inquiryId, ownerId));
  if (Number(count?.total || 0) >= limit)
    return c.json({ error: 'Too many images for this record' }, 429);

  const checked = await readBoundedImage(c.req.raw);
  if (!checked.ok) return c.json({ error: checked.error }, checked.status);

  const id = crypto.randomUUID();
  const objectKey = `${kind === 'property' ? 'properties' : 'inquiries'}/${ownerId}/${id}.${mediaExtension(checked.type)}`;
  const bucket = kind === 'property' ? c.env.PROPERTY_MEDIA : c.env.PRIVATE_MEDIA;
  // Trust only validated content type/bytes; do not persist user-provided filenames.
  const put = await bucket.put(objectKey, checked.bytes, {
    httpMetadata: { contentType: checked.type },
  });
  if (!put) return c.json({ error: 'Could not save image' }, 503);
  try {
    const createdAt = new Date().toISOString();
    // The quota check and insert are one SQLite statement. Concurrent requests
    // cannot both claim the last slot. Recheck parent state after the R2 write.
    const inserted = kind === 'property'
      ? await c.env.DB.prepare(`INSERT INTO property_media
          (id, property_id, object_key, public_url, content_type, byte_size, sort_order, created_at)
          SELECT ?, ?, ?, ?, ?, ?, COALESCE(MAX(sort_order), -1) + 1, ?
          FROM property_media WHERE property_id = ? HAVING COUNT(*) < ?
          AND EXISTS (SELECT 1 FROM properties WHERE id = ? AND deleted_at IS NULL)`)
        .bind(id, ownerId, objectKey, `/v1/media/properties/${id}`, checked.type,
          checked.bytes.byteLength, createdAt, ownerId, limit, ownerId).run()
      : await c.env.DB.prepare(`INSERT INTO inquiry_media
          (id, inquiry_id, object_key, content_type, byte_size, created_at)
          SELECT ?, ?, ?, ?, ?, ? WHERE
          (SELECT COUNT(*) FROM inquiry_media WHERE inquiry_id = ?) < ?
          AND EXISTS (SELECT 1 FROM inquiries WHERE id = ?)`)
        .bind(id, ownerId, objectKey, checked.type, checked.bytes.byteLength,
          createdAt, ownerId, limit, ownerId).run();
    if (!inserted.meta.changes) {
      try { await bucket.delete(objectKey); } catch { console.warn('R2_MEDIA_ORPHAN_CLEANUP_REQUIRED'); }
      return c.json({ error: 'Image limit reached or record no longer available' }, 409);
    }
  } catch {
    // Best-effort compensation after database failure.
    try { await bucket.delete(objectKey); } catch { console.warn('R2_MEDIA_ORPHAN_CLEANUP_REQUIRED'); }
    return c.json({ error: 'Could not record image metadata' }, 503);
  }
  return c.json({
    media_id: id,
    media_path: `/v1/media/${kind === 'property' ? 'properties' : 'inquiries'}/${id}`,
  }, 201);
}

// Staging-only writes, opt-in via MEDIA_WRITES_ENABLED=true and server-controlled D1 roles.
// No customer-origin anonymous uploads are provided in this PR.
media.post('/v1/media/properties/:ownerId', c => upload(c, 'property'));
media.post('/v1/media/inquiries/:ownerId', c => upload(c, 'inquiry'));

export default media;
