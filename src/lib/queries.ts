// Cypher used by the build script. Keep one constant per query, named by intent.
// Return shape is always a single object under a stable alias (person, team, ...).
import type { Session } from "neo4j-driver";
import { asNumber } from "./neo4j";

export const lastNameQuery = `
MATCH (p:Person)
WHERE toLower(p.lastName) = toLower($lastName)
RETURN p {.personId, .name, .lastName} AS person
ORDER BY p.firstName
`;

export const lastNameFuzzyQuery = `
CALL db.index.fulltext.queryNodes('peopleIndex', $fuzzyLast + '~') YIELD node, score
RETURN node {.personId, .name, .lastName} AS person, score
ORDER BY score DESC
LIMIT 40
`;

export const fullNameFuzzyQuery = `
CALL db.index.fulltext.queryNodes('fullNameIndex', $fuzzyLast + '~') YIELD node, score
RETURN node {.personId, .name, .lastName} AS person, score
ORDER BY score DESC
LIMIT 40
`;

export const personQuery = `
MATCH (p:Person {personId: toInteger($pId)})
OPTIONAL MATCH (p)-[rt:MEMBER_OF_TEAM]->(t:Team)
OPTIONAL MATCH (p)-[rc:MEMBER_OF_CLASS]->(c:Class)
OPTIONAL MATCH (p)-[ro:MEMBER_OF_ORGANIZATION]->(oi:OrganizationInstance)
OPTIONAL MATCH (p)-[rs:TAUGHT_SUBJECT]->(s:Subject)
OPTIONAL MATCH (p)-[ri:PLAYED_INSTRUMENT_IN_ORCHESTRA]->(io:Instrument)
OPTIONAL MATCH (p)-[rb:PLAYED_INSTRUMENT_IN_BAND]->(ib:Instrument)
OPTIONAL MATCH (p)-[rstaff:HAD_STAFF_ROLE]->(sr:StaffRole)
OPTIONAL MATCH (p)-[rv:VOTED]->(title:Title)
OPTIONAL MATCH (p)-[rco:COACHED_SPORT]->(sp:Sport)
OPTIONAL MATCH (p)-[rn:NAMESAKE_OF]->(cam:Campus)
OPTIONAL MATCH (p)-[rmar:MARRIED]-(spouse:Person)
OPTIONAL MATCH (p)-[rpar:PARENT_OF]-(parent:Person)
OPTIONAL MATCH (p)-[rsib:SIBLING_OF]-(sib:Person)
RETURN p {
  .name,
  .slug,
  .nickname,
  .wentBy,
  .note,
  .education,
  title: apoc.coll.sortMaps([ (p)-[r:VOTED]->(title:Title) | title {.titleName, .titleSlug, year: r.year} ], '^year'),
  parent: apoc.coll.sortMaps([ (p)<-[r:PARENT_OF]-(parent:Person) | parent {.lastName, .name, .personId, note: r.note} ], '^lastName'),
  child: apoc.coll.sortMaps([ (p)-[r:PARENT_OF]->(child:Person) | child {.lastName, .name, .personId, note: r.note} ], '^lastName'),
  siblings: apoc.coll.sortMaps([ (p)-[r:SIBLING_OF]-(sib:Person) | sib {.lastName, .name, .personId, note: r.note} ], '^lastName'),
  spouse: apoc.coll.sortMaps([ (p)-[r:MARRIED]-(spouse:Person) | spouse {.lastName, .name, .personId, note: r.note} ], '^lastName'),
  namesake: apoc.coll.sortMaps([ (p)-[r:NAMESAKE_OF]->(cam:Campus) | cam {.featureName, .featureSlug, .orgName, .orgSlug} ], '^featureName'),
  coached: apoc.coll.sortMaps([ (p)-[r:COACHED_SPORT]->(sc:Sport) | sc {.sportName, .sportSlug, coachedYears: r.coachedYears} ], '^sportName'),
  orgs: apoc.coll.sortMaps([ (p)-[ro:MEMBER_OF_ORGANIZATION]->(oi:OrganizationInstance) | oi {.orgInstanceName, .orgInstanceDate, .orgInstanceId, .orgInstanceSlug, office: ro.office, certainty: ro.certainty} ], '^orgInstanceDate'),
  classes: apoc.coll.sortMaps([ (p)-[rc:MEMBER_OF_CLASS]->(c:Class) | c {.name, .classSlug, .classYear} ], '^classYear'),
  degree: apoc.coll.sortMaps([ (p)-[rd:EARNED_DEGREE]-(d:Degree) | d {.name, gradDate: toInteger(rd.graduationDate)} ], '^gradDate'),
  teams: apoc.coll.sortMaps([ (p)-[rt:MEMBER_OF_TEAM]-(t:Team) | t {.teamYear, .teamSlug, .name, certainty: rt.certainty, position: rt.position, rank: rt.rank, team: rt.team} ], '^teamYear'),
  subjects: apoc.coll.sortMaps([ (p)-[rs:TAUGHT_SUBJECT]->(s:Subject) | s {.subjectName, .subjectSlug, taughtYears: rs.taughtYears} ], '^subjectName'),
  orchInstruments: apoc.coll.sortMaps([ (p)-[ri:PLAYED_INSTRUMENT_IN_ORCHESTRA]->(inst:Instrument) | inst {.instrumentName, .instrumentSlug, playedYear: ri.playedYear} ], '^instrumentName'),
  bandInstruments: apoc.coll.sortMaps([ (p)-[rb:PLAYED_INSTRUMENT_IN_BAND]->(inst:Instrument) | inst {.instrumentName, .instrumentSlug, playedYear: rb.playedYear} ], '^instrumentName'),
  staffRole: apoc.coll.sortMaps([ (p)-[rstaff:HAD_STAFF_ROLE]->(sr:StaffRole) | sr {.staffRoleName, .staffRoleSlug, staffRoleYears: rstaff.year, termStart: rstaff.termStart, termEnd: rstaff.termEnd, term2Start: rstaff.term2Start, term2End: rstaff.term2End} ], '^staffRoleYears')
} AS person
`;

