/** D1 batch is transactional: a failed audit insert rolls back the mutation.
 * changes() observes only the immediately preceding statement in this batch,
 * so a failed optimistic lock cannot create an audit event.
 */
export async function auditedMutation(
  db: D1Database,
  mutation: { sql: string; params: unknown[] },
  actor: string,
  action: string,
  target: string,
): Promise<D1Result> {
  const [result] = await db.batch([
    db.prepare(mutation.sql).bind(...mutation.params),
    db.prepare(`INSERT INTO audit_events
      (id, category, action, actor_uid, target_id, created_at)
      SELECT ?, 'property', ?, ?, ?, ? WHERE changes() > 0`)
      .bind(crypto.randomUUID(), action, actor, target, new Date().toISOString()),
  ]);
  return result;
}
