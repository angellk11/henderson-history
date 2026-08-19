import "dotenv/config";
import neo4j, { Session } from "neo4j-driver";

const URI = process.env.NEO4J_URI;
const USER = process.env.NEO4J_USER;
const PASS = process.env.NEO4J_PASSWORD;
const DB = process.env.NEO4J_DATABASE ?? 'neo4j';

if (!URI || !USER || !PASS) {
  throw new Error('Missing Neo4j env vars (NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD)');
}

export const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASS), {
  maxConnectionPoolSize: 10,
  connectionAcquisitionTimeout: 30_000,
});

export const database = DB;
export const READ = neo4j.session.READ;

export function newSession(defaultAccessMode = READ) {
    return driver.session({ database, defaultAccessMode });
}

/** Convert a Neo4j Integer-like value to a JS number. */
export function asNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v !== null && 'toNumber' in (v as any)) {
    return (v as any).toNumber();
  }
  return null;
}

export async function withSession<T>(fn: (s: Session) => Promise<T>) {
  const session = newSession();
  try {
    return await fn(session);
  } finally {
    await session.close();
  }
}