export const peopleBrowseQuery = `
MATCH (p:Person)
RETURN p {.name, .personId, .lastName, .slug} AS person
ORDER BY p.lastName, p.firstName
`;

export const titleQuery = `
MATCH (ti:Title {titleSlug: $tiSlug})
RETURN ti {
  .titleName,
  .titleSlug,
  person: [(p:Person)-[ty:VOTED]->(ti) | p {.name, .slug, .lastName, .personId, votedYear: ty.year}]
} AS title
`

export const titlesQuery = `
MATCH (tit:Title)
RETURN tit {.titleName, .titleSlug} as title
ORDER BY tit.titleName
`
export const subjectQuery = `
MATCH (s:Subject {subjectSlug: $sSlug})
RETURN s {
  .subjectName,
  .subjectSlug,
  person: [(p:Person)-[ty:TAUGHT_SUBJECT]->(s) | p {.name, .slug, .lastName, .personId, taughtYears: ty.taughtYears}]
} AS subject
`;

export const subjectsQuery = `
MATCH (s:Subject)
RETURN s {.subjectName, .subjectSlug} AS subject
ORDER BY s.subjectName
`;

export const organizationQuery = `
MATCH (o:Organization {orgSlug: $orgSlug})
RETURN o {
  .orgName,
  .orgType,
  .orgSlug,
  .founded,
  .ended,
  .colors,
  .colorsHex1,
  .colorsHex2,
  .motto,
  .creed,
  .flower,
  .yell,
  .song,
  .poem,
  .emblem,
  .password,
  .location,
  .time,
  .mascot,
  .banner,
  .philosophy,
  .signal,
  .purpose,
  .hobby,
  .pledge,
  .note,
  instances: apoc.coll.sortMaps(
    [(o)-[:INSTANCE_OF]-(oi:OrganizationInstance)
     | oi {.orgInstanceName, .orgInstanceSlug, .orgInstanceId, .orgInstanceDate}],
    '^orgInstanceDate'
  ),
  namesakeOf: apoc.coll.sortMaps(
    [(f:Campus)<-[r:NAMESAKE_OF]-(o) | f {.featureName, .featureSlug}],
    '^featureSlug'
  )
} AS organization
`;

