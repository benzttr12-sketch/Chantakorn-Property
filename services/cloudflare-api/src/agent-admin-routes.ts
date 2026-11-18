import { Hono } from 'hono';
import { asc, gt } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { agents } from './db/schema.ts';
import { authorizePropertyStaff, type PropertyAuthEnv } from './property-auth.ts';
import { matchAllowedOrigin } from './media-validation.ts';

const agentAdmin = new Hono<{ Bindings: PropertyAuthEnv }>();

agentAdmin.options('/v1/admin/agents', c => {
  if (!matchAllowedOrigin(c.req.header('Origin') ?? null, c.env.ALLOWED_ORIGIN))
    return c.json({ error: 'Forbidden origin' }, 403);
  c.header('Access-Control-Allow-Headers', 'Authorization');
  c.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  c.header('Access-Control-Max-Age', '300');
  return c.body(null, 204);
});

/** The property picker must use actual agents.id values, not Firebase profile UIDs.
 * This is a staff-only catalog projection; it never creates or grants staff roles. */
agentAdmin.get('/v1/admin/agents', async c => {
  c.header('Cache-Control', 'private, no-store');
  const staff = await authorizePropertyStaff(c.env, c.req.header('Authorization'), true);
  if (!staff.ok) return c.json({ error: staff.error }, staff.status);
  const query = new URL(c.req.url).searchParams;
  for (const key of query.keys()) {
    if (!['limit', 'cursor'].includes(key) || query.getAll(key).length !== 1)
      return c.json({ error: 'Invalid agent query' }, 400);
  }
  const rawLimit = query.get('limit') ?? '100';
  const limit = Number(rawLimit);
  const cursor = query.get('cursor');
  if (!/^[1-9]\d{0,2}$/.test(rawLimit) || limit > 100 ||
      (cursor !== null && !/^[A-Za-z0-9_-]{1,96}$/.test(cursor)))
    return c.json({ error: 'Invalid agent query' }, 400);
  const rows = await drizzle(c.env.DB).select({
    id: agents.id, name: agents.name, title: agents.title,
    phone: agents.phone, line_id: agents.lineId, facebook: agents.facebook,
    email: agents.email, photo_url: agents.photoUrl, bio: agents.bio,
    is_public: agents.isPublic,
  }).from(agents).where(cursor ? gt(agents.id, cursor) : undefined)
    .orderBy(asc(agents.id)).limit(limit + 1);
  const visible = rows.slice(0, limit);
  return c.json({
    data: visible,
    next_cursor: rows.length > limit ? visible.at(-1)!.id : null,
  });
});

export default agentAdmin;
