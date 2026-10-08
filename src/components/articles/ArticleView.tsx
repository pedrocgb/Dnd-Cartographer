"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CirclePlus, Footprints, Info, Lock, PanelRightClose, Pencil, Share2, TextAlignStart, Trash2, type LucideIcon } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import RichEditor from "@/components/RichEditor";
import CalendarBacklinks from "@/components/calendars/CalendarBacklinks";
import SessionBacklinks from "@/components/sessions/SessionBacklinks";
import QuestBacklinks from "@/components/quests/QuestBacklinks";
import MentionBacklinks from "@/components/MentionBacklinks";
import ArticleMapPresence from "./ArticleMapPresence";
import type { ArticleTemplateKey } from "@/server/articles/templates";
import { templateOf } from "./templates";
import TagEditor from "./TagEditor";
import ArticleFoldersControl from "./ArticleFoldersControl";
import { CreateArticleContext } from "./create-context";
import RelationshipsCard from "@/components/relations/RelationshipsCard";
import ShareDialog from "@/components/share/ShareDialog";
import { useT } from "@/i18n/useT";
import { activeT } from "@/i18n/active";

/** Floating editor UI (bubble menus, popovers) lives outside the card; clicks there keep it editing. */
// Editor UI outside the card: menus, dialogs, and the date picker popover they can open (.dp-pop).
const FLOATING_EDITOR_UI = ".rich-floating, .dp-pop";

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
  if (!res.ok) throw new Error(activeT("articles")("view.createDocFailed"));
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

/** Each card's words are `articles` `card.<variant>.label|placeholder|empty`. */
const CARD_KIND = {
  body: { Icon: TextAlignStart },
  sidebar: { Icon: PanelRightClose },
  footer: { Icon: Footprints },
} as const;

