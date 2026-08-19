import type { SearchConfig } from "../toSearchItems";

export interface Subject {
  slug: string;
  name: string;
  code?: string | null;
  department?: string | null;
}

export const subjectConfig: SearchConfig<Subject> = {
  type: "subject",
  getSlug: (s) => s.slug,
  getTitle: (s) => s.name,
  getSubtitle: (s) => s.department ?? null,
  getTokens: (s) => [s.name, s.code, s.department],
};
