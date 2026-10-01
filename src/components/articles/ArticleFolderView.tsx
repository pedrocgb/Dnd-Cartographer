"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, CirclePlus, Folder, FolderPlus, ListPlus, RotateCcw, Search, Trash2, X } from "lucide-react";
import ColorWheel from "@/components/ColorWheel";
import ConfirmDialog from "@/components/ConfirmDialog";
import Modal from "@/components/Modal";
import { DEFAULT_FOLDER_COLOR } from "@/components/maps/FolderSettingsPanel";
import { MAX_FOLDER_NAME_LENGTH, folderSubtree } from "@/server/maps/folders";
import type { ArticleTemplateKey } from "@/server/articles/templates";
import { ARTICLE_TEMPLATES, templateOf } from "./templates";
import type { ArticleFolderStore } from "./article-folders";
import type { ArticleFolder, ArticleRef, FolderNode } from "./folder-tree";

/** The color wheel reports every drag step; saves wait for it to settle. */
const COLOR_SAVE_DELAY_MS = 300;

/** Articles grouped by template, in the By type tab's order. */
function byTemplate(articles: ArticleRef[]): { template: ArticleTemplateKey; articles: ArticleRef[] }[] {
  return ARTICLE_TEMPLATES.map((t) => ({ template: t.key, articles: articles.filter((a) => a.template === t.key).sort((a, b) => a.name.localeCompare(b.name)) })).filter((g) => g.articles.length > 0);
}