export const orgInstanceQuery = `
MATCH (oi:OrganizationInstance {orgInstanceSlug: $oiSlug})-[:INSTANCE_OF]->(o:Organization)
RETURN oi {
  .orgInstanceName,
  .orgInstanceDate,
  .orgInstanceSlug,
  .orgInstanceId,
  orgSlug: o.orgSlug,
  orgName: o.orgName,
  orgType: o.orgType,
  members: apoc.coll.sortMaps(
    [(p:Person)-[r:MEMBER_OF_ORGANIZATION]->(oi)
     | p {.slug, .lastName, .name, .personId, office: r.office, certainty: r.certainty}],
    '^lastName'
  )
} AS organizationInstance
`;

export const organizationTypeQuery = `
MATCH (o:Organization)
WHERE toLower(o.orgType) = toLower($oT)
RETURN o {.orgName, .orgSlug, .orgId, .orgType, .founded, .ended} AS orgType
`;

export const organizationsBrowseQuery = `
MATCH (o:Organization)
RETURN o {.orgName, .orgSlug} AS organization
ORDER BY o.orgName
`;

export const organizationTypeBrowseQuery = `
MATCH (n:Organization)
WHERE n.orgType IS NOT NULL
RETURN DISTINCT n {.orgType} AS orgType
ORDER BY orgType.orgType
`;

export const classQuery = `
MATCH (c:Class {classSlug: $cSlug})
RETURN c {
  .name,
  .classYear,
  .classColors,
  .classFlower,
  .classMotto,
  .classYell,
  .classSong,
  .classMascot,
  .classNote,
  namesakeOf: apoc.coll.sortMaps(
    [(f:Campus)<-[r:NAMESAKE_OF]-(c) | f {.featureName, .featureSlug}],
    '^featureSlug'
  ),
  members: apoc.coll.sortMaps(
    [(p:Person)-[r:MEMBER_OF_CLASS]->(c) | p {.personId, .slug, .lastName, .name, office: r.office}],
    '^lastName'
  )
} AS class
`;

export const classesQuery = `
MATCH (c:Class)
WHERE c.classYear = toInteger($classYear)
RETURN c {.name, .classSlug, .classId} AS class
ORDER BY c.classId
`;

export const teamQuery = `
MATCH (t:Team {teamSlug: $tSlug})
OPTIONAL MATCH (t)-[:PLAYS_SPORT]->(sp:Sport)
OPTIONAL MATCH (c:Person)-[r:COACHED_TEAM]->(t)
OPTIONAL MATCH (p:Person)-[rt:MEMBER_OF_TEAM]->(t)
RETURN t {
  .name,
  .sport,
  .teamYear,
  sportId: sp.sportSlug,
  coach: apoc.coll.sortMaps(
    [ (c)-[r:COACHED_TEAM]->(t) | c {.lastName, .personId, .name, type: r.coachType} ],
    '^lastName'
  ),
  roster: apoc.coll.sortMaps(
    [ (p)-[rt:MEMBER_OF_TEAM]->(t) | p {.lastName, .slug, .personId, .name, certainty: rt.certainty, position: rt.position, rank: rt.rank} ],
    '^lastName'
  )
} AS team
`;

export const sportQuery = `
MATCH (s:Sport {sportSlug: $sS})
RETURN s {
  .sportName,
  .sportSlug,
  teams: apoc.coll.sortMaps(
    [(t)-[r:PLAYS_SPORT]->(s) | t {.teamSlug, .name}],
    '^name'
  ),
  coaches: apoc.coll.sortMaps(
    [(p:Person)-[r:COACHED_SPORT]->(sc:Sport {sportSlug: $sS}) | p {.personId, .slug, .lastName, .name, coachedYears: r.coachedYears}],
    '^lastName'
  )
} AS sport
`;

export const sportsQuery = `
MATCH (s:Sport)
RETURN s {.sportName, .sportSlug} AS sport
ORDER BY s.sportName
`;

export const coachesQuery = `
MATCH (p:Person)-[r:COACHED_SPORT]->(s:Sport {sportSlug: $sS})
RETURN p {.name, .slug, .personId, .lastName, sportName: s.sportName, sportSlug: s.sportSlug, coachedYears: r.coachedYears} AS coach
ORDER BY r.coachedYears, p.lastName
`;

