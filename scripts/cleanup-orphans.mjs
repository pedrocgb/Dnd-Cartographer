import { createClient } from "@libsql/client";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

function resolveDataDir() {
  const override = process.env.WORLD_WIKI_DATA_DIR;
  return override ? path.resolve(override) : path.join(os.homedir(), ".world-wiki-maps", "data");
}

async function listDirs(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Removes tile/thumbnail directories left behind by a crashed or
 * interrupted job whose asset row never made it into the database — the
 * only orphan scenario possible under this app's soft-delete model (assets
 * are never hard-deleted while a map still references them).
 */
export async function cleanupOrphans() {
  const dataDir = resolveDataDir();
  const client = createClient({ url: `file:${path.join(dataDir, "world-wiki.db")}` });

  const { rows } = await client.execute("SELECT id FROM map_assets");
  const knownAssetIds = new Set(rows.map((r) => r.id));
  const relations = await cleanupOrphanRelations(client);
  client.close();

  let removed = 0;
  for (const category of ["tiles", "thumbnails"]) {
    const dir = path.join(dataDir, category);
    for (const assetId of await listDirs(dir)) {
      if (!knownAssetIds.has(assetId)) {
        await rm(path.join(dir, assetId), { recursive: true, force: true });
        removed += 1;
      }
    }
  }
  return { removed, relations };
}

const RECORD_TABLES = ["people", "organizations", "territories", "articles"];

/**
 * Hard-deletes relations whose end no longer exists in any record table
 * (records are soft-deleted, so this only follows a purge). Relations to a
 * soft-deleted record stay: they come back when it's restored.
 */
async function cleanupOrphanRelations(client) {
  const exists = (col) => `(${RECORD_TABLES.map((t) => `EXISTS (SELECT 1 FROM ${t} WHERE id = relations.${col})`).join(" OR ")})`;
  const result = await client.execute(`DELETE FROM relations WHERE NOT ${exists("from_id")} OR NOT ${exists("to_id")}`);
  return result.rowsAffected;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  cleanupOrphans().then(({ removed, relations }) => {
    console.log(`Removed ${removed} orphaned asset directory(ies) and ${relations} orphaned relation(s).`);
  });
}
