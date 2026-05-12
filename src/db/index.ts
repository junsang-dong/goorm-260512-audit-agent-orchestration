import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

export function createDb(connectionString?: string) {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

/** Lazy singleton for server handlers */
let _db: Db | null = null;
export function getDb(): Db {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

export * from "./schema";
