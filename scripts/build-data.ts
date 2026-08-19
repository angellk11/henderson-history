import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { driver, newSession } from "../src/lib/neo4j";
import {
  allClassesQuery,
  allOrgInstancesQuery,
  allOrgsQuery,
  allPeopleByIdsQuery,
  allPeopleIdsQuery,
  allTeamsQuery,
  campusQuery,
  instrumentsBrowseQuery,
  sportsQuery,
  staffBrowseQuery,
  subjectsQuery,
  titlesQuery,
} from "../src/lib/queries";
import type { SearchItem } from "../src/lib/types";

const OUT = path.resolve(process.cwd(), "data/build");
const BATCH = Number(process.env.PERSON_BATCH_SIZE ?? 200);

async function writeJSON<T>(name: string, data: T) {
  await fs.mkdir(OUT, { recursive: true });
  const file = path.join(OUT, name);
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

async function bulkRead<T>(
  session: Awaited<ReturnType<typeof newSession>>,
  query: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const res = await session.run(query, params);
  return res.records.map((r) => r.get(0)) as T[];
}

/* ------------------------------------------------------------------ */
/* Neo4j Integer coercion                                              */
/* ------------------------------------------------------------------ */

function isNeo4jInteger(v: unknown): boolean {
  return (
    v != null &&
    typeof v === "object" &&
    typeof (v as any).toNumber === "function" &&
    typeof (v as any).low === "number" &&
    typeof (v as any).high === "number" &&
    (v as any).constructor?.name === "Integer"
  );
}

/**
 * The neo4j driver returns `Integer` for any number property in both
 * the default object mode and in map projections. Pages do arithmetic
 * like `a.classYear - b.classYear`, which doesn't work on neo4j
 * Integer. Coerce numbers and keep everything else.
 */
function normalizePerson(p: any): any {
  if (p == null || typeof p !== "object") return p;
  const out: any = { ...p };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (isNeo4jInteger(v)) {
      out[k] = (v as any).toNumber();
    } else if (Array.isArray(v)) {
      out[k] = v.map(normalizePerson);
    } else if (v && typeof v === "object" && !isNeo4jInteger(v)) {
      out[k] = normalizePerson(v);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Person-record filtering                                             */
/* ------------------------------------------------------------------ */

/**
 * A "bare" person record is one with no usable name fields. These
 * typically come from a source import that created a Person node for
 * a referenced personId but never set any name properties. They
 * produce blank list items and pages with empty titles, so we drop
 * them at export time.
 */
function isBarePerson(p: any): boolean {
  const name = String(p?.name ?? "").trim();
  const first = String(p?.firstName ?? "").trim();
  const last = String(p?.lastName ?? "").trim();
  const wentBy = String(p?.wentBy ?? "").trim();
  const nickname = String(p?.nickname ?? "").trim();
  return !name && !first && !last && !wentBy && !nickname;
}

/* ------------------------------------------------------------------ */
/* Slug handling                                                       */
/* ------------------------------------------------------------------ */

/**
 * Build a URL-safe slug from a person's name. Used as a fallback when
 * a Person node in the DB is missing a slug (which shouldn't happen
 * now that the import writes one for every node). Falls back to a
 * stable id-based slug when the name is empty or produces no usable
 * characters.
 */
function slugify(name: unknown, id: number | string): string {
  const base = String(name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `person-${id}`;
}

/**
 * Collect every person's slug into a map and stamp it onto each
 * record. The DB stores the slug on every Person node, so we use
 * that as the source of truth. If a slug is missing we synthesize one
 * from the name as a defensive fallback, and if two people share a
 * slug we disambiguate by appending a counter. Both fallback cases
 * are logged so the import can be re-run to clean them up at the
 * source.
 */
function buildSlugMap(people: any[]): Map<number, string> {
  const used = new Set<string>();
  const map = new Map<number, string>();
  let synthesized = 0;
  let collisions = 0;

  for (const p of people) {
    const id = Number(p.personId ?? p.id);
    if (!Number.isFinite(id)) continue;

    const stored = typeof p.slug === "string" ? p.slug.trim() : "";
    let candidate = stored;
    if (!candidate) {
      candidate = slugify(p.name, id);
      synthesized++;
    }

    if (used.has(candidate)) {
      collisions++;
      let n = 2;
      let next = `${candidate}-${n}`;
      while (used.has(next)) next = `${candidate}-${++n}`;
      candidate = next;
    }

    used.add(candidate);
    p.slug = candidate;
    map.set(id, candidate);
  }

  if (synthesized > 0) {
    console.warn(
      `  ${synthesized} person record(s) had no slug in the DB; synthesized from name`,
    );
  }
  if (collisions > 0) {
    console.warn(
      `  ${collisions} slug collision(s) disambiguated by appending a counter`,
    );
  }
  return map;
}

/**
 * Stamp slugs onto the nested person records used by the family
 * relationship fields, so `/people/${rel.slug ?? rel.personId}` in
 * the page resolves to a real route. The slugMap is built from the
 * `slug` property on each Person node, so related records get the
 * same slug as the matching person in people.json.
 */
function stampRelatedSlugs(person: any, slugMap: Map<number, string>) {
  const fields: Array<keyof any> = ["parent", "spouse", "siblings", "child"];
  for (const f of fields) {
    const list = person?.[f];
    if (!Array.isArray(list)) continue;
    for (const rel of list) {
      if (!rel || typeof rel !== "object") continue;
      const id = Number(rel.personId ?? rel.id);
      if (Number.isFinite(id) && slugMap.has(id)) {
        rel.slug = slugMap.get(id);
      } else if (rel.name) {
        // Related person isn't in our exported set (rare, e.g. an
        // external spouse). Still give it a stable, URL-safe slug.
        rel.slug = slugify(rel.name, Number.isFinite(id) ? id : "x");
      }
    }
  }
}

/**
 * Stamp slugs onto the person records nested inside an org-instance
 * record (officers, members, founders, etc.) so the static site can
 * link directly to `/people/${slug}` from the RelatedList.
 *
 * Reuses the slugMap built for people.json, so the slug for any
 * personId that exists in our export is identical to the one on
 * /people/[slug]. For the rare case of a person referenced by an
 * org instance but not in our export (e.g. dropped as "bare"), we
 * still synthesize a stable, URL-safe slug from the name.
 */
function stampOrgInstanceSlugs(
  orgInstance: any,
  slugMap: Map<number, string>,
) {
  const list = orgInstance?.members;
  if (!Array.isArray(list)) return;
  for (const person of list) {
    if (!person || typeof person !== "object") continue;

    // `personId` comes back as a neo4j Integer ({ low, high }). Coerce
    // it before looking up the slug map, otherwise we miss every match.
    const id = Number(person.personId?.low ?? person.personId);
    if (Number.isFinite(id) && slugMap.has(id)) {
      person.slug = slugMap.get(id);
    } else if (person.name) {
      person.slug = slugify(person.name, Number.isFinite(id) ? id : "x");
    }
  }
}

/* ------------------------------------------------------------------ */
/* People export                                                        */
/* ------------------------------------------------------------------ */

async function exportPeopleBatched(
  session: Awaited<ReturnType<typeof newSession>>,
): Promise<any[]> {
  // Phase 1: ids.
  const idsRes = await session.run(allPeopleIdsQuery);
  const allIds = idsRes.records
    .map((r) => Number(r.get(0)))
    .filter(Number.isFinite);
  console.log(`  read ${allIds.length} person IDs`);

  // Phase 2: hydrate in batches.
  const people: any[] = [];
  for (let i = 0; i < allIds.length; i += BATCH) {
    const batch = allIds.slice(i, i + BATCH);
    const res = await session.run(allPeopleByIdsQuery, { ids: batch });
    for (const rec of res.records) {
      // Column 0 is the person map projection.
      const person = rec.get(0);
      if (person == null) continue;
      people.push(normalizePerson(person));
    }
    if ((i + BATCH) % 1000 === 0 || i + BATCH >= allIds.length) {
      console.log(
        `    …processed ${
          Math.min(i + BATCH, allIds.length)
        } / ${allIds.length}`,
      );
    }
  }
  return people;
}

/**
 * Drop bare records, assign slugs (from the DB, with synthesis as a
 * fallback), and stamp slugs onto related records. Mutates `people`
 * in place and returns it.
 */
function finalizePeople(
  people: any[],
): { people: any[]; slugMap: Map<number, string> } {
  const before = people.length;
  const named = people.filter((p) => !isBarePerson(p));
  const dropped = before - named.length;
  if (dropped > 0) {
    console.warn(
      `  dropped ${dropped} bare person record(s) with no name fields`,
    );
  }

  const slugMap = buildSlugMap(named);
  for (const p of named) stampRelatedSlugs(p, slugMap);

  const missing = named.filter((p) => !p.slug);
  if (missing.length > 0) {
    throw new Error(
      `${missing.length} named person record(s) ended up with no slug: ` +
        `personIds=${missing.map((p) => p.personId).slice(0, 10).join(", ")}…`,
    );
  }
  return { people: named, slugMap };
}

/* ------------------------------------------------------------------ */
/* Search index                                                         */
/* ------------------------------------------------------------------ */

function toSearchItems(people: any[]): SearchItem[] {
  const items: SearchItem[] = [];
  for (const p of people) {
    items.push({
      type: "person",
      slug: p.slug,
      title: p.name,
      subtitle: p.nickname ?? null,
      tokens: [p.name, p.wentBy, p.nickname]
        .filter(Boolean)
        .flatMap((s) => String(s).split(/\s+/)).filter(Boolean),
      year: null,
    });
  }
  return items;
}

/* ------------------------------------------------------------------ */
/* Main                                                                 */
/* ------------------------------------------------------------------ */

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const session = newSession();
  const t0 = Date.now();

  console.log(`Exporting from Neo4j (batch=${BATCH})…`);

  try {
    // People — two-phase read, then slug resolution.
    const rawPeople = await exportPeopleBatched(session);
    const { people, slugMap } = finalizePeople(rawPeople);
    console.log(`  ${people.length} people after filtering`);

    await writeJSON("people.json", people);

    // Other entity exports — single-query reads.
    const teams = await bulkRead<any>(session, allTeamsQuery);
    await writeJSON("teams.json", teams);

    const orgs = await bulkRead<any>(session, allOrgsQuery);
    await writeJSON("orgs.json", orgs);

    const orgInst = await bulkRead<any>(session, allOrgInstancesQuery);
    for (const oi of orgInst) stampOrgInstanceSlugs(oi, slugMap);
    await writeJSON("orgInstances.json", orgInst);

    const classes = await bulkRead<any>(session, allClassesQuery);
    await writeJSON("classes.json", classes);

    const subjects = await bulkRead<any>(session, subjectsQuery);
    const instruments = await bulkRead<any>(session, instrumentsBrowseQuery);
    const staffRoles = await bulkRead<any>(session, staffBrowseQuery);
    const buildings = await bulkRead<any>(session, campusQuery);
    const sports = await bulkRead<any>(session, sportsQuery);
    const titles = await bulkRead<any>(session, titlesQuery);

    await writeJSON("subjects.json", subjects);
    await writeJSON("instruments.json", instruments);
    await writeJSON("staffRoles.json", staffRoles);
    await writeJSON("buildings.json", buildings);
    await writeJSON("sports.json", sports);
    await writeJSON("titles.json", titles);

    await writeJSON("searchIndex.json", toSearchItems(people));
  } finally {
    await session.close();
    await driver.close();
  }

  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
