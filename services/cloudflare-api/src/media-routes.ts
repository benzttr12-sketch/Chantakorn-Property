import { Hono, type Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq, sql, isNull } from 'drizzle-orm';
import { inquiryMedia, inquiries, properties, propertyMedia } from './db/schema.ts';
import { authorizePropertyStaff } from './property-auth.ts';
import {
  MAX_INQUIRY_IMAGES, MAX_PROPERTY_IMAGES, mediaExtension,
  readBoundedImage, validBrowserOrigin, validMediaId, validOwnerId,
} from './media-validation.ts';
import { validateImageStructure } from './media-image-structure.ts';

type Env = {
  DB: D1Database;
  PROPERTY_MEDIA: R2Bucket; // Must stay PRIVATE at the bucket origin: draft files exist here.
  PRIVATE_MEDIA: R2Bucket;  // NEVER enable public bucket access.
  ALLOWED_ORIGIN: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_WEB_API_KEY?: string;
  MEDIA_WRITES_ENABLED?: string; // OFF by default; image and abuse validation gates remain.
  MEDIA_UPLOAD_SESSIONS_REQUIRED?: string; // Require a short-lived session header for property uploads.
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
  c.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Content-Length, X-Upload-Session');
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
  // Each request must recheck publication. Browser/CDN caches cannot bypass it.
  const headers = objectHeaders(row.type, object.httpEtag, false);
  headers.set('Cache-Control', 'no-store');
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
  const sessionId = kind === 'property' ? c.req.header('X-Upload-Session') : undefined;
  if (kind === 'property') {
    if (sessionId === undefined) {
      if (c.env.MEDIA_UPLOAD_SESSIONS_REQUIRED === 'true')
        return c.json({ error: 'Upload session required' }, 400);
    } else if (!validMediaId(sessionId)) {
      return c.json({ error: 'Invalid upload session' }, 400);
    }
  }
  const allowed = await requireStaff(c.env, c.req.header('Authorization'));
  if (!('staff' in allowed)) return c.json({ error: allowed.error }, allowed.status);

  if (kind === 'property' && allowed.staff.role !== 'ADMIN')
    return c.json({ error: 'Only approved administrators may change property images' }, 403);

  const ownerId = c.req.param('ownerId') ?? '';
  if (!validOwnerId(ownerId)) return c.json({ error: 'Invalid owner ID' }, 400);
  const database = drizzle(c.env.DB);
  if (kind === 'property') {
    const [owner] = await database.select({ id: properties.id, published: properties.published }).from(properties)
      .where(and(eq(properties.id, ownerId), isNull(properties.deletedAt))).limit(1);
    if (!owner) return c.json({ error: 'Property not found' }, 404);
    // Uploads attach to the gallery immediately. Require an unpublished parent
    // so a later failed editor save cannot expose unreviewed images publicly.
    if (owner.published) return c.json({ error: 'Unpublish the property before uploading images' }, 409);
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
  // Container-level validation only; the browser canvas compressor is what
  // guarantees metadata-free pixels, direct uploads may be rejected instead.
  const structure = await validateImageStructure(checked.bytes, checked.type);
  if (!structure.ok) return c.json({ error: structure.error }, structure.status);

  // Property uploads may bind to a short-lived session so a leaked bearer token
  // cannot upload unbounded files to an unrelated draft. Consume one slot before
  // the R2 write and release it if the upload is rejected afterwards.
  let consumedSession = false;
  const releaseSession = async () => {
    if (!consumedSession || !sessionId) return;
    consumedSession = false;
    try {
      await c.env.DB.prepare(`UPDATE media_upload_sessions SET used_uploads = MAX(used_uploads - 1, 0) WHERE id = ?`)
        .bind(sessionId).run();
    } catch { /* the expired-session sweep removes the row anyway */ }
  };
  if (kind === 'property' && sessionId) {
    const consumed = await c.env.DB.prepare(`UPDATE media_upload_sessions SET used_uploads = used_uploads + 1
        WHERE id = ? AND owner_id = ? AND created_by = ? AND expires_at > ? AND used_uploads < max_uploads`)
      .bind(sessionId, ownerId, allowed.staff.uid, new Date().toISOString()).run();
    if (!consumed.meta.changes)
      return c.json({ error: 'Upload session is invalid, expired or exhausted' }, 409);
    consumedSession = true;
  }

  const id = crypto.randomUUID();
  const objectKey = `${kind === 'property' ? 'properties' : 'inquiries'}/${ownerId}/${id}.${mediaExtension(checked.type)}`;
  const bucket = kind === 'property' ? c.env.PROPERTY_MEDIA : c.env.PRIVATE_MEDIA;
  // Trust only validated content type/bytes; do not persist user-provided filenames.
  const put = await bucket.put(objectKey, checked.bytes, {
    httpMetadata: { contentType: checked.type },
  });
  if (!put) {
    await releaseSession();
    return c.json({ error: 'Could not save image' }, 503);
  }
  try {
    const createdAt = new Date().toISOString();
    // The quota check and insert are one SQLite statement. Concurrent requests
    // cannot both claim the last slot. Recheck draft/parent state after the R2
    // write so publication racing with this upload cannot expose the new image.
    const inserted = kind === 'property'
      ? await c.env.DB.prepare(`INSERT INTO property_media
          (id, property_id, object_key, public_url, content_type, byte_size, sort_order, created_at)
          SELECT ?, ?, ?, ?, ?, ?, COALESCE(MAX(sort_order), -1) + 1, ?
          FROM property_media WHERE property_id = ? HAVING COUNT(*) < ?
          AND EXISTS (SELECT 1 FROM properties WHERE id = ? AND deleted_at IS NULL AND published = 0)`)
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
      await releaseSession();
      try { await bucket.delete(objectKey); } catch { console.warn('R2_MEDIA_ORPHAN_CLEANUP_REQUIRED'); }
      return c.json({ error: 'Image limit reached or record no longer available' }, 409);
    }
  } catch {
    await releaseSession();
    // Best-effort compensation after database failure.
    try { await bucket.delete(objectKey); } catch { console.warn('R2_MEDIA_ORPHAN_CLEANUP_REQUIRED'); }
    return c.json({ error: 'Could not record image metadata' }, 503);
  }
  return c.json({
    media_id: id,
    media_path: `/v1/media/${kind === 'property' ? 'properties' : 'inquiries'}/${id}`,
  }, 201);
}

