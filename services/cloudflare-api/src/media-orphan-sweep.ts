/**
 * Bounded R2 orphan sweep for the mixed draft/public property-image bucket.
 *
 * Uploads put the R2 object before inserting its D1 metadata row, and a failed
 * delete removes the row before the object. Both orders prefer a broken image
 * over a broken listing, which can leave unreferenced objects behind. This sweep
 * removes only objects that are (a) not referenced by property_media and (b)
 * older than a safety window wider than any in-flight upload. It is opt-in via
 * MEDIA_SWEEP_ENABLED, scans a bounded number of R2 pages per run and resumes
 * from a persisted cursor so a large bucket is never listed in one invocation.
 */
export const SWEEP_STATUS_KEY = 'media_orphan_sweep_status';
export const SWEEP_CURSOR_KEY = 'media_orphan_sweep_cursor';
/** Never delete an object that could still be part of an in-flight upload. */
export const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;
/** R2 list page ceiling; deletes are capped separately per run. */
export const SWEEP_PAGE_SIZE = 1000;
export const SWEEP_MAX_PAGES = 10;
export const SWEEP_MAX_DELETES = 500;
/** D1 allows at most 100 bound parameters per statement. */
const REFERENCE_CHUNK = 90;

export type SweepEnv = {
  DB: D1Database;
  PROPERTY_MEDIA: R2Bucket;
  MEDIA_SWEEP_ENABLED?: string;
};

export type SweepResult = {
  last_run_at: string;
  scanned: number;
  referenced: number;
  orphans: number;
  deleted: number;
  skipped_recent: number;
  truncated: boolean;
  cursor: string | null;
  duration_ms: number;
};

export type SweepOptions = {
  /** Override the sweep clock (tests only). */
  now?: number;
  minAgeMs?: number;
  maxPages?: number;
  /** Run even when MEDIA_SWEEP_ENABLED is not 'true' (tests only). */
  force?: boolean;
};

async function readSetting(db: D1Database, key: string): Promise<Record<string, unknown> | null> {
  let row: { value_json?: unknown } | null;
  try {
    row = await db.prepare('SELECT value_json FROM settings WHERE key = ?')
      .bind(key).first<{ value_json: string }>();
  } catch { return null; }
  if (!row || typeof row.value_json !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(row.value_json);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

async function writeSetting(db: D1Database, key: string, value: unknown): Promise<void> {
  await db.prepare(`INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`)
    .bind(key, JSON.stringify(value), new Date().toISOString()).run();
}

export async function sweepPropertyMediaOrphans(
  env: SweepEnv,
  options: SweepOptions = {},
): Promise<SweepResult | null> {
  if (!options.force && env.MEDIA_SWEEP_ENABLED !== 'true') return null;
  const startedAt = Date.now();
  const now = options.now ?? startedAt;
  const minAgeMs = options.minAgeMs ?? ORPHAN_MIN_AGE_MS;
  const maxPages = Math.min(Math.max(Math.trunc(options.maxPages ?? SWEEP_MAX_PAGES), 1), SWEEP_MAX_PAGES);
  const previous = await readSetting(env.DB, SWEEP_CURSOR_KEY);
  let cursor = typeof previous?.cursor === 'string' && previous.cursor ? previous.cursor : null;
  let scanned = 0;
  let referenced = 0;
  let orphans = 0;
  let deleted = 0;
  let skippedRecent = 0;
  let truncated = false;
  try {
    for (let page = 0; page < maxPages; page++) {
      const listOptions: R2ListOptions = { prefix: 'properties/', limit: SWEEP_PAGE_SIZE };
      if (cursor) listOptions.cursor = cursor;
      const listing: R2Objects = await env.PROPERTY_MEDIA.list(listOptions);
      scanned += listing.objects.length;

      const known = new Set<string>();
      for (let i = 0; i < listing.objects.length; i += REFERENCE_CHUNK) {
        const keys = listing.objects.slice(i, i + REFERENCE_CHUNK).map(object => object.key);
        const rows = await env.DB.prepare(
          `SELECT object_key FROM property_media WHERE object_key IN (${keys.map(() => '?').join(',')})`,
        ).bind(...keys).all<{ object_key: string }>();
        for (const row of rows.results) known.add(row.object_key);
      }
      referenced += known.size;
      const unreferenced = listing.objects.filter(object => !known.has(object.key));
      orphans += unreferenced.length;
      const oldEnough = unreferenced.filter(object =>
        object.uploaded instanceof Date && object.uploaded.getTime() <= now - minAgeMs);
      skippedRecent += unreferenced.length - oldEnough.length;
      const deletable = oldEnough.slice(0, Math.max(SWEEP_MAX_DELETES - deleted, 0));
      if (deletable.length) {
        await env.PROPERTY_MEDIA.delete(deletable.map(object => object.key));
        deleted += deletable.length;
      }

      truncated = listing.truncated;
      cursor = listing.truncated && typeof listing.cursor === 'string' && listing.cursor
        ? listing.cursor : null;
      if (!truncated) break;
    }
  } catch (error) {
    // A stale cursor must not wedge every future run: reset it and report.
    if (cursor) await writeSetting(env.DB, SWEEP_CURSOR_KEY, { cursor: null }).catch(() => undefined);
    await writeSetting(env.DB, SWEEP_STATUS_KEY, {
      last_run_at: new Date(startedAt).toISOString(), error: true, scanned, deleted,
    }).catch(() => undefined);
    throw error;
  }

  const result: SweepResult = {
    last_run_at: new Date(startedAt).toISOString(),
    scanned, referenced, orphans, deleted, skipped_recent: skippedRecent,
    truncated, cursor, duration_ms: Date.now() - startedAt,
  };
  await writeSetting(env.DB, SWEEP_CURSOR_KEY, { cursor });
  await writeSetting(env.DB, SWEEP_STATUS_KEY, result);
  return result;
}
