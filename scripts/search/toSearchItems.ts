import type { SearchItem, SearchConfig } from "../../src/lib/types";

export function toSearchItems<T>(
    records: T[],
    config: SearchConfig<T>,
): SearchItem[] {
  return records.map((record) => {
    const rawTokens = config.getTokens(record);
    const tokens = [
      ...new Set(
        rawTokens
          .filter((t): t is string => Boolean(t))
          .flatMap((s) => String(s).split(/\s+/))
          .filter(Boolean),
      ),
    ];

    return {
      type: config.type,
      slug: config.getSlug(record),
      title: config.getTitle(record),
      subtitle: config.getSubtitle?.(record) ?? null,
      year: config.getYear?.(record) ?? null,
      tokens,
    };
  });
}

