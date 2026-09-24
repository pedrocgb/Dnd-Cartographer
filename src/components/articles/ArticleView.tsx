"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { CirclePlus, Footprints, Info, PanelRightClose, TextAlignStart, Trash2, type LucideIcon } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import RichEditor from "@/components/RichEditor";
import type { ArticleTemplateKey } from "@/server/articles/templates";
import { templateOf } from "./templates";
import TagEditor from "./TagEditor";
import { CreateArticleContext } from "./create-context";

/** Floating editor UI (bubble menus, popovers) lives outside the card; clicks there keep it editing. */
const FLOATING_EDITOR_UI = ".rich-floating";

export interface CardDocument {
  documentId: string | null;
  /** Links a freshly created document to the article (cards create theirs on first use). */
  onCreated: (documentId: string) => Promise<unknown>;
}

export interface FooterDocument extends CardDocument {
  /** Unlinks the footer from the article. */
  onRemove: () => Promise<unknown>;
}

async function createDocument(): Promise<string> {
  const res = await fetch("/api/documents", { method: "POST" });
  if (!res.ok) throw new Error("Could not create the document.");
  return (await res.json()).document.id;
}

/** A card's small top line: icon + label on the left, hint and actions on the right. */
function CardHeader({ Icon, label, hint, children }: { Icon: LucideIcon; label: string; hint?: string; children?: React.ReactNode }) {
  return (
    <header className="article-card-header">
      <span className="article-card-label">
        <Icon size={13} strokeWidth={2.25} aria-hidden />
        <span className="field-label">{label}</span>
      </span>
      <span className="article-card-header-end">
        {hint && <span className="article-card-hint">{hint}</span>}
        {children}
      </span>
    </header>
  );
}

const CARD_KIND = {
  body: { Icon: TextAlignStart, label: "Body", placeholder: "Click to start writing this article…" },
  sidebar: { Icon: PanelRightClose, label: "Sidebar", placeholder: "Click to add sidebar notes…" },
  footer: { Icon: Footprints, label: "Footer", placeholder: "Click to write the footer…" },
} as const;

/**
 * One text card (body, sidebar or footer). Read-only until clicked; Escape
 * or a click outside returns it to reading. The editor stays mounted across
 * the switch — only `editable` changes — so an in-flight autosave can never
 * race a remount (see RichEditor).
 */
