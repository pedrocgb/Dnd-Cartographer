"use client";

import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { buildExtensions } from "./rich-editor/extensions";
import { TextBubbleMenu, ImageBubbleMenu } from "./rich-editor/BubbleMenus";
import { imageFilesOf, insertImageFiles } from "./rich-editor/images";

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

async function fetchDocument(documentId: string): Promise<DocumentRecord> {
  const res = await fetch(`/api/documents/${documentId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load document.");
  return (await res.json()).document;
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
}: {
  documentId: string;
  editable: boolean;
  /** Shown in read mode when the document is empty (nothing is rendered otherwise). */
  placeholder?: string;
  /** Extra buttons after "Insert image" while editing (e.g. an article body's "Add footer"). */
  footerActions?: React.ReactNode;
}) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState(false);
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
  }

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
    extensions: buildExtensions("Write here… select text to format it, drop an image to add it."),
    editorProps: {
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
      // Reading: links and linked images open in a new tab (editing keeps clicks for the caret).
      handleClickOn: (view, _pos, node) => {
        if (view.editable || node.type.name !== "image" || !node.attrs.href) return false;
        window.open(node.attrs.href, "_blank", "noopener,noreferrer");
        return true;
      },
      handleClick: (view, _pos, event) => {
        const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
        if (view.editable || !anchor) return false;
        window.open(anchor.getAttribute("href")!, "_blank", "noopener,noreferrer");
        return true;
      },
    },
    onUpdate: () => {
      if (!editable || !loadedRef.current) return;
      const content = editor?.getJSON();
      if (content) persistDraft(documentId, content);
      setSaveState("idle");
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(save, AUTOSAVE_IDLE_MS);
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

  async function save() {
    if (!editable || !editor || !loadedRef.current || revisionRef.current === null || savingRef.current) return;
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
      save();
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

    fetchDocument(documentId).then((doc) => {
      if (cancelled || !editor) return;

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

      editor.commands.setContent(content, { emitUpdate: false });
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
    if (!loaded) return null;
    if (editor?.isEmpty) return placeholder ? <p className="article-card-placeholder">{placeholder}</p> : null;
    return (
      <div className="rich-reader">
        <EditorContent editor={editor} />
      </div>
    );
  }

  if (!loaded || !editor) {
    // A fresh editor for a just-switched entity starts out default-empty
    // until its real content arrives — show a placeholder instead of the
    // (momentarily blank-looking) live editor, so it never reads as "the
    // description got erased" while the fetch is still in flight.
    return <div className="rich-editor-loading field-label">Loading…</div>;
  }

  return (
    <div className="rich-editor">
      <EditorContent editor={editor} className="rich-content" />
      <TextBubbleMenu editor={editor} />
      <ImageBubbleMenu editor={editor} />
      <div className="rich-editor-footer">
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          title="Insert an image at the caret (or drop one into the text)"
          // Keep the caret where it is: the image goes there.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus size={14} strokeWidth={2.25} />
          Insert image
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
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved"}
          {saveState === "failed" && "Save failed"}
        </span>
      </div>
    </div>
  );
}
