export function wrapImageIndex(index: number, total: number): number {
  return total > 0 ? ((index % total) + total) % total : 0;
}

export function swipeImageDelta(start: { x: number; y: number }, end: { x: number; y: number }): -1 | 0 | 1 {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.3) return 0;
  return dx < 0 ? 1 : -1;
}

export function isGalleryTypingTarget(target: { tagName?: string; isContentEditable?: boolean } | null): boolean {
  return Boolean(target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || ''));
}
