/** Coerce a possibly-null value to a non-array fallback. */
export function arr<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Format a year range or single year. */
export function yearLabel(y: number | { low?: number; high?: number } | null | undefined): string {
  if (y == null) return '';
  if (typeof y === 'number') return String(y);
  const lo = y.low ?? y.high ?? null;
  const hi = y.high ?? y.low ?? null;
  if (lo == null && hi == null) return '';
  if (lo === hi) return String(lo);
  return `${lo}–${hi}`;
}
