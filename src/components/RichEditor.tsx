"use client";

import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Table } from "lucide-react";
import { buildExtensions } from "./rich-editor/extensions";
import { TextBubbleMenu, ImageBubbleMenu } from "./rich-editor/BubbleMenus";
import MentionMenu from "./rich-editor/MentionMenu";
import { TableBubbleMenu, TableInsertPicker } from "./rich-editor/TableMenus";
import CalendarDateModal from "./rich-editor/CalendarDateModal";
import SlashMenu, { type SlashActions } from "./rich-editor/SlashMenu";
import ArticleLinkModal, { type ArticleLinkChoice } from "./rich-editor/ArticleLinkModal";
import { imageFilesOf, insertImageFiles } from "./rich-editor/images";
import { SECRET_REVEAL_META } from "./rich-editor/secret";
import ImageLightbox, { openReaderImage, type ZoomedImage } from "./rich-editor/ImageLightbox";
import { SkeletonRegion, SkeletonText } from "./Skeleton";
import { useT } from "@/i18n/useT";

const AUTOSAVE_IDLE_MS = 1500;
const INSTANCE_ID_KEY = "world-wiki-instance-id";

function getInstanceId(): string {
  let id = localStorage.getItem(INSTANCE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(INSTANCE_ID_KEY, id);
  }
  return id;
}

function draftKey(documentId: string): string {
  return `draft:${getInstanceId()}:${documentId}`;
}

function persistDraft(documentId: string, json: JSONContent): void {
  localStorage.setItem(draftKey(documentId), JSON.stringify({ json, savedAt: Date.now() }));
}

interface DocumentRecord {
  id: string;
  jsonText: string;
  revision: number;
  updatedAt: string;
}

type SaveState = "idle" | "saving" | "saved" | "failed";

/** An open article link dialog: the range the link replaces and what it starts with. */
interface ArticleLinkTarget {
  from: number;
  to: number;
  query: string;
  text: string;
}

/**
 * Last known copy of each document this tab has loaded or saved. Read mode
 * shows it at once while the fresh copy loads (so revisiting an article
 * doesn't flash empty); editing always waits for the fresh copy and its
 * revision, so a cached copy is never saved over newer content.
 */
const documentCache = new Map<string, DocumentRecord>();

