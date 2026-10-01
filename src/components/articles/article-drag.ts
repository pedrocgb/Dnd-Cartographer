/**
 * Drag payloads on the Articles sidebar: an article row (from a folder, or
 * from the By type tab when `from` is null) or a user folder. Only the
 * Folders tab takes drops.
 */
export const ARTICLE_DRAG_TYPE = "application/x-world-wiki-article-item";

export type ArticleDrag = { kind: "article"; id: string; from: string | null } | { kind: "folder"; id: string };

export function writeArticleDrag(e: React.DragEvent, item: ArticleDrag) {
  e.dataTransfer.effectAllowed = "copyMove";
  e.dataTransfer.setData(ARTICLE_DRAG_TYPE, JSON.stringify(item));
}

export function readArticleDrag(e: React.DragEvent): ArticleDrag | null {
  try {
    const parsed = JSON.parse(e.dataTransfer.getData(ARTICLE_DRAG_TYPE));
    if (parsed?.kind === "folder" && typeof parsed.id === "string") return { kind: "folder", id: parsed.id };
    if (parsed?.kind === "article" && typeof parsed.id === "string") return { kind: "article", id: parsed.id, from: typeof parsed.from === "string" ? parsed.from : null };
  } catch {
    // not ours
  }
  return null;
}

export const isArticleDrag = (e: React.DragEvent) => e.dataTransfer.types.includes(ARTICLE_DRAG_TYPE);
