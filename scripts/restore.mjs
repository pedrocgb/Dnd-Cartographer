import { cp, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Restores a backup produced by backup.mjs into a fresh (must not already exist) data directory. */
export async function restore(backupDir, targetDataDir) {
  const existing = await stat(targetDataDir).catch(() => null);
  if (existing) {
    const contents = await readdir(targetDataDir);
    if (contents.length > 0) {
      throw new Error(`Restore target ${targetDataDir} already exists and is not empty.`);
    }
  }
  await mkdir(targetDataDir, { recursive: true });
  await cp(backupDir, targetDataDir, { recursive: true });
  await mkdir(path.join(targetDataDir, "temp"), { recursive: true });
  return targetDataDir;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] ?? "")) {
  const [backupDir, targetDataDir] = process.argv.slice(2);
  if (!backupDir || !targetDataDir) {
    console.error("Usage: node scripts/restore.mjs <backup-directory> <target-data-directory>");
    process.exit(1);
  }
  restore(path.resolve(backupDir), path.resolve(targetDataDir)).then((dir) =>
    console.log(`Restored into ${dir}`)
  );
}
