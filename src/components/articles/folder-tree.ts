/**
 * The Articles page's own folders (the sidebar's "Folders" tab), pure: the
 * tree, search and lookups. An article can sit in several folders; one that
 * is no longer in the live lists (trashed) simply isn't shown.
 */
import { personTemplate, type ArticleTemplateKey } from "../../server/articles/templates";
import type { ArticleLists } from "./ArticlesSidebar";

export interface ArticleFolder {
  id: string;
  name: string;
  parentId: string | null;
  color: string | null;
}

export interface FolderItem {
  folderId: string;
  articleId: string;
}

export interface ArticleRef {
  id: string;
  name: string;
  template: ArticleTemplateKey;
}

export interface FolderNode {
  folder: ArticleFolder;
  folders: FolderNode[];
  articles: ArticleRef[];
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/** Every live article, by id, with the template it opens under. */
export function articleCatalog(lists: ArticleLists): Map<string, ArticleRef> {
  const refs: ArticleRef[] = [
    ...lists.territories.map((t) => ({ id: t.id, name: t.name, template: "territory" as const })),
    ...lists.people.map((p) => ({ id: p.id, name: p.name, template: personTemplate(p.kind) })),
    ...lists.organizations.map((o) => ({ id: o.id, name: o.name, template: "organization" as const })),
    ...lists.articles.map((a) => ({ id: a.id, name: a.title, template: a.template as ArticleTemplateKey })),
  ];
  return new Map(refs.map((r) => [r.id, r]));
}

/**
 * The folder tree, folders before articles, each alphabetical. With a
 * `needle` (lowercase): a folder whose name matches keeps all it holds,
 * otherwise it stays only to hold matching articles or subfolders.
 */
export function buildArticleFolderTree(folders: ArticleFolder[], items: FolderItem[], catalog: Map<string, ArticleRef>, needle = ""): FolderNode[] {
  const ids = new Set(folders.map((f) => f.id));
  const parentOf = (f: ArticleFolder) => (f.parentId && ids.has(f.parentId) && f.parentId !== f.id ? f.parentId : null);
  const articlesIn = new Map<string, ArticleRef[]>();
  for (const item of items) {
    const ref = catalog.get(item.articleId);
    if (ref) articlesIn.set(item.folderId, [...(articlesIn.get(item.folderId) ?? []), ref]);
  }
  const seen = new Set<string>(); // guards against a cycle in older data

  function nodesUnder(parentId: string | null): FolderNode[] {
    const out: FolderNode[] = [];
    for (const folder of folders.filter((f) => parentOf(f) === parentId).sort(byName)) {
      if (seen.has(folder.id)) continue;
      seen.add(folder.id);
      out.push({ folder, folders: nodesUnder(folder.id), articles: [...(articlesIn.get(folder.id) ?? [])].sort(byName) });
    }
    return out;
  }

  const tree = nodesUnder(null);
  return needle ? filterNodes(tree, needle) : tree;
}

function filterNodes(nodes: FolderNode[], needle: string): FolderNode[] {
  return nodes.flatMap((node) => {
    if (node.folder.name.toLowerCase().includes(needle)) return [node];
    const folders = filterNodes(node.folders, needle);
    const articles = node.articles.filter((a) => a.name.toLowerCase().includes(needle));
    return folders.length || articles.length ? [{ ...node, folders, articles }] : [];
  });
}

/** The node for `folderId` anywhere in the tree. */
export function findNode(nodes: FolderNode[], folderId: string): FolderNode | null {
  for (const node of nodes) {
    if (node.folder.id === folderId) return node;
    const inner = findNode(node.folders, folderId);
    if (inner) return inner;
  }
  return null;
}

/** The folder's ancestors, root first (for a breadcrumb). */
export function folderPath(folders: ArticleFolder[], folderId: string): ArticleFolder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: ArticleFolder[] = [];
  const seen = new Set<string>([folderId]);
  let current = byId.get(folderId)?.parentId ?? null;
  while (current && byId.has(current) && !seen.has(current)) {
    seen.add(current);
    path.unshift(byId.get(current)!);
    current = byId.get(current)!.parentId;
  }
  return path;
}

/** The folders an article is filed in. */
export function foldersOfArticle(folders: ArticleFolder[], items: FolderItem[], articleId: string): ArticleFolder[] {
  const holding = new Set(items.filter((i) => i.articleId === articleId).map((i) => i.folderId));
  return folders.filter((f) => holding.has(f.id)).sort(byName);
}