async function fetchDocument(documentId: string): Promise<DocumentRecord> {
  const res = await fetch(`/api/documents/${documentId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load document.");
  const doc: DocumentRecord = (await res.json()).document;
  documentCache.set(documentId, doc);
  return doc;
}

/** A read-only document still arriving: lines of skeleton instead of a blank that pops in. */
function DocumentSkeleton() {
  const t = useT("editor");
  return (
    <SkeletonRegion label={t("loadingText")} className="rich-skeleton">
      <SkeletonText lines={3} />
    </SkeletonRegion>
  );
}

/**
 * The app's rich-text editor (TipTap). Formatting lives in bubble menus
 * shown over a text or image selection; images come in by drag-and-drop,
 * paste, or the "Insert image" button (at the caret). Read mode renders the
 * same editor non-editable, where links and linked images open on click.
 */
export default function RichEditor({
  documentId,
  editable,
  placeholder,
  footerActions,
  mentionCampaignId = null,
}: {
  documentId: string;
  editable: boolean;
  /** Shown in read mode when the document is empty (nothing is rendered otherwise). */
  placeholder?: string;
  /** Extra buttons after "Insert image" while editing (e.g. an article body's "Add footer"). */
  footerActions?: React.ReactNode;
  /** The @ menu also offers this campaign's quests, fronts and outline items (articles are always offered). */
  mentionCampaignId?: string | null;
}) {
  const t = useT("editor");
  const tc = useT("common");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [articleLink, setArticleLink] = useState<ArticleLinkTarget | null>(null);
  // The table size picker, where it opens (screen coordinates); the table goes at the caret.
  // The calendar date dialog: the range the date replaces.
  const [dateLink, setDateLink] = useState<{ from: number; to: number } | null>(null);
  const [tablePicker, setTablePicker] = useState<{ left: number; top: number } | null>(null);
  // Something to show in read mode: the confirmed copy, or the cached one while it loads.
  const [shown, setShown] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  // `save` reads this, never React state — a retry scheduled via
  // setTimeout/recursion closes over whatever `save` function existed when
  // it was scheduled, which would otherwise keep resending a stale revision
  // on every conflict forever (see Batch 5 postmortem).
  const revisionRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  // `useEditor`'s `onUpdate` is frozen at editor-creation time (see the
  // `[documentId]` deps comment below) — it can only safely read values
  // that don't change again until the NEXT documentId switch. `loaded`
  // flips true shortly after creation (once the real document has fetched),
  // so a direct read of the `loaded` state inside onUpdate would forever
  // see its creation-time value (false) and silently block all future
  // autosaves for that document. A ref sidesteps that: `.current` is always
  // live regardless of which closure captured the ref itself.
  const loadedRef = useRef(false);

  function adoptRevision(rev: number) {
    revisionRef.current = rev;
  }

  function markLoaded(value: boolean) {
    loadedRef.current = value;
    setLoaded(value);
    setShown(value);
  }

  const [zoomed, setZoomed] = useState<ZoomedImage | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    // Tiptap v3 defaults this to false ("will be removed in future
    // versions") — without it, clicking a toolbar button (bold, italic,
    // heading, ...) applies the change to the document immediately but the
    // toolbar's own active-state highlighting only catches up on the next
    // unrelated re-render (e.g. typing), since nothing here re-renders on
    // a plain transaction otherwise.
    shouldRerenderOnTransaction: true,
    editable,
    extensions: buildExtensions(t("placeholder")),
    editorProps: {
      // Ctrl/Cmd+K: link an article in place of the selection (or at the caret).
      handleKeyDown: (view, event) => {
        if (!view.editable || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== "k") return false;
        event.preventDefault();
        const { from, to } = view.state.selection;
        const text = view.state.doc.textBetween(from, to, " ");
        setArticleLink({ from, to, query: text, text });
        return true;
      },
      // Image files dropped or pasted into the text upload and land where they were dropped / at the caret.
      handleDrop: (view, event, _slice, moved) => {
        const files = imageFilesOf(event.dataTransfer);
        if (moved || !view.editable || files.length === 0) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from;
        void insertImageFiles(view, files, pos).then(setUploadError);
        return true;
      },
      handlePaste: (view, event) => {
        const files = imageFilesOf(event.clipboardData);
        if (!view.editable || files.length === 0) return false;
        void insertImageFiles(view, files, view.state.selection.from).then(setUploadError);
        return true;
      },
      // Reading: links and linked images open in a new tab, other images full size (editing keeps clicks for the caret).
      handleClickOn: (view, _pos, node) => !view.editable && openReaderImage(node, setZoomed),
      handleClick: (view, _pos, event) => {
        const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
        // @mentions and calendar dates are app pages: reading follows them here; editing needs Ctrl/Cmd+click (new tab).
        if (anchor?.hasAttribute("data-mention") || anchor?.hasAttribute("data-calendar-date")) {
          if (view.editable && !(event.ctrlKey || event.metaKey)) return false;
          event.preventDefault();
          if (view.editable) window.open(anchor.getAttribute("href")!, "_blank", "noopener,noreferrer");
          else window.location.assign(anchor.getAttribute("href")!);
          return true;
        }
        if (view.editable || !anchor) return false;
        window.open(anchor.getAttribute("href")!, "_blank", "noopener,noreferrer");
        return true;
      },
    },
    onUpdate: ({ transaction }) => {
      // Read mode saves one kind of change: a secret's padlock, revealed at the table.
      const reveal = transaction.getMeta(SECRET_REVEAL_META) === true;
      if ((!editable && !reveal) || !loadedRef.current) return;
      const content = editor?.getJSON();
      if (content) persistDraft(documentId, content);
      setSaveState("idle");
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = reveal ? setTimeout(() => save(true), 0) : setTimeout(save, AUTOSAVE_IDLE_MS);
    },
    // `useEditor` without a deps array only ever evaluates `options` once —
    // `onUpdate` above would otherwise freeze its closure over the very
    // first `documentId`/`save` it was constructed with. Since RichEditor
    // itself stays permanently mounted across different entities (edit/view
    // toggling relies on that — see the DescriptionSection usage sites), a
    // frozen onUpdate silently kept autosaving every subsequent entity's
    // edits into the FIRST entity's document. Recreating the editor
    // whenever `documentId` actually changes gives onUpdate/save a fresh
    // closure per document, while same-document edit/view toggles (which
    // don't change documentId) keep reusing the same editor instance.
  }, [documentId]);

  // Tiptap's `editable` construction option is only read once — it doesn't
  // react to this prop changing on a later render (e.g. MarkerPanel's
  // read/edit toggle), so the live editor instance needs to be told
  // explicitly whenever it does.
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  async function save(force = false) {
    if ((!editable && !force) || !editor || !loadedRef.current || revisionRef.current === null || savingRef.current) return;
    savingRef.current = true;
    setSaveState("saving");
    const json = editor.getJSON();

    const res = await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json, revision: revisionRef.current }),
    });

    if (res.ok) {
      const { document } = await res.json();
      adoptRevision(document.revision);
      documentCache.set(documentId, { id: documentId, jsonText: JSON.stringify(json), revision: document.revision, updatedAt: document.updatedAt ?? new Date().toISOString() });
      retryCountRef.current = 0;
      localStorage.removeItem(draftKey(documentId));
      setSaveState("saved");
      savingRef.current = false;
    } else if (res.status === 409 && retryCountRef.current < 5) {
      // Someone/something else saved a newer revision. The user's current
      // edits (still live in the editor) are the freshest intent — keep
      // them on screen, adopt the new revision number, and retry
      // immediately with it (not via a stale closure over the old value).
      const { current } = await res.json();
      adoptRevision(current.revision);
      retryCountRef.current += 1;
      savingRef.current = false;
      save(force);
    } else {
      setSaveState("failed");
      savingRef.current = false;
    }
  }

  useEffect(() => {
    let cancelled = false;
    // This document hasn't been confirmed-loaded yet — block onUpdate/save
    // (both gated on loadedRef) until the real content below actually
    // lands, so a freshly-created (default-empty) editor for a just-switched
    // entity can never get autosaved over the entity's real description.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: this synchronously invalidates stale loaded/revision state the instant documentId changes, closing the exact race window (premature autosave of a not-yet-loaded document) this effect exists to prevent; deferring it to a callback would reopen that window.
    markLoaded(false);
    revisionRef.current = null;

    // Read mode: show the last known copy right away (display only; nothing saves until the fresh copy lands).
    const cached = documentCache.get(documentId);
    if (cached && editor && !editor.isDestroyed && !editable) {
      editor.commands.setContent(JSON.parse(cached.jsonText), { emitUpdate: false });
      setShown(true);
    }

    fetchDocument(documentId).then((doc) => {
      if (cancelled || !editor || editor.isDestroyed) return;

      const draftRaw = localStorage.getItem(draftKey(documentId));
      let content: JSONContent = JSON.parse(doc.jsonText);
      let recoveredNewerDraft = false;

      if (draftRaw) {
        try {
          const draft = JSON.parse(draftRaw);
          // Only trust a local draft if it's actually newer than the
          // server's last save. A stale draft (e.g. one written under this
          // documentId by a past bug, or simply left over from an editing
          // session that never got flushed) would otherwise resurrect wrong
          // content forever, since every load would keep preferring it over
          // the real, current server copy. Purge anything that fails this
          // check so it can't be reconsidered on a future load either.
          if (typeof draft.savedAt === "number" && draft.savedAt > new Date(doc.updatedAt).getTime()) {
            content = draft.json;
            recoveredNewerDraft = true;
          } else {
            localStorage.removeItem(draftKey(documentId));
          }
        } catch {
          // corrupt draft — fall back to the server copy
          localStorage.removeItem(draftKey(documentId));
        }
      }

      // Unchanged since the cached copy on screen: skip the re-render.
      const alreadyShown = cached && !editable && !recoveredNewerDraft && cached.jsonText === doc.jsonText && cached.revision === doc.revision;
      if (!alreadyShown) editor.commands.setContent(content, { emitUpdate: false });
      adoptRevision(doc.revision);
      markLoaded(true);

      // A recovered draft differs from what the server has — save it now
      // rather than waiting for the next keystroke, so a refresh right
      // after recovery doesn't lose it again.
      if (recoveredNewerDraft) {
        idleTimer.current = setTimeout(save, 300);
      }
    });

    return () => {
      cancelled = true;
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `save` intentionally omitted: it's stable enough for this effect's purpose and including it would require restructuring around refs for no behavioral gain here.
  }, [documentId, editor]);

  if (!editable) {
    // Nothing to show yet (still loading) or nothing written — render the
    // placeholder if the caller wants one, else nothing, so an unset
    // description doesn't leave an empty box.
    if (!shown) return <DocumentSkeleton />;
    if (editor?.isEmpty) return placeholder ? <p className="article-card-placeholder">{placeholder}</p> : null;
    return (
      <div className="rich-reader">
        <EditorContent editor={editor} />
        <ImageLightbox image={zoomed} onClose={() => setZoomed(null)} />
      </div>
    );
  }

  if (!loaded || !editor) {
    // A fresh editor for a just-switched entity starts out default-empty
    // until its real content arrives — show a placeholder instead of the
    // (momentarily blank-looking) live editor, so it never reads as "the
    // description got erased" while the fetch is still in flight.
    return (
      <div className="rich-editor-loading">
        <DocumentSkeleton />
      </div>
    );
  }

  function openArticleLinkForSelection() {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, " ");
    setArticleLink({ from, to, query: text, text });
  }

  /** Puts the chosen article's mention where the dialog was opened from. */
  function insertArticleLink(choice: ArticleLinkChoice) {
    if (!editor || !articleLink) return;
    const size = editor.state.doc.content.size;
    const from = Math.min(articleLink.from, size);
    const to = Math.min(articleLink.to, size);
    // A space after the link, unless one already follows.
    const spaced = /^\s/.test(editor.state.doc.textBetween(to, Math.min(to + 1, size), "", "\ufffc"));
    editor
      .chain()
      .focus()
      .insertContentAt({ from, to }, [
        { type: "mention", attrs: { kind: choice.template, id: choice.id, label: choice.name, campaign: null, text: choice.text } },
        ...(spaced ? [] : [{ type: "text", text: " " }]),
      ])
      .run();
    setArticleLink(null);
  }

  function openTablePickerAt(pos: number) {
    if (!editor) return;
    const coords = editor.view.coordsAtPos(Math.min(pos, editor.state.doc.content.size));
    setTablePicker({ left: coords.left, top: coords.bottom + 4 });
  }

  function insertTable(rows: number, cols: number, withHeaderRow: boolean) {
    setTablePicker(null);
    editor?.chain().focus().insertTable({ rows, cols, withHeaderRow }).run();
  }

  const slashActions: SlashActions = {
    linkArticle: (at) => setArticleLink({ from: at, to: at, query: "", text: "" }),
    insertImage: () => fileInputRef.current?.click(),
    insertTable: openTablePickerAt,
    linkCalendarDate: (at) => setDateLink({ from: at, to: at }),
  };

  function insertCalendarDate(day: number, label: string) {
    if (!editor || !dateLink) return;
    const size = editor.state.doc.content.size;
    editor
      .chain()
      .focus()
      .setTextSelection({ from: Math.min(dateLink.from, size), to: Math.min(dateLink.to, size) })
      .insertCalendarDate({ day, label })
      .run();
    setDateLink(null);
  }

  return (
    <div className="rich-editor">
      <EditorContent editor={editor} className="rich-content" />
      <TextBubbleMenu editor={editor} onLinkArticle={openArticleLinkForSelection} onLinkDate={() => setDateLink({ from: editor.state.selection.from, to: editor.state.selection.to })} />
      <ImageBubbleMenu editor={editor} />
      <TableBubbleMenu editor={editor} />
      {dateLink && (
        <CalendarDateModal
          onPick={insertCalendarDate}
          onClose={() => {
            setDateLink(null);
            editor.commands.focus();
          }}
        />
      )}
      {tablePicker && (
        <TableInsertPicker
          anchor={tablePicker}
          onInsert={insertTable}
          onClose={() => {
            setTablePicker(null);
            editor.commands.focus();
          }}
        />
      )}
      <MentionMenu editor={editor} campaignId={mentionCampaignId} onLinkArticle={(m) => setArticleLink({ from: m.from, to: m.to, query: m.query, text: "" })} />
      <SlashMenu editor={editor} actions={slashActions} />
      {articleLink && (
        <ArticleLinkModal
          initialQuery={articleLink.query}
          initialText={articleLink.text}
          onPick={insertArticleLink}
          onClose={() => {
            setArticleLink(null);
            editor.commands.focus();
          }}
        />
      )}
      <div className="rich-editor-footer">
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          data-tooltip={t("insertImageHint")}
          // Keep the caret where it is: the image goes there.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus size={14} strokeWidth={2.25} />
          {t("insertImage")}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          data-tooltip={t("insertTableHint")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            setTablePicker({ left: box.left, top: box.bottom + 4 });
          }}
        >
          <Table size={14} strokeWidth={2.25} />
          {t("insertTable")}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) void insertImageFiles(editor.view, files, editor.state.selection.from).then(setUploadError);
          }}
        />
        {footerActions}
        {uploadError && (
          <span className="form-error" role="alert">
            {uploadError}
          </span>
        )}
        <span className="rich-save-state">
          {saveState === "saving" && tc("saving")}
          {saveState === "saved" && t("saved")}
          {saveState === "failed" && t("saveFailed")}
        </span>
      </div>
    </div>
  );
}
