export type EntityType =
  | 'person' | 'team' | 'org' | 'org-instance'
  | 'class' | 'subject' | 'building' | 'instrument'
  | 'staff-role' | 'sport' | 'title';


export interface SearchConfig<T> {
    type: EntityType;  // not string!
    getSlug: (record: T) => string;
    getTitle: (record: T) => string;
    getSubtitle?: (record: T) => string | null;
    getTokens: (record: T) => Array<string | null | undefined>;
    getYear?: (record: T) => number | null;
}

export type Slugged = {
  slug: string;
  name: string;
  year?: number | null;
};

export type Person = {
  slug: string;
  personId: number;
  name: string;
  nickname?: string | null;
  wentBy?: string | null;
  note?: string | null;
  classes: { classSlug: string; name: string; classYear: number }[];
  teams: { teamSlug: string; name: string; teamYear: number; sport?: string; position?: string[]; certainty?: string | null }[];
  orgs: { orgInstanceSlug: string; orgInstanceName: string; orgInstanceDate?: number; office?: string[] | null }[];
  subjects: { subjectSlug: string; subjectName: string; taughtYears?: number[] }[];
  orchInstruments: { instrumentSlug: string; instrumentName: string }[];
  bandInstruments: { instrumentSlug: string; instrumentName: string }[];
  staffRole: { staffRoleSlug: string; staffRoleName: string }[];
  degree: { name: string; gradDate?: number | null }[];
  // ...extend as needed
};

export interface SearchItem {
    type: EntityType;
    slug: string;
    title: string;
    subtitle: string | null | undefined;
    tokens: string[];
    year: number | null | undefined;
}

export interface IndexedDoc {
    id: number;
    type: EntityType;
    slug: string;
    title: string;
    subtitle: string | null | undefined;
    year: number | null | undefined;
}

export interface StaffRole {
  staffRoleName: string;
  staffRoleSlug: string;
  year?: string[] | number[] | null;
  termStart?: string | number | null;
  termEnd?: string | number | null;
  term2Start?: string | number | null;
  term2End?: string | number | null;
}

export function yearValue(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;

  if (v && typeof v === "object" && "low" in v) {
    const low = (v as any).low;
    if (typeof low === "number" && Number.isFinite(low)) return low;
  }

  return null;
}