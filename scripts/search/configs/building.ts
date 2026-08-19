import type { SearchConfig } from "../../../src/lib/types.ts";

export interface Building {
  featureSlug: string;
  featureName: string;
  nickname?: string | null;
  previousNames?: string[];
  location?: string | null;
  yearBuilt?: number | null;
}

export const buildingConfig: SearchConfig<Building> = {
  type: "building",
  getSlug: (b) => b.featureSlug,
  getTitle: (b) => b.featureName,
  getSubtitle: (b) => b.location ?? null,
  getYear: (b) => b.yearBuilt ?? null,
  getTokens: (b) => [b.featureName, b.nickname, ...(b.previousNames ?? [])],
};
