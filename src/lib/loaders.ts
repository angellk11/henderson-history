import fs from 'node:fs/promises';
import path from 'node:path';

export async function loadJSON<T>(rel: string): Promise<T> {
  const abs = path.resolve(process.cwd(), rel);
  return JSON.parse(await fs.readFile(abs, 'utf-8')) as T;
}

export interface SiblingRef { href: string; label: string }

export function pairwise<T>(
  list: T[],
  hrefFor: (item: T) => string,
  labelFor: (item: T) => string
): Array<{ item: T; prev: SiblingRef | null; next: SiblingRef | null }> {
  return list.map((item, idx, all) => {
    const prev = idx > 0 ? all[idx - 1] : null;
    const next = idx < all.length - 1 ? all[idx + 1] : null;
    return {
      item,
      prev: prev ? { href: hrefFor(prev), label: labelFor(prev) } : null,
      next: next ? { href: hrefFor(next), label: labelFor(next) } : null,
    };
  });
}

export function staticPathsFromPairs<T extends { item: T; prev: SiblingRef | null; next: SiblingRef | null }>(
  pairs: Array<{ item: T; prev: SiblingRef | null; next: SiblingRef | null }>,
  paramKey: string,
  paramFor: (item: T) => string | number,
  renameEntityTo: string
): Array<{ params: Record<string, string>; props: Record<string, unknown> }> {
  return pairs.map((p) => ({
    params: { [paramKey]: String(paramFor(p.item) ?? '') },
    props: {
      [renameEntityTo]: p.item,
      prev: p.prev,
      next: p.next,
    },
  }));
}
