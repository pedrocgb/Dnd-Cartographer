/**
 * Manual article tags: stored as a JSON string[] in each table's `tags`
 * column (same convention as markers.status_tags). The template's own tag
 * is never stored — it is always shown first and can't be removed.
 */

export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 40;

export function parseTags(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Trims, drops empties and case-insensitive duplicates (first spelling
 * wins), drops any tag equal to `reserved` (the template tag), and caps the
 * count and length. Returns null when `raw` isn't an array.
 */
export function sanitizeTags(raw: unknown, reserved?: string): string[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  if (reserved) seen.add(reserved.toLowerCase());
  const out: string[] = [];
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const tag = value.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

export function encodeTags(tags: string[]): string {
  return JSON.stringify(tags);
}
