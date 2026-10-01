/**
 * The Trash: soft-deleted maps, articles (all four article tables),
 * calendars and calendar entries, listed together. Pure helpers (no DB) for the list,
 * restore and purge modules, the API and the tests.
 */

/** Which table a trashed item lives in. */
export const TRASH_KINDS = ["map", "article", "person", "organization", "territory", "calendar", "calendarEntry"] as const;
export type TrashKind = (typeof TRASH_KINDS)[number];

/** The Trash page's tabs. */
export type TrashGroup = "maps" | "articles" | "calendar";

export const groupOf = (kind: TrashKind): TrashGroup => (kind === "map" ? "maps" : kind === "calendar" || kind === "calendarEntry" ? "calendar" : "articles");

export interface TrashRef {
  kind: TrashKind;
  id: string;
}

export interface TrashItem extends TrashRef {
  name: string;
  /** "Map", "Character", "Event"… */
  subtype: string;
  /** ms since epoch. */
  deletedAt: number;
  /** Maps: trashed sub-maps that go with it (restored when trashed together, always purged with it). */
  childCount: number;
  /** Player characters: campaigns whose roster lists them (purging removes them from it). */
  campaignCount: number;
}

export type TrashSort = "deleted" | "name" | "type";

export interface TrashQuery {
  q?: string;
  group?: TrashGroup | "all";
  sort?: TrashSort;
  dir?: "asc" | "desc";
}

/** Search (name or type), tab filter and sort; deleted newest first by default. */
export function filterSortTrash(items: TrashItem[], { q = "", group = "all", sort = "deleted", dir }: TrashQuery = {}): TrashItem[] {
  const needle = q.trim().toLowerCase();
  const direction = dir ?? (sort === "deleted" ? "desc" : "asc");
  const sign = direction === "asc" ? 1 : -1;
  const byName = (a: TrashItem, b: TrashItem) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  // The chosen key follows the direction; ties always read A–Z.
  const primary = (a: TrashItem, b: TrashItem) =>
    sort === "name" ? byName(a, b) : sort === "type" ? a.subtype.localeCompare(b.subtype) : a.deletedAt - b.deletedAt;
  return items
    .filter((item) => group === "all" || groupOf(item.kind) === group)
    .filter((item) => !needle || item.name.toLowerCase().includes(needle) || item.subtype.toLowerCase().includes(needle))
    .sort((a, b) => sign * primary(a, b) || byName(a, b) || b.deletedAt - a.deletedAt);
}

/** Items per tab, for the tab counts. */
export function countByGroup(items: TrashItem[]): Record<TrashGroup | "all", number> {
  const counts = { all: items.length, maps: 0, articles: 0, calendar: 0 };
  for (const item of items) counts[groupOf(item.kind)]++;
  return counts;
}

export interface MapNode {
  id: string;
  parentId: string | null;
  deletedAt: number | null;
}

/**
 * Trashed maps shown in the Trash: those whose parent isn't trashed too
 * (a trashed map under a trashed parent goes with that parent).
 */
export function trashedMapRoots(maps: MapNode[]): MapNode[] {
  const byId = new Map(maps.map((m) => [m.id, m]));
  return maps.filter((m) => m.deletedAt !== null && !(m.parentId && byId.get(m.parentId)?.deletedAt != null));
}

/** Every trashed map under `rootId` (not the root), following trashed maps only. */
export function trashedDescendants(maps: MapNode[], rootId: string): MapNode[] {
  return trashedDescendantsLookup(maps)(rootId);
}

/** trashedDescendants for many roots, indexing the maps once. */
export function trashedDescendantsLookup(maps: MapNode[]): (rootId: string) => MapNode[] {
  const children = new Map<string, MapNode[]>();
  for (const m of maps) {
    if (m.parentId && m.deletedAt !== null) children.set(m.parentId, [...(children.get(m.parentId) ?? []), m]);
  }
  return (rootId) => descendantsIn(children, rootId);
}

function descendantsIn(children: Map<string, MapNode[]>, rootId: string): MapNode[] {
  const out: MapNode[] = [];
  const seen = new Set([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    for (const child of children.get(queue.shift()!) ?? []) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      out.push(child);
      queue.push(child.id);
    }
  }
  return out;
}

/** Days left before auto-delete (0 once due), or null when retention is off. */
export function daysUntilPurge(deletedAt: number, retentionDays: number | null, now: number): number | null {
  if (retentionDays === null) return null;
  const due = deletedAt + retentionDays * 86_400_000;
  return Math.max(0, Math.ceil((due - now) / 86_400_000));
}

/** Validates a request's `items`: a non-empty list of known refs (deduplicated). */
export function parseTrashRefs(value: unknown): TrashRef[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 1000) return null;
  const refs = new Map<string, TrashRef>();
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const { kind, id } = item as Record<string, unknown>;
    if (!TRASH_KINDS.includes(kind as TrashKind) || typeof id !== "string" || !id) return null;
    refs.set(`${kind}:${id}`, { kind: kind as TrashKind, id });
  }
  return [...refs.values()];
}
