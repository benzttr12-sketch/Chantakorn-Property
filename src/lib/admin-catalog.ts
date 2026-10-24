/**
 * Bounded whole-catalog iteration for legacy screens (dashboard charts, social
 * automation matching, valuation map) that still need every listing in memory.
 * It follows the Worker's keyset pages instead of the old 800-row bridge and
 * fails visibly at a hard row/page ceiling rather than silently truncating.
 * These screens should move to aggregate APIs before a real catalog approaches
 * the ceiling.
 */
export type AdminCatalogPage<T> = { data: T[]; nextCursor: string | null };

export const ADMIN_CATALOG_MAX_PAGES = 100;
export const ADMIN_CATALOG_ROW_LIMIT = 100 * 100;

export async function collectAdminCatalogPages<T>(
  fetchPage: (cursor: string | null) => Promise<AdminCatalogPage<T>>,
  options: { maxPages?: number; rowLimit?: number } = {},
): Promise<T[]> {
  const maxPages = options.maxPages ?? ADMIN_CATALOG_MAX_PAGES;
  const rowLimit = options.rowLimit ?? ADMIN_CATALOG_ROW_LIMIT;
  if (!Number.isInteger(maxPages) || maxPages < 1) throw new Error('จำนวนหน้าของแคตตาล็อกไม่ถูกต้อง');
  if (!Number.isInteger(rowLimit) || rowLimit < 1) throw new Error('ขีดจำกัดจำนวนแถวของแคตตาล็อกไม่ถูกต้อง');
  const rows: T[] = [];
  const visited = new Set<string>();
  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const result = await fetchPage(cursor);
    if (!Array.isArray(result.data)) throw new Error('Cloudflare API ส่งข้อมูลหน้าถัดไปไม่ถูกต้อง');
    rows.push(...result.data);
    if (rows.length > rowLimit)
      throw new Error('จำนวนประกาศเกินขีดจำกัดของหน้าภาพรวม กรุณาใช้หน้ารายการทรัพย์แบบแบ่งหน้า');
    if (!result.nextCursor) return rows;
    if (visited.has(result.nextCursor)) throw new Error('Cloudflare API ส่ง cursor ซ้ำ');
    visited.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  throw new Error('จำนวนหน้าประกาศเกินขีดจำกัดของหน้าภาพรวม กรุณาใช้หน้ารายการทรัพย์แบบแบ่งหน้า');
}
