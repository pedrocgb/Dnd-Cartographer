import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { ensureDataDirs, DB_FILE } from "../data-dir";
import * as schema from "./schema";

ensureDataDirs();

const client = createClient({ url: `file:${DB_FILE}` });

// SQLite disables FK enforcement by default per-connection; the plan
// requires it verified on every connection, not just assumed from schema.
// busy_timeout matters because the web server and worker are separate OS
// processes, each with their own connection to the same file — without it,
// one process's write while the other holds the lock fails immediately with
// SQLITE_BUSY instead of waiting a bit for the lock to free up. Reproduced
// live under concurrent load (bulk marker inserts racing the worker) and
// confirmed this eliminates it — see docs/batch-7-release-readiness.md.
// No top-level await here (keeps this module safe to import from contexts
// that don't support it) — callers that need the guarantee await ready().
const ready = client
  .execute("PRAGMA foreign_keys = ON;")
  .then(() => client.execute("PRAGMA busy_timeout = 5000;"));

export function whenReady(): Promise<unknown> {
  return ready;
}

export const db = drizzle(client, { schema });
export { client as sqliteClient };