/** Pick existing articles to file in the folder: search, tick, add. Already-filed ones show ticked. */
function AddArticlesDialog({ folderName, catalog, filed, onAdd, onClose }: { folderName: string; catalog: Map<string, ArticleRef>; filed: Set<string>; onAdd: (ids: string[]) => Promise<string | null>; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needle = query.trim().toLowerCase();
  const groups = useMemo(() => byTemplate([...catalog.values()].filter((a) => !needle || a.name.toLowerCase().includes(needle))), [catalog, needle]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function add() {
    if (picked.size === 0) return;
    setBusy(true);
    const problem = await onAdd([...picked]);
    setBusy(false);
    if (problem) setError(problem);
    else onClose();
  }

  return (
    <Modal open onClose={() => !busy && onClose()} title={`Add articles to “${folderName}”`}>
      <label className="settings-search">
        <Search size={15} strokeWidth={2.25} aria-hidden />
        <input type="search" placeholder="Search articles…" aria-label="Search articles" value={query} autoFocus onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="folder-picker">
        {groups.length === 0 && <p className="field-label">{catalog.size === 0 ? "No articles yet." : <>No article matches &ldquo;{query.trim()}&rdquo;.</>}</p>}
        {groups.map(({ template, articles }) => {
          const { Icon, plural } = templateOf(template);
          return (
            <section key={template} className="folder-picker-group" aria-label={plural}>
              <h4>
                <Icon size={14} strokeWidth={2.25} aria-hidden />
                {plural}
              </h4>
              {articles.map((a) => {
                const already = filed.has(a.id);
                return (
                  <label key={a.id} className={already ? "folder-picker-row filed" : "folder-picker-row"}>
                    <input type="checkbox" checked={already || picked.has(a.id)} disabled={already} onChange={() => toggle(a.id)} />
                    <span>{a.name}</span>
                    {already && <span className="field-label">in this folder</span>}
                  </label>
                );
              })}
            </section>
          );
        })}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="confirm-dialog-actions">
        <button type="button" className="btn btn-sm" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => void add()} disabled={busy || picked.size === 0}>
          {busy ? "Adding…" : picked.size > 0 ? `Add ${picked.size} article${picked.size === 1 ? "" : "s"}` : "Add"}
        </button>
      </div>
    </Modal>
  );
}

/**
 * A user folder's page (the main pane): its name and color, what it holds
 * (subfolders, then articles by type), and its actions. Mount it keyed by
 * folder id. Removing an article here only takes it out of the folder.
 */
export default function ArticleFolderView({
  node,
  path,
  folders,
  catalog,
  store,
  onOpenFolder,
  onOpenArticle,
  onCreateArticle,
  onNewSubfolder,
  onDeleted,
}: {
  node: FolderNode;
  /** Ancestors, root first. */
  path: ArticleFolder[];
  folders: ArticleFolder[];
  catalog: Map<string, ArticleRef>;
  store: ArticleFolderStore;
  onOpenFolder: (id: string) => void;
  onOpenArticle: (template: ArticleTemplateKey, id: string) => void;
  /** Opens the create-article chooser; the new article is filed here. */
  onCreateArticle: () => void;
  onNewSubfolder: () => void;
  onDeleted: () => void;
}) {
  const { folder } = node;
  const [name, setName] = useState(folder.name);
  const [color, setColor] = useState(folder.color);
  const [wheelKey, setWheelKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const colorTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(colorTimerRef.current), []);

  const filed = useMemo(() => new Set(node.articles.map((a) => a.id)), [node.articles]);
  const subfolderCount = folderSubtree(folders, folder.id).size - 1;

  async function save(body: { name?: string; color?: string | null }) {
    setError(await store.patchFolder(folder.id, body));
  }

  function commitName() {
    const next = name.trim();
    if (!next) return setName(folder.name);
    if (next !== folder.name) void save({ name: next });
  }

  function changeColor(next: string | null) {
    setColor(next);
    clearTimeout(colorTimerRef.current);
    colorTimerRef.current = setTimeout(() => void save({ color: next }), COLOR_SAVE_DELAY_MS);
  }

  async function remove(articleId: string) {
    setError(await store.removeArticles(folder.id, [articleId]));
  }

  async function confirmDelete() {
    setBusy(true);
    const problem = await store.deleteFolder(folder.id);
    setBusy(false);
    if (problem) return setError(problem);
    setDeleting(false);
    onDeleted();
  }

  return (
    <div className="article-folder-view">
      {path.length > 0 && (
        <nav className="article-folder-path" aria-label="Folder path">
          {path.map((p) => (
            <span key={p.id}>
              <button type="button" className="btn-link" onClick={() => onOpenFolder(p.id)}>
                {p.name}
              </button>
              <ChevronRight size={12} strokeWidth={2.25} aria-hidden />
            </span>
          ))}
        </nav>
      )}

      <header className="article-folder-head">
        <Folder size={30} strokeWidth={1.75} aria-hidden style={{ color: color ?? DEFAULT_FOLDER_COLOR }} />
        <input
          className="article-folder-name"
          aria-label="Folder name"
          value={name}
          maxLength={MAX_FOLDER_NAME_LENGTH}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      </header>
      <p className="field-label">Your own grouping: filing an article here never changes it, its type, relationships or family trees.</p>

      <div className="article-folder-actions">
        <button type="button" className="btn btn-sm btn-primary" onClick={() => setAdding(true)}>
          <ListPlus size={14} strokeWidth={2.25} />
          Add articles
        </button>
        <button type="button" className="btn btn-sm btn-create" onClick={onCreateArticle}>
          <CirclePlus size={14} strokeWidth={2.25} />
          Create article here
        </button>
        <button type="button" className="btn btn-sm" onClick={onNewSubfolder}>
          <FolderPlus size={14} strokeWidth={2.25} />
          New subfolder
        </button>
        <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleting(true)}>
          <Trash2 size={14} strokeWidth={2.25} />
          Delete folder
        </button>
      </div>

      <details className="article-folder-color">
        <summary>Folder color</summary>
        <div className="article-folder-color-body">
          {color && (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                changeColor(null);
                setWheelKey((k) => k + 1);
              }}
              data-tooltip="Back to the default folder color"
            >
              <RotateCcw size={12} strokeWidth={2.25} />
              Default
            </button>
          )}
          <ColorWheel key={wheelKey} value={color ?? DEFAULT_FOLDER_COLOR} onChange={changeColor} />
        </div>
      </details>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {node.folders.length > 0 && (
        <section className="article-folder-section" aria-label="Subfolders">
          <h2>Subfolders</h2>
          <div className="article-folder-tiles">
            {node.folders.map((sub) => (
              <button key={sub.folder.id} type="button" className="article-folder-tile" onClick={() => onOpenFolder(sub.folder.id)}>
                <Folder size={18} strokeWidth={2.25} aria-hidden style={{ color: sub.folder.color ?? DEFAULT_FOLDER_COLOR }} />
                <span>{sub.folder.name}</span>
                <span className="field-label">{sub.folders.length + sub.articles.length}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {node.articles.length === 0 ? (
        <div className="trash-state">
          <Folder size={28} strokeWidth={1.75} aria-hidden />
          <strong>No articles in this folder yet</strong>
          <p>Add existing ones, create a new one here, or drag articles onto the folder in the sidebar.</p>
        </div>
      ) : (
        byTemplate(node.articles).map(({ template, articles }) => {
          const { Icon, plural } = templateOf(template);
          return (
            <section key={template} className="article-folder-section" aria-label={plural}>
              <h2>
                <Icon size={15} strokeWidth={2.25} aria-hidden />
                {plural} <span className="field-label">({articles.length})</span>
              </h2>
              <ul className="article-folder-list">
                {articles.map((a) => (
                  <li key={a.id}>
                    <button type="button" className="article-folder-article" onClick={() => onOpenArticle(a.template, a.id)}>
                      {a.name}
                    </button>
                    <button type="button" className="btn btn-icon btn-ghost" aria-label={`Remove ${a.name} from this folder`} data-tooltip="Remove from folder" onClick={() => void remove(a.id)}>
                      <X size={14} strokeWidth={2.25} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      {adding && <AddArticlesDialog folderName={folder.name} catalog={catalog} filed={filed} onAdd={(ids) => store.addArticles(folder.id, ids)} onClose={() => setAdding(false)} />}
      {deleting && (
        <ConfirmDialog open title="Delete this folder?" confirmLabel="Delete folder" busyLabel="Deleting…" busy={busy} error={error} onConfirm={() => void confirmDelete()} onCancel={() => setDeleting(false)}>
          <p>
            <strong>&ldquo;{folder.name}&rdquo;</strong>
            {subfolderCount > 0 ? ` and its ${subfolderCount} subfolder${subfolderCount === 1 ? "" : "s"}` : ""} will be deleted.
          </p>
          <ul>
            <li>The articles in it stay in the app, under their type and in any other folder.</li>
          </ul>
        </ConfirmDialog>
      )}
    </div>
  );
}
