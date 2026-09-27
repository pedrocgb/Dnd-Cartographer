/**
 * The maps sidebar tree (pure). Folders nest by `parentId`. A map shows in
 * its folder when it has one; otherwise under its parent map (the existing
 * map hierarchy); otherwise at the root. Folders come first, then maps,
 * each alphabetical.
 */
export interface MapListItem {
  id: string;
  name: string;
  parentId: string | null;
  folderId: string | null;
}

export interface FolderListItem {
  id: string;
  name: string;
  parentId: string | null;
}

export type TreeEntry<M extends MapListItem = MapListItem, F extends FolderListItem = FolderListItem> =
  | { kind: "folder"; item: F; children: TreeEntry<M, F>[] }
  | { kind: "map"; item: M; children: TreeEntry<M, F>[] };

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/** Where each item sits: the id of its folder / parent map, or null at the root. */
function placement<M extends MapListItem, F extends FolderListItem>(folders: F[], maps: M[]) {
  const folderIds = new Set(folders.map((f) => f.id));
  const mapIds = new Set(maps.map((m) => m.id));
  const folderOf = (f: F) => (f.parentId && folderIds.has(f.parentId) && f.parentId !== f.id ? f.parentId : null);
  const containerOf = (m: M): { kind: "folder" | "map"; id: string } | null => {
    if (m.folderId && folderIds.has(m.folderId)) return { kind: "folder", id: m.folderId };
    if (m.parentId && mapIds.has(m.parentId) && m.parentId !== m.id) return { kind: "map", id: m.parentId };
    return null;
  };
  return { folderOf, containerOf };
}

/**
 * The tree, filtered by `needle` (lowercase) when given: a match keeps its
 * whole contents, and a non-matching folder or map stays only to hold a match.
 */
export function buildMapTree<M extends MapListItem, F extends FolderListItem>(folders: F[], maps: M[], needle = ""): TreeEntry<M, F>[] {
  const { folderOf, containerOf } = placement(folders, maps);
  const seen = new Set<string>(); // guards against a cycle in older data

  function childrenOf(kind: "folder" | "map" | null, id: string | null): TreeEntry<M, F>[] {
    const subFolders = kind === "map" ? [] : folders.filter((f) => folderOf(f) === id).sort(byName);
    const subMaps = maps
      .filter((m) => {
        const c = containerOf(m);
        return kind === null ? c === null : c?.kind === kind && c.id === id;
      })
      .sort(byName);
    const out: TreeEntry<M, F>[] = [];
    for (const f of subFolders) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      out.push({ kind: "folder", item: f, children: childrenOf("folder", f.id) });
    }
    for (const m of subMaps) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push({ kind: "map", item: m, children: childrenOf("map", m.id) });
    }
    return out;
  }

  const tree = childrenOf(null, null);
  return needle ? filterTree(tree, needle) : tree;
}

function filterTree<M extends MapListItem, F extends FolderListItem>(entries: TreeEntry<M, F>[], needle: string): TreeEntry<M, F>[] {
  return entries.flatMap((e) => {
    if (e.item.name.toLowerCase().includes(needle)) return [e];
    const children = filterTree(e.children, needle);
    return children.length ? [{ ...e, children }] : [];
  });
}

/** How many maps an entry holds at any depth (a folder's badge). */
export function countMaps(entry: TreeEntry): number {
  return entry.children.reduce((n, c) => n + (c.kind === "map" ? 1 : 0) + countMaps(c), 0);
}