const UPLOAD_SESSION_TTL_MS = 10 * 60 * 1000;
const UPLOAD_SESSION_MAX_FILES = 20;

// Short-lived, property-scoped upload intent. The client requests one session for
// a batch of photos instead of holding a broad bearer-only upload path; each
// accepted upload consumes one slot (see upload()). Sessions never contain bytes.
media.post('/v1/media/properties/:ownerId/sessions', async c => {
  c.header('Cache-Control', 'private, no-store');
  if (c.env.MEDIA_WRITES_ENABLED !== 'true') return c.json({ error: 'Media uploads are disabled' }, 503);
  if (!validBrowserOrigin(c.req.header('Origin') ?? null, c.env.ALLOWED_ORIGIN))
    return c.json({ error: 'Forbidden origin' }, 403);
  const allowed = await requireStaff(c.env, c.req.header('Authorization'));
  if (!('staff' in allowed)) return c.json({ error: allowed.error }, allowed.status);
  if (allowed.staff.role !== 'ADMIN')
    return c.json({ error: 'Only approved administrators may change property images' }, 403);

  const ownerId = c.req.param('ownerId') ?? '';
  if (!validOwnerId(ownerId)) return c.json({ error: 'Invalid owner ID' }, 400);
  const rawUploads = new URL(c.req.url).searchParams.get('uploads');
  if (rawUploads === null || !/^\d{1,2}$/.test(rawUploads) ||
      Number(rawUploads) < 1 || Number(rawUploads) > UPLOAD_SESSION_MAX_FILES)
    return c.json({ error: `Uploads must be from 1 to ${UPLOAD_SESSION_MAX_FILES}` }, 400);
  const requested = Number(rawUploads);
  const database = drizzle(c.env.DB);
  const [owner] = await database.select({ published: properties.published }).from(properties)
    .where(and(eq(properties.id, ownerId), isNull(properties.deletedAt))).limit(1);
  if (!owner) return c.json({ error: 'Property not found' }, 404);
  if (owner.published) return c.json({ error: 'Unpublish the property before uploading images' }, 409);
  const [count] = await database.select({ total: sql<number>`count(*)` }).from(propertyMedia)
    .where(eq(propertyMedia.propertyId, ownerId));
  const remaining = MAX_PROPERTY_IMAGES - Number(count?.total || 0);
  if (remaining <= 0) return c.json({ error: 'Too many images for this record' }, 429);
  if (requested > remaining) return c.json({ error: `Only ${remaining} image slots remain` }, 400);

  const now = new Date();
  const id = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + UPLOAD_SESSION_TTL_MS).toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM media_upload_sessions WHERE expires_at <= ?').bind(now.toISOString()),
    c.env.DB.prepare(`INSERT INTO media_upload_sessions
        (id, owner_id, created_by, created_at, expires_at, max_uploads, used_uploads)
        VALUES (?, ?, ?, ?, ?, ?, 0)`)
      .bind(id, ownerId, allowed.staff.uid, now.toISOString(), expiresAt, requested),
  ]);
  return c.json({ session_id: id, owner_id: ownerId, expires_at: expiresAt, max_uploads: requested }, 201);
});

