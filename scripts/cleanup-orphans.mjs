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
 * Removes original/tile/thumbnail directories whose asset row is gone: left
 * by a crashed or interrupted job whose row never made it into the
 * database, or by a Trash purge whose file removal failed (the rows go in
 * a transaction, the files after it).
 */
export async function cleanupOrphans() {
  const dataDir = resolveDataDir();
  const client = createClient({ url: `file:${path.join(dataDir, "world-wiki.db")}` });

  const { rows } = await client.execute("SELECT id FROM map_assets");
  const knownAssetIds = new Set(rows.map((r) => r.id));
  const relations = await cleanupOrphanRelations(client);
  const portraits = await cleanupOrphanPortraits(client, dataDir);
  client.close();

  let removed = 0;
  for (const category of ["originals", "tiles", "thumbnails"]) {
    const dir = path.join(dataDir, category);
    for (const assetId of await listDirs(dir)) {
      if (!knownAssetIds.has(assetId)) {
        await rm(path.join(dir, assetId), { recursive: true, force: true });
        removed += 1;
      }
    }
  }
  return { removed, relations, portraits };
}

const RECORD_TABLES = ["people", "organizations", "territories", "articles"];

/** portraits/<ownerType>/ folder per record table (see src/server/assets/portrait-paths.ts). */
const PORTRAIT_OWNERS = { person: "people", organization: "organizations", territory: "territories", article: "articles" };

async function listFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Removes portrait images (and their kept originals and crop files) whose
 * record row no longer exists — left by a purge whose file removal failed.
 * A soft-deleted record still has its row, so its portrait stays.
 */
async function cleanupOrphanPortraits(client, dataDir) {
  let removed = 0;
  for (const [ownerType, table] of Object.entries(PORTRAIT_OWNERS)) {
    const { rows } = await client.execute(`SELECT id FROM ${table}`);
    const known = new Set(rows.map((r) => r.id));
    const dir = path.join(dataDir, "portraits", ownerType);
    for (const folder of [dir, path.join(dir, "originals")]) {
      for (const file of await listFiles(folder)) {
        const id = file.replace(/\.(webp|json)$/, "");
        if (id !== file && !known.has(id)) {
          await rm(path.join(folder, file), { force: true });
          removed += 1;
        }
      }
    }
  }
  return removed;
}

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
  cleanupOrphans().then(({ removed, relations, portraits }) => {
    console.log(`Removed ${removed} orphaned asset directory(ies), ${portraits} orphaned portrait file(s) and ${relations} orphaned relation(s).`);
  });
}
