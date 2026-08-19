import type { SearchConfig } from "../toSearchItems";

export interface Person {
  slug: string;
  name: string;
  nickname?: string | null;
  wentBy?: string | string[] | null;
}

const asArray = (v: string | string[] | null | undefined): string[] => {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
};

export const personConfig: SearchConfig<Person> = {
  type: "person",
  getSlug: (p) => p.slug,
  getTitle: (p) => p.name,
  getSubtitle: (p) => p.nickname ?? null,
  getTokens: (p) => [
    p.name,
    ...asArray(p.wentBy),
    ...asArray(p.nickname),
  ],
};