// Staging-only writes, opt-in via MEDIA_WRITES_ENABLED=true and server-controlled D1 roles.
// No customer-origin anonymous uploads are provided in this PR.
media.post('/v1/media/properties/:ownerId', c => upload(c, 'property'));
media.post('/v1/media/inquiries/:ownerId', c => upload(c, 'inquiry'));

// Draft-only photo removal. The metadata row is deleted first so a failed R2
// delete can never leave a listing pointing at a missing object; the leftover
// object is recorded for the bounded orphan sweep instead.
media.delete('/v1/media/properties/:ownerId/:mediaId', async c => {
  c.header('Cache-Control', 'private, no-store');
  if (c.env.MEDIA_WRITES_ENABLED !== 'true') return c.json({ error: 'Media writes are disabled' }, 503);
  if (!validBrowserOrigin(c.req.header('Origin') ?? null, c.env.ALLOWED_ORIGIN)) {
    return c.json({ error: 'Forbidden origin' }, 403);
  }
  const allowed = await requireStaff(c.env, c.req.header('Authorization'));
  if (!('staff' in allowed)) return c.json({ error: allowed.error }, allowed.status);
  if (allowed.staff.role !== 'ADMIN')
    return c.json({ error: 'Only approved administrators may change property images' }, 403);

  const ownerId = c.req.param('ownerId') ?? '';
  const mediaId = c.req.param('mediaId') ?? '';
  if (!validOwnerId(ownerId) || !validMediaId(mediaId))
    return c.json({ error: 'Invalid media reference' }, 400);

  const publicPath = `/v1/media/properties/${mediaId}`;
  const [row] = await drizzle(c.env.DB).select({
    key: propertyMedia.objectKey, published: properties.published, coverImage: properties.coverImage,
  }).from(propertyMedia).innerJoin(properties, eq(propertyMedia.propertyId, properties.id))
    .where(and(eq(propertyMedia.id, mediaId), eq(propertyMedia.propertyId, ownerId),
      isNull(properties.deletedAt))).limit(1);
  if (!row) return c.json({ error: 'Image not found' }, 404);
  if (row.published) return c.json({ error: 'Unpublish the property before removing images' }, 409);
  if (row.coverImage === publicPath)
    return c.json({ error: 'Choose a different cover before removing the cover photo' }, 409);

  // Re-check the draft state and cover in the deleting statement itself so a
  // concurrent publication or cover change cannot remove a now-public photo.
  const deleted = await c.env.DB.prepare(`DELETE FROM property_media
      WHERE id = ? AND property_id = ?
      AND EXISTS (SELECT 1 FROM properties WHERE id = ? AND deleted_at IS NULL
        AND published = 0 AND (cover_image IS NULL OR cover_image <> ?))`)
    .bind(mediaId, ownerId, ownerId, publicPath).run();
  if (!deleted.meta.changes)
    return c.json({ error: 'Listing changed; reload before removing photos' }, 409);

  try {
    await c.env.PROPERTY_MEDIA.delete(row.key);
  } catch {
    console.warn('R2_MEDIA_ORPHAN_CLEANUP_REQUIRED');
    return c.json({ ok: true, media_id: mediaId, object_deleted: false }, 202);
  }
  return c.json({ ok: true, media_id: mediaId, object_deleted: true });
});

export default media;
