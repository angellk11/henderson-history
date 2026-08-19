import type { SearchConfig } from "../../../src/lib/types.ts";

export interface Org {
  orgSlug: string;
  orgName: string;
  shortName?: string | null;
  aliases?: string[];
  kind?: string | null;
  founded?: number | null;
}

export const orgConfig: SearchConfig<Org> = {
  type: "org",
  getSlug: (o) => o.orgSlug,
  getTitle: (o) => o.orgName,
  getSubtitle: (o) => o.kind ?? null,
  getYear: (o) => o.founded ?? null,
  getTokens: (o) => [o.orgName, o.shortName, ...(o.aliases ?? [])],
};
