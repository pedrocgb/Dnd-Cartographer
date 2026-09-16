import { createClient } from "@libsql/client";
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

function resolveDataDir() {
  const override = process.env.WORLD_WIKI_DATA_DIR;
  return override ? path.resolve(override) : path.join(os.homedir(), ".world-wiki-maps", "data");
}

/**
 * A consistent snapshot without stopping the app: SQLite's VACUUM INTO
 * produces a complete, transactionally-consistent copy of the database in
 * one statement, safe to run against a live connection — unlike copying
 * the .db file directly, which could catch a write mid-flight or miss
 * data still sitting in a WAL/journal file.
 */
export async function backup(destDir) {
  const dataDir = resolveDataDir();
  await mkdir(destDir, { recursive: true });

  const existing = await stat(destDir).catch(() => null);
  if (existing) {
    const contents = await readdir(destDir);
    if (contents.length > 0) {
      throw new Error(`Backup destination ${destDir} is not empty.`);
    }
  }

  const dbFile = path.join(dataDir, "world-wiki.db");
  const backupDbFile = path.join(destDir, "world-wiki.db");
  const client = createClient({ url: `file:${dbFile}` });
  await client.execute(`VACUUM INTO '${backupDbFile.replace(/'/g, "''")}'`);
  client.close();

  for (const category of ["originals", "tiles", "thumbnails"]) {
    const src = path.join(dataDir, category);
    const dest = path.join(destDir, category);
    await cp(src, dest, { recursive: true }).catch(() => {
      // category directory doesn't exist yet — nothing to copy
    });
  }

  // temp/ is ephemeral upload staging and exports/ is derived output —
  // neither belongs in a backup of the durable workspace.
  await rm(path.join(destDir, "temp"), { recursive: true, force: true });

  return destDir;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] ?? "")) {
  const dest = process.argv[2];
  if (!dest) {
    console.error("Usage: node scripts/backup.mjs <destination-directory>");
    process.exit(1);
  }
  backup(path.resolve(dest)).then((dir) => console.log(`Backup written to ${dir}`));
}
