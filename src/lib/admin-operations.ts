/** Validate the complete input before saving a price, including optional thousands separators. */
export function parseAdminPrice(input: string): number | null {
  const trimmed = input.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed.replace(/,/g, ''));
  return Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : null;
}

/** Select visible records without losing the user's selection outside the current filter. */
export function toggleVisibleSelection(selected: string[], visible: string[]): string[] {
  if (visible.length === 0) return selected;
  const selectedSet = new Set(selected);
  if (visible.every((id) => selectedSet.has(id))) {
    const visibleSet = new Set(visible);
    return selected.filter((id) => !visibleSet.has(id));
  }
  return Array.from(new Set([...selected, ...visible]));
}

/** Wait for every mutation so partial failures can be shown and retried accurately. */
export async function runSelectedOperations(
  ids: string[],
  operation: (id: string) => Promise<unknown>,
): Promise<{ succeeded: string[]; failed: string[] }> {
  const results = await Promise.allSettled(
    ids.map(async (id) => {
      const saved = await operation(id);
      if (saved === false || saved === null) throw new Error('ไม่พบรายการหรือบันทึกไม่สำเร็จ');
      return id;
    }),
  );
  return results.reduce<{ succeeded: string[]; failed: string[] }>(
    (result, item, index) => {
      result[item.status === 'fulfilled' ? 'succeeded' : 'failed'].push(ids[index]);
      return result;
    },
    { succeeded: [], failed: [] },
  );
}