/**
 * One text card (body, sidebar or footer). Read-only (its links open on
 * click) until its edit button is pressed; Escape or a click outside
 * returns it to reading. The editor stays mounted across
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
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const ta = useT("articles");
  const tc = useT("common");
  const { Icon } = CARD_KIND[variant];
  const label = ta(`card.${variant}.label`);
  const placeholder = ta(`card.${variant}.placeholder`);
  const empty = ta(`card.${variant}.empty`);

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

  // The edit button starts editing: the caret goes into the text once the editor is editable (a new document loads first).
  const focusOnEditRef = useRef(false);
  useEffect(() => {
    if (!editing || !focusOnEditRef.current) return;
    const field = ref.current?.querySelector<HTMLElement>('[contenteditable="true"]');
    if (!field) return;
    field.focus();
    focusOnEditRef.current = false;
  });

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
    focusOnEditRef.current = true;
    setEditing(true);
  }

  return (
    <section
      ref={ref}
      className={`article-card article-card-${variant}${editing ? " editing" : ""}`}
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === "Escape" && editing) {
          e.stopPropagation();
          setEditing(false);
          // Back to the edit button, which is shown again once reading.
          requestAnimationFrame(() => editButtonRef.current?.focus());
        }
      }}
    >
      <CardHeader Icon={Icon} label={label} hint={editing ? ta("view.escToFinish") : undefined}>
        {headerActions}
        {!editing && (
          <button
            ref={editButtonRef}
            type="button"
            className="btn btn-ghost btn-icon btn-sm article-card-edit"
            onClick={() => void beginEditing()}
            disabled={creating}
            aria-label={ta("view.editCard", { card: label.toLowerCase() })}
            data-tooltip={ta("view.editCard", { card: label.toLowerCase() })}
          >
            <Pencil size={14} strokeWidth={2.25} />
          </button>
        )}
      </CardHeader>
      {doc.documentId ? (
        <RichEditor documentId={doc.documentId} editable={editing} placeholder={editing ? placeholder : empty} footerActions={footerActions} />
      ) : (
        <p className="article-card-placeholder">{creating ? tc("creating") : empty}</p>
      )}
    </section>
  );
}

function EditableTitle({ title, onRename }: { title: string; onRename?: (title: string) => void }) {
  const ta = useT("articles");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  if (!onRename || !editing) {
    return onRename ? (
      <button
        type="button"
        className="article-title-text editable"
        data-tooltip={ta("view.rename")}
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
      aria-label={ta("view.titleLabel")}
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
  nameSecret = false,
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
  /** The name is secret (left out of share links): a padlock beside it says so. */
  nameSecret?: boolean;
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
  const ta = useT("articles");
  const { Icon, label } = templateOf(template);
  const createNew = useContext(CreateArticleContext);
  const [addingFooter, setAddingFooter] = useState(false);
  const [footerJustAdded, setFooterJustAdded] = useState(false);
  const [confirmingFooterRemoval, setConfirmingFooterRemoval] = useState(false);
  const [removingFooter, setRemovingFooter] = useState(false);
  const [sharing, setSharing] = useState(false);
  const hasFooter = Boolean(footer.documentId);
  // The open article's id is in the URL (?type=&id=): its calendar backlinks follow it.
  const articleId = useSearchParams().get("id");

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
          {nameSecret && (
            <span className="article-title-secret" data-tooltip={ta("info.nameSecret")}>
              <Lock size={16} strokeWidth={2.25} aria-label={ta("info.nameSecret")} />
            </span>
          )}
          {subtitle && <span className="field-label article-subtitle">({subtitle})</span>}
        </h1>
        {(createNew || actions || articleId) && (
          <div className="article-actions">
            {articleId && (
              <button type="button" className="btn btn-sm btn-share" data-tooltip={ta("view.shareHint")} onClick={() => setSharing(true)}>
                <Share2 size={13} strokeWidth={2.25} />
                {ta("view.share")}
              </button>
            )}
            {createNew && (
              <button type="button" className="btn btn-sm btn-create" onClick={() => createNew(template)}>
                <CirclePlus size={13} strokeWidth={2.25} />
                {ta("view.addNew", { label })}
              </button>
            )}
            {actions}
          </div>
        )}
      </header>
      <TagEditor templateTag={label} tags={tags} suggestions={tagSuggestions} onChange={onChangeTags} />
      {articleId && <ArticleFoldersControl articleId={articleId} />}

      <div className="article-top">
        <section className="article-card article-image-card" aria-label={ta("view.image")}>
          {image}
        </section>
        <section className="article-card article-info-card" aria-label={ta("view.info")}>
          <CardHeader Icon={Info} label={ta("view.info")}>
            {infoActions}
          </CardHeader>
          {info ?? <p className="article-card-placeholder">{ta("view.noInfo")}</p>}
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
                data-tooltip={ta("view.addFooterHint")}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void addFooter()}
              >
                <Footprints size={14} strokeWidth={2.25} />
                {addingFooter ? ta("folderView.adding") : ta("view.addFooter")}
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
              <button type="button" className="btn btn-sm btn-ghost article-card-remove" onClick={() => setConfirmingFooterRemoval(true)}
                data-tooltip={ta("view.removeFooterHint")}
              >
                <Trash2 size={13} strokeWidth={2.25} />
                {ta("view.removeFooter")}
              </button>
            }
          />
        )}
      </div>
      {articleId && <RelationshipsCard key={`relations:${articleId}`} recordId={articleId} template={template} />}
      {articleId && <ArticleMapPresence key={`map:${articleId}`} template={template} articleId={articleId} title={title} />}
      {articleId && <CalendarBacklinks key={articleId} articleId={articleId} />}
      {articleId && <SessionBacklinks key={`sessions:${articleId}`} articleId={articleId} />}
      {articleId && <QuestBacklinks key={`quests:${articleId}`} articleId={articleId} />}
      {articleId && <MentionBacklinks key={`mentions:${articleId}`} targetId={articleId} />}
      {sharing && articleId && <ShareDialog scopes={[{ label: title, target: { kind: "article", template, id: articleId } }]} onClose={() => setSharing(false)} />}
      <ConfirmDialog
        open={confirmingFooterRemoval}
        title={ta("view.removeFooterTitle")}
        confirmLabel={ta("view.removeFooter")}
        busyLabel={ta("view.removing")}
        busy={removingFooter}
        onConfirm={removeFooter}
        onCancel={() => setConfirmingFooterRemoval(false)}
      >
        <p>{ta("view.removeFooterBody")}</p>
        <ul>
          <li>{ta("view.removeFooterAgain")}</li>
          <li>{ta("view.removeFooterLost")}</li>
        </ul>
      </ConfirmDialog>
    </article>
  );
}