export const staffRoleQuery = `
MATCH (s:StaffRole {staffRoleSlug: $staffSlug})
RETURN s {
  .staffRoleName,
  person: apoc.coll.sortMaps(
    [(p:Person)-[r:HAD_STAFF_ROLE]->(s) | p {.slug, .name, .lastName, .personId, staffRoleYears: r.year, termStart: r.termStart, termEnd: r.termEnd, term2Start: r.term2Start, term2End: r.term2End}],
    '^staffRoleYears'
  )
} AS staffRole
`;

export const staffBrowseQuery = `
MATCH (s:StaffRole)
RETURN s {.staffRoleName, .staffRoleSlug} AS staffRole
ORDER BY s.staffRoleName
`;

export const instrumentQuery = `
MATCH (i:Instrument {instrumentSlug: $instrumentSlug})
RETURN i {
  .instrumentName,
  person: apoc.coll.dropDuplicateNeighbors(
    apoc.coll.sortMaps(
      [(i)-[]-(p:Person) | p {.lastName, .slug, .personId, .name}],
      '^lastName'
    )
  )
} AS instrument
`;

export const instrumentsBrowseQuery = `
MATCH (i:Instrument)
RETURN i {.instrumentName, .instrumentSlug} AS instrument
ORDER BY i.instrumentName
`;

export const queensBrowseQuery = `
MATCH (t:Title {titleId: 1})
RETURN t {
  person: apoc.coll.sortMaps([(t)<-[r:VOTED]-(p:Person) | p {.personId, .slug, .name, year: r.year[0]}], '^year')
} AS queen
`;

export const maidsBrowseQuery = `
MATCH (t:Title {titleId: 2})
RETURN t {
  person: apoc.coll.sortMaps([(t)<-[r:VOTED]-(p:Person) | p {.personId, .slug, .name, .lastName, year: r.year[0]}], '^lastName')
} AS maid
ORDER BY t.year
`;

export const beautiesBrowseQuery = `
MATCH (t:Title {titleId: 9})
RETURN t {
  person: apoc.coll.sortMaps([(t)<-[r:VOTED]-(p:Person) | p {.personId, .slug, .name, year: r.year[0]}], '^year')
} AS beauty
`;

// export const campusQuery = `
// MATCH (c:Campus)
// RETURN c {.featureName, .featureSlug, .lat, .long, .dateBuilt, .dateDestroyed, .status} AS campus
// ORDER BY c.featureName
// `;

export const campusQuery = `
MATCH (c:Campus)
RETURN c {
  .featureName,
  .featureSlug,
  .dateBuilt,
  .dateNamed,
  .dateDestroyed,
  .destructionReason,
  .history,
  .lat,
  .long,
  .locationAccuracy,
  .status,
  namesake: apoc.coll.sortMaps(
    [(p:Person)-[r:NAMESAKE_OF]-(c) | p {.personId, .slug, .name}],
    '^name'
  ),
  giftOf: apoc.coll.sortMaps(
    [(z:Class)-[r:GAVE_GIFT]->(c) | z {.classSlug, .classYear}],
    '^classYear'
  )
} AS campus
`;

export async function runOne<T>(
  session: Session,
  query: string,
  params: Record<string, unknown> = {},
): Promise<T | null> {
  const res = await session.run(query, params);
  return res.records[0]?.get(0) ?? null;
}

export async function runMany<T>(
  session: Session,
  query: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const res = await session.run(query, params);
  return res.records.map((r) => r.get(0));
}

// Fast single-MATCH. Only IDs. Always N rows.
export const allPeopleIdsQuery = `
  MATCH (p:Person)
  RETURN p.personId AS personId
  ORDER BY p.personId
  `;

