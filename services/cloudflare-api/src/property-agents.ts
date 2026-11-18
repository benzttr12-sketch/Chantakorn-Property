import { and, inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { agents } from './db/schema.ts';

const contactFields = {
  id: agents.id, name: agents.name, title: agents.title,
  phone: agents.phone, line_id: agents.lineId, facebook: agents.facebook,
  email: agents.email, photo_url: agents.photoUrl, bio: agents.bio,
};
export type CatalogAgent = {
  id: string; name: string; title: string; phone: string; line_id: string;
  facebook: string; email: string; photo_url: string; bio: string;
  is_public?: boolean;
};

/** Resolve at most one page of canonical agent contacts in one indexed query.
 * Public listings honor is_public; staff can still inspect a hidden assignment.
 * Profile UIDs and authorization roles never enter the payload. Only staff
 * responses carry the visibility flag so public marketing can omit hidden contacts.
 */
export async function agentsForRows(
  db: ReturnType<typeof drizzle>, rows: ReadonlyArray<{ agentId: string | null }>, publicOnly = false,
): Promise<Map<string, CatalogAgent>> {
  const ids = [...new Set(rows.flatMap(row => row.agentId ? [row.agentId] : []))];
  if (!ids.length) return new Map();
  if (ids.length > 100) throw new Error('Catalog agent page exceeds the query bound');
  const records = await db.select({ ...contactFields,
    ...(!publicOnly ? { is_public: agents.isPublic } : {}),
  }).from(agents).where(and(
    inArray(agents.id, ids),
    // A SQL literal keeps a 100-agent page within D1's 100 bound parameters.
    publicOnly ? sql`${agents.isPublic} = 1` : undefined,
  ));
  return new Map(records.map(row => [row.id, {
    id: row.id, name: row.name, title: row.title,
    phone: row.phone || '', line_id: row.line_id || '', facebook: row.facebook || '',
    email: row.email || '', photo_url: row.photo_url || '', bio: row.bio || '',
    ...(!publicOnly ? { is_public: row.is_public === true } : {}),
  }]));
}