function ArticleCard({
  variant,
  doc,
  startEditing: initiallyEditing = false,
  headerActions,
  footerActions,
}: {
  variant: keyof typeof CARD_KIND;
  doc: CardDocument;
  /** Opens straight into editing (a just-added footer). */
  startEditing?: boolean;
  headerActions?: React.ReactNode;
  /** Extra buttons in the editor's own footer row while editing. */
  footerActions?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(initiallyEditing);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const { Icon, label, placeholder } = CARD_KIND[variant];

  useEffect(() => {
    if (!editing) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (ref.current?.contains(target) || target?.closest(FLOATING_EDITOR_UI)) return;
      setEditing(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [editing]);

  async function beginEditing() {
    if (editing || creating) return;
    if (!doc.documentId) {
      setCreating(true);
      try {
        await doc.onCreated(await createDocument());
      } finally {
        setCreating(false);
      }
    }
    setEditing(true);
  }

  return (
    <section
      ref={ref}
      className={`article-card article-card-${variant}${editing ? " editing" : ""}`}
      aria-label={label}
      tabIndex={editing ? -1 : 0}
      onClick={beginEditing}
      onKeyDown={(e) => {
        if (e.key === "Escape" && editing) {
          e.stopPropagation();
          setEditing(false);
          ref.current?.focus();
        } else if (e.key === "Enter" && !editing && e.target === ref.current) {
          e.preventDefault();
          void beginEditing();
        }
      }}
    >
      <CardHeader Icon={Icon} label={label} hint={editing ? "Esc to finish" : "Click to edit"}>
        {headerActions}
      </CardHeader>
      {doc.documentId ? (
        <RichEditor documentId={doc.documentId} editable={editing} placeholder={placeholder} footerActions={footerActions} />
      ) : (
        <p className="article-card-placeholder">{creating ? "Creating…" : placeholder}</p>
      )}
    </section>
  );
}

function EditableTitle({ title, onRename }: { title: string; onRename?: (title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  if (!onRename || !editing) {
    return onRename ? (
      <button
        type="button"
        className="article-title-text editable"
        title="Click to rename"
        onClick={() => {
          setDraft(title);
          setEditing(true);
        }}
      >
        {title}
      </button>
    ) : (
      <span className="article-title-text">{title}</span>
    );
  }

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== title) onRename?.(next);
  }

  return (
    <input
      className="article-title-input"
      aria-label="Article title"
      value={draft}
      autoFocus
      maxLength={200}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

/**
 * The page every article shares: template icon + title, tags, then the
 * image card beside the Info Bar (the template's structured fields), then
 * the body and sidebar cards (sidebar as tall as the left column) and the
 * optional footer. Callers key it by article so per-article state resets.
 */
export default function ArticleView({
  template,
  title,
  subtitle,
  onRename,
  tags,
  tagSuggestions,
  onChangeTags,
  actions,
  image,
  info,
  infoActions,
  body,
  sidebar,
  footer,
}: {
  template: ArticleTemplateKey;
  title: string;
  subtitle?: string;
  /** Inline title editing; records rename through their own form instead. */
  onRename?: (title: string) => void;
  tags: string[];
  tagSuggestions: string[];
  onChangeTags: (tags: string[]) => void;
  /** Header buttons (Delete). */
  actions?: React.ReactNode;
  /** The article's image uploader, shown in its own card. */
  image: React.ReactNode;
  /** Info Bar content (the template's structured fields). */
  info?: React.ReactNode;
  /** Info Bar header buttons (Edit). */
  infoActions?: React.ReactNode;
  body: CardDocument;
  sidebar: CardDocument;
  footer: FooterDocument;
}) {
  const { Icon, label } = templateOf(template);
  const createNew = useContext(CreateArticleContext);
  const [addingFooter, setAddingFooter] = useState(false);
  const [footerJustAdded, setFooterJustAdded] = useState(false);
  const [confirmingFooterRemoval, setConfirmingFooterRemoval] = useState(false);
  const [removingFooter, setRemovingFooter] = useState(false);
  const hasFooter = Boolean(footer.documentId);

  async function addFooter() {
    setAddingFooter(true);
    try {
      await footer.onCreated(await createDocument());
      setFooterJustAdded(true);
    } finally {
      setAddingFooter(false);
    }
  }

  async function removeFooter() {
    setRemovingFooter(true);
    try {
      setFooterJustAdded(false);
      await footer.onRemove();
      setConfirmingFooterRemoval(false);
    } finally {
      setRemovingFooter(false);
    }
  }

  return (
    <article className="article-view">
      <header className="article-header">
        <h1 className="article-title">
          <Icon size={24} strokeWidth={2} aria-label={label} />
          <EditableTitle key={title} title={title} onRename={onRename} />
          {subtitle && <span className="field-label article-subtitle">({subtitle})</span>}
        </h1>
        {(createNew || actions) && (
          <div className="article-actions">
            {createNew && (
              <button type="button" className="btn btn-sm btn-create" onClick={() => createNew(template)}>
                <CirclePlus size={13} strokeWidth={2.25} />
                Add new {label}
              </button>
            )}
            {actions}
          </div>
        )}
      </header>
      <TagEditor templateTag={label} tags={tags} suggestions={tagSuggestions} onChange={onChangeTags} />

      <div className="article-top">
        <section className="article-card article-image-card" aria-label="Image">
          {image}
        </section>
        <section className="article-card article-info-card" aria-label="Informations">
          <CardHeader Icon={Info} label="Informations">
            {infoActions}
          </CardHeader>
          {info ?? <p className="article-card-placeholder">No information yet.</p>}
        </section>
      </div>

      <div className={hasFooter ? "article-cards has-footer" : "article-cards"}>
        <ArticleCard
          variant="body"
          doc={body}
          footerActions={
            !hasFooter && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                disabled={addingFooter}
                title="Add a footer section below the body"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void addFooter()}
              >
                <Footprints size={14} strokeWidth={2.25} />
                {addingFooter ? "Adding…" : "Add footer"}
              </button>
            )
          }
        />
        <ArticleCard variant="sidebar" doc={sidebar} />
        {hasFooter && (
          <ArticleCard
            key={footer.documentId}
            variant="footer"
            doc={footer}
            startEditing={footerJustAdded}
            headerActions={
              <button type="button" className="btn btn-sm btn-ghost article-card-remove" onClick={(e) => {
                  e.stopPropagation(); // don't also start editing the card
                  setConfirmingFooterRemoval(true);
                }}
                title="Remove the footer"
              >
                <Trash2 size={13} strokeWidth={2.25} />
                Remove footer
              </button>
            }
          />
        )}
      </div>
      <ConfirmDialog
        open={confirmingFooterRemoval}
        title="Remove the footer?"
        confirmLabel="Remove footer"
        busyLabel="Removing…"
        busy={removingFooter}
        onConfirm={removeFooter}
        onCancel={() => setConfirmingFooterRemoval(false)}
      >
        <p>The footer and all of its text will be removed from this article.</p>
        <ul>
          <li>You can add a new, empty footer at any time.</li>
          <li>The removed text can&rsquo;t be brought back.</li>
        </ul>
      </ConfirmDialog>
    </article>
  );
}