export const allPeopleByIdsQuery = `
  UNWIND $ids AS pid
  MATCH (p:Person {personId: pid})

  RETURN p {
    .personId,
    .slug,
    .name,
    .firstName,
    .lastName,
    .nickname,
    .wentBy,
    .note,
    .education,

    teams: [
      x IN [
        (p)-[r:MEMBER_OF_TEAM]->(t:Team) |
        {
          teamSlug:  t.teamSlug,
          name:      t.name,
          teamYear:  t.teamYear,
          sport:     t.sport,
          certainty: r.certainty,
          position:  r.position,
          rank:      r.rank,
          team:      r.team
        }
      ]
      WHERE x.name IS NOT NULL
    ],

    classes: [
      x IN [
        (p)-[:MEMBER_OF_CLASS]->(c:Class) |
        {
          classSlug: c.classSlug,
          name:      c.name,
          classYear: c.classYear
        }
      ]
      WHERE x.name IS NOT NULL
    ],

    orgs: [
      x IN [
        (p)-[r:MEMBER_OF_ORGANIZATION]->(oi:OrganizationInstance) |
        {
          orgInstanceSlug: oi.orgInstanceSlug,
          orgInstanceName: oi.orgInstanceName,
          orgInstanceDate: oi.orgInstanceDate,
          office:          r.office,
          certainty:       r.certainty
        }
      ]
      WHERE x.orgInstanceName IS NOT NULL
    ],

    subjects: [
      x IN [
        (p)-[r:TAUGHT_SUBJECT]->(s:Subject) |
        {
          subjectSlug: s.subjectSlug,
          subjectName: s.subjectName,
          taughtYears: r.taughtYears
        }
      ]
      WHERE x.subjectName IS NOT NULL
    ],

    orchInstruments: [
      x IN [
        (p)-[r:PLAYED_INSTRUMENT_IN_ORCHESTRA]->(i:Instrument) |
        {
          instrumentSlug: i.instrumentSlug,
          instrumentName: i.instrumentName,
          playedYear:     r.playedYear
        }
      ]
      WHERE x.instrumentName IS NOT NULL
    ],

    bandInstruments: [
      x IN [
        (p)-[r:PLAYED_INSTRUMENT_IN_BAND]->(i:Instrument) |
        {
          instrumentSlug: i.instrumentSlug,
          instrumentName: i.instrumentName,
          playedYear:     r.playedYear
        }
      ]
      WHERE x.instrumentName IS NOT NULL
    ],

    staffRole: [
      x IN [
        (p)-[r:HAD_STAFF_ROLE]->(sr:StaffRole) |
        {
          staffRoleSlug: sr.staffRoleSlug,
          staffRoleName: sr.staffRoleName,
          year:          r.year,
          termStart:     r.termStart,
          termEnd:        r.termEnd,
          term2Start:    r.term2Start,
          term2End:      r.term2End
        }
      ]
      WHERE x.staffRoleName IS NOT NULL
    ],

    titles: [
      x IN [
        (p)-[r:VOTED]->(ttl:Title) |
        {
          titleName: ttl.titleName,
          titleSlug: ttl.titleSlug,
          year:      r.year
        }
      ]
      WHERE x.titleName IS NOT NULL
    ],

    degree: [
      x IN [
        (p)-[r:EARNED_DEGREE]->(deg:Degree) |
        {
          name:     deg.name,
          gradDate: r.graduationDate
        }
      ]
      WHERE x.name IS NOT NULL
    ],

    spouse: [
      x IN [
        (p)-[r:MARRIED]-(spouse:Person) |
        {
          personId: spouse.personId,
          slug:     spouse.slug,
          name:     spouse.name,
          lastName: spouse.lastName,
          note:     r.note
        }
      ]
      WHERE x.personId IS NOT NULL
    ],

    parent: [
      x IN [
        (p)<-[r:PARENT_OF]-(parent:Person) |
        {
          personId: parent.personId,
          slug:     parent.slug,
          name:     parent.name,
          lastName: parent.lastName,
          note:     r.note
        }
      ]
      WHERE x.personId IS NOT NULL
    ],

    siblings: [
      x IN [
        (p)-[r:SIBLING_OF]-(sib:Person) |
        {
          personId: sib.personId,
          slug:     sib.slug,
          name:     sib.name,
          lastName: sib.lastName,
          note:     r.note
        }
      ]
      WHERE x.personId IS NOT NULL
    ],

    child: [
      x IN [
        (p)-[r:PARENT_OF]->(child:Person) |
        {
          personId: child.personId,
          slug:     child.slug,
          name:     child.name,
          lastName: child.lastName,
          note:     r.note
        }
      ]
      WHERE x.personId IS NOT NULL
    ],

    namesake: [
      x IN [
        (p)-[:NAMESAKE_OF]->(cam:Campus) |
        {
          featureName: cam.featureName,
          featureSlug: cam.featureSlug,
          orgName:     cam.orgName,
          orgSlug:     cam.orgSlug
        }
      ]
      WHERE x.featureName IS NOT NULL
    ]
  } AS person
`;


