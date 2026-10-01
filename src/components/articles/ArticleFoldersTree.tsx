"use client";

import { useState } from "react";
import { Folder, FolderOpen, FolderPlus, Settings } from "lucide-react";
import { templateOf } from "./templates";
import { isArticleDrag, readArticleDrag, writeArticleDrag, type ArticleDrag } from "./article-drag";
import type { FolderNode } from "./folder-tree";
import { DEFAULT_FOLDER_COLOR } from "@/components/maps/FolderSettingsPanel";
import type { ArticleTemplateKey } from "@/server/articles/templates";

type DropTarget = { kind: "root" } | { kind: "folder"; id: string };
const targetKey = (t: DropTarget) => (t.kind === "root" ? "root" : `folder:${t.id}`);

export interface FolderTreeActions {
  onToggleFolder: (id: string) => void;
  /** Shows the folder's page (its articles, settings and actions). */
  onOpenFolder: (id: string) => void;
  onOpenArticle: (template: ArticleTemplateKey, id: string) => void;
  onNewFolder: () => void;
  /** A folder dropped into another (or the root, null). */
  onMoveFolder: (id: string, parentId: string | null) => void;
  /** An article dropped on a folder: moved from `from`, or added (copy, or dragged from the By type tab). */
  onDropArticle: (articleId: string, from: string | null, to: string, copy: boolean) => void;
}

/**
 * The sidebar's Folders tab: the user's nested folders and the articles
 * filed in them (an article can show in several). Drag an article to
 * another folder to move it (Ctrl or Alt: also add it there), a folder onto
 * a folder to nest it, or onto empty space for the root.
 */
export default function ArticleFoldersTree({
  tree,
  searching,
  query,
  openFolders,
  selectedArticleId,
  selectedFolderId,
  actions,
}: {
  tree: FolderNode[];
  searching: boolean;
  query: string;
  openFolders: Set<string>;
  selectedArticleId: string | null;
  selectedFolderId: string | null;
  actions: FolderTreeActions;
}) {
  const [dragging, setDragging] = useState<ArticleDrag | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);

  function dragProps(item: ArticleDrag) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.stopPropagation();
        writeArticleDrag(e, item);
        setDragging(item);
      },
      onDragEnd: () => {
        setDragging(null);
        setDropKey(null);
      },
    };
  }

  /** A drop zone. Rows dragged in from the By type tab aren't in `dragging` (another component started them). */
  function dropProps(target: DropTarget) {
    const key = targetKey(target);
    const accepts = (item: ArticleDrag | null) => (target.kind === "root" ? item?.kind === "folder" : item === null || item.kind === "article" || item.id !== target.id);
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!isArticleDrag(e) || !accepts(dragging)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = dragging?.kind === "article" && dragging.from && !(e.ctrlKey || e.altKey) ? "move" : dragging?.kind === "folder" ? "move" : "copy";
        if (dropKey !== key) setDropKey(key);
      },
      onDrop: (e: React.DragEvent) => {
        const item = readArticleDrag(e);
        if (!item || !accepts(item)) return;
        e.preventDefault();
        e.stopPropagation();
        setDragging(null);
        setDropKey(null);
        if (item.kind === "folder") actions.onMoveFolder(item.id, target.kind === "root" ? null : target.id);
        else if (target.kind === "folder" && item.from !== target.id) actions.onDropArticle(item.id, item.from, target.id, e.ctrlKey || e.altKey);
      },
    };
  }

  function renderNode(node: FolderNode): React.ReactNode {
    const { folder } = node;
    const open = searching || openFolders.has(folder.id);
    const tint = { color: folder.color ?? DEFAULT_FOLDER_COLOR };
    const rowClass = [
      "maps-row",
      "maps-folder-row",
      dropKey === `folder:${folder.id}` && "drop-target",
      dragging?.kind === "folder" && dragging.id === folder.id && "dragging",
      selectedFolderId === folder.id && "active",
    ]
      .filter(Boolean)
      .join(" ");
    const count = node.folders.length + node.articles.length;
    return (
      <li key={folder.id} {...dropProps({ kind: "folder", id: folder.id })}>
        <div className={rowClass} {...dragProps({ kind: "folder", id: folder.id })}>
          <span className="maps-row-toggle" aria-hidden />
          <button type="button" className="maps-row-main" aria-expanded={open} onClick={() => actions.onToggleFolder(folder.id)}>
            {open ? <FolderOpen size={15} strokeWidth={2.25} aria-hidden style={tint} /> : <Folder size={15} strokeWidth={2.25} aria-hidden style={tint} />}
            <span className="maps-row-name">
              {folder.name} ({count})
            </span>
          </button>
          <span className="maps-row-actions">
            <button type="button" className="maps-row-action" aria-label={`Open ${folder.name}`} data-tooltip="Open folder" onClick={() => actions.onOpenFolder(folder.id)}>
              <Settings size={13} strokeWidth={2.25} />
            </button>
          </span>
        </div>
        {open && (
          <ul className="maps-tree-children">
            {node.folders.map(renderNode)}
            {node.articles.map((article) => {
              const { Icon, label } = templateOf(article.template);
              const selected = selectedArticleId === article.id;
              return (
                <li key={article.id}>
                  <div
                    className={["maps-row", selected && "active", dragging?.kind === "article" && dragging.id === article.id && dragging.from === folder.id && "dragging"].filter(Boolean).join(" ")}
                    {...dragProps({ kind: "article", id: article.id, from: folder.id })}
                  >
                    <span className="maps-row-toggle" aria-hidden />
                    <button type="button" className="maps-row-main" onClick={() => actions.onOpenArticle(article.template, article.id)} data-tooltip={label}>
                      <Icon size={15} strokeWidth={2.25} aria-hidden />
                      <span className="maps-row-name">{article.name}</span>
                    </button>
                  </div>
                </li>
              );
            })}
            {count === 0 && <li className="field-label maps-tree-empty">Empty: drag articles here, or open the folder to add some.</li>}
          </ul>
        )}
      </li>
    );
  }

  return (
    <>
      <nav
        className={dropKey === "root" ? "maps-tree article-folders-tree drop-target" : "maps-tree article-folders-tree"}
        aria-label="Your folders"
        {...dropProps({ kind: "root" })}
        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropKey(null)}
      >
        <ul className="maps-tree-root">{tree.map(renderNode)}</ul>
        {tree.length === 0 && (
          <p className="field-label">{searching ? <>Nothing matches &ldquo;{query.trim()}&rdquo;.</> : "No folders yet. Create one to group articles your own way, a city with its people and laws, a faction, a campaign arc…"}</p>
        )}
        {dragging && (
          <p className="field-label maps-tree-drop-hint">
            {dragging.kind === "folder" ? "Drop on a folder to nest it, or here for the top level." : "Drop on a folder to move it there. Hold Ctrl to also keep it here."}
          </p>
        )}
      </nav>
      <button type="button" className="articles-folder maps-create-folder" onClick={actions.onNewFolder}>
        <FolderPlus size={16} strokeWidth={2.25} aria-hidden />
        <span className="articles-folder-name">New folder</span>
      </button>
    </>
  );
}
