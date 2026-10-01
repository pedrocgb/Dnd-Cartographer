"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Folder, FolderPlus, X } from "lucide-react";
import { usePopover } from "@/components/usePopover";
import { DEFAULT_FOLDER_COLOR } from "@/components/maps/FolderSettingsPanel";
import { useArticleFolders } from "./article-folders";
import { folderPath, foldersOfArticle } from "./folder-tree";

/**
 * The article page's Folders row (under the tags): the user folders holding
 * this article, as chips, and "Add to folder". Only folder memberships
 * change; the article itself is never saved from here.
 */
export default function ArticleFoldersControl({ articleId }: { articleId: string }) {
  const store = useArticleFolders();
  const { open, setOpen, root, trigger, pop } = usePopover();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const holding = useMemo(() => (store ? foldersOfArticle(store.folders, store.items, articleId) : []), [store, articleId]);
  const options = useMemo(() => {
    if (!store) return [];
    const held = new Set(holding.map((f) => f.id));
    const needle = query.trim().toLowerCase();
    return store.folders
      .filter((f) => !held.has(f.id))
      .map((f) => ({ folder: f, label: [...folderPath(store.folders, f.id).map((p) => p.name), f.name].join(" / ") }))
      .filter((o) => !needle || o.label.toLowerCase().includes(needle))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [store, holding, query]);

  if (!store) return null;

  async function add(folderId: string) {
    setOpen(false);
    setQuery("");
    setError(await store!.addArticles(folderId, [articleId]));
  }

  return (
    <div className="article-folders-control" ref={root}>
      <span className="field-label">Folders</span>
      {holding.map((f) => (
        <span key={f.id} className="article-folder-chip">
          <Folder size={12} strokeWidth={2.25} aria-hidden style={{ color: f.color ?? DEFAULT_FOLDER_COLOR }} />
          {f.name}
          <button type="button" aria-label={`Remove from ${f.name}`} data-tooltip="Remove from this folder" onClick={async () => setError(await store.removeArticles(f.id, [articleId]))}>
            <X size={11} strokeWidth={2.5} />
          </button>
        </span>
      ))}
      <button type="button" ref={trigger} className="btn btn-sm btn-ghost" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} disabled={store.folders.length === 0} data-tooltip={store.folders.length === 0 ? "Create a folder in the sidebar's Folders tab first" : undefined}>
        <FolderPlus size={13} strokeWidth={2.25} />
        Add to folder
      </button>
      {error && (
        <span className="form-error" role="alert">
          {error}
        </span>
      )}
      {open &&
        createPortal(
          <div ref={pop} className="article-folder-popover" style={{ position: "fixed", visibility: "hidden" }}>
            <input type="search" placeholder="Search folders…" aria-label="Search folders" value={query} autoFocus onChange={(e) => setQuery(e.target.value)} />
            <ul role="listbox" aria-label="Folders">
              {options.map(({ folder, label }) => (
                <li key={folder.id}>
                  <button type="button" role="option" aria-selected={false} onClick={() => void add(folder.id)}>
                    <Folder size={13} strokeWidth={2.25} aria-hidden style={{ color: folder.color ?? DEFAULT_FOLDER_COLOR }} />
                    {label}
                  </button>
                </li>
              ))}
              {options.length === 0 && <li className="field-label">{holding.length === store.folders.length ? "It's in every folder already." : "No folder matches."}</li>}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