export const allTeamsQuery = `
MATCH (t:Team)
OPTIONAL MATCH (t)-[:PLAYS_SPORT]->(sp:Sport)
WITH t, sp
OPTIONAL MATCH (c:Person)-[rc:COACHED_TEAM]->(t)
WITH t, sp, collect(DISTINCT {node: c, rel: rc}) AS coachData
OPTIONAL MATCH (p:Person)-[rt:MEMBER_OF_TEAM]->(t)
WITH t, sp, coachData, collect(DISTINCT {node: p, rel: rt}) AS rosterData
RETURN t {
  .teamSlug, .name, .sport, .teamYear,
  sportSlug: sp.sportSlug,
  coaches: apoc.coll.sortMaps(
    [x IN coachData | 
      { personId: x.node.personId, slug: x.node.slug, lastName: x.node.lastName, name: x.node.name, type: x.rel.coachType }],
    '^lastName'),
  roster: apoc.coll.sortMaps(
    [x IN rosterData | 
      { personId: x.node.personId, slug: x.node.slug, lastName: x.node.lastName, name: x.node.name, certainty: x.rel.certainty, position: x.rel.position, rank: x.rel.rank }],
    '^lastName')
} AS team
`;

export const allOrgsQuery = `
MATCH (o:Organization)
WITH o
OPTIONAL MATCH (o)-[:INSTANCE_OF]-(oi:OrganizationInstance)
WITH o, collect(DISTINCT oi { .orgInstanceSlug, .orgInstanceName, .orgInstanceDate }) AS instances
RETURN o {
  .orgSlug, .orgName, .orgType, .founded, .ended,
  .colors, .colorsHex1, .colorsHex2, .motto, .creed, .flower, .yell, .song,
  .emblem, .password, .location, .time, .mascot, .banner,
  .philosophy, .signal, .purpose, .hobby, .pledge, .note,
  instances: apoc.coll.sortMaps(instances, '^orgInstanceDate')
} AS organization

`;

export const allOrgInstancesQuery = `
MATCH (oi:OrganizationInstance)-[:INSTANCE_OF]->(o:Organization)
WITH oi, o
OPTIONAL MATCH (p:Person)-[r:MEMBER_OF_ORGANIZATION]->(oi)
WITH oi, o, collect(DISTINCT {node: p, rel: r}) AS memberData
RETURN oi {
  .orgInstanceSlug, .orgInstanceName, .orgInstanceDate,
  orgSlug: o.orgSlug, orgName: o.orgName, orgType: o.orgType,
  members: apoc.coll.sortMaps(
    [x IN memberData |
      {
        personId: x.node.personId,
        slug: x.node.slug,
        lastName: x.node.lastName,
        name: x.node.name,
        office: x.rel.office,
        certainty: x.rel.certainty
      }],
    '^lastName')
} AS organizationInstance


`;

export const allClassesQuery = `
MATCH (c:Class)
WITH c
OPTIONAL MATCH (p:Person)-[r:MEMBER_OF_CLASS]->(c)
WITH c, collect(DISTINCT {node: p, rel: r}) AS memberData
RETURN c {
  .classSlug, .name, .classYear,
  .classColors, .classFlower, .classMotto, .classYell, .classSong, .classMascot, .classNote,
  members: apoc.coll.sortMaps(
    [x IN memberData |
      {
        personId: x.node.personId,
        slug: x.node.slug,
        lastName: x.node.lastName,
        name: x.node.name,
        office: x.rel.office
      }],
    '^lastName')
} AS class

`;
