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
  return removed;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  cleanupOrphans().then((removed) => {
    console.log(`Removed ${removed} orphaned asset directory(ies).`);
  });
}
