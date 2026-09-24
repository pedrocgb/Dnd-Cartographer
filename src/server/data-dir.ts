import { mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * The data directory holds everything that must survive app rebuilds and
 * updates: the SQLite database, originals, tiles, thumbnails, temp uploads,
 * and exports. It lives outside the source/build tree by default.
 */
export function resolveDataDir(): string {
  const override = process.env.WORLD_WIKI_DATA_DIR;
  if (override) return path.resolve(override);
  return path.join(os.homedir(), ".world-wiki-maps", "data");
}

export const DATA_DIR = resolveDataDir();

export const SUBDIRS = {
  originals: path.join(DATA_DIR, "originals"),
  tiles: path.join(DATA_DIR, "tiles"),
  thumbnails: path.join(DATA_DIR, "thumbnails"),
  temp: path.join(DATA_DIR, "temp"),
  exports: path.join(DATA_DIR, "exports"),
  // Small square portrait images (territory coats of arms, person
  // portraits, organization crests) — stored directly, no tiling/dzi
  // pipeline, unlike map originals.
  portraits: path.join(DATA_DIR, "portraits"),
  // Images placed in rich-text documents (article bodies, descriptions),
  // one immutable webp per upload.
  articleImages: path.join(DATA_DIR, "article-images"),
} as const;

export const DB_FILE = path.join(DATA_DIR, "world-wiki.db");

export function ensureDataDirs(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  for (const dir of Object.values(SUBDIRS)) {
    mkdirSync(dir, { recursive: true });
  }
}
