import path from "node:path";
import { SUBDIRS } from "../data-dir";

/**
 * All callers work with relative asset keys (e.g. "abc123/original.png"),
 * never raw filesystem paths. This keeps map/marker code portable to a
 * future hosted storage backend without rewriting behavior — only this
 * module's resolve functions would need to change.
 */
export type AssetCategory = keyof typeof SUBDIRS;

function assertSafeKey(key: string): void {
  const normalized = path.normalize(key);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    throw new Error(`Unsafe asset key: ${key}`);
  }
}

export function resolveAssetPath(category: AssetCategory, key: string): string {
  assertSafeKey(key);
  return path.join(SUBDIRS[category], key);
}

export function makeAssetKey(id: string, filename: string): string {
  return path.posix.join(id, filename);
}
