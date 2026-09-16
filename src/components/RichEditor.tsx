"use client";

import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Minus,
  Link2,
  Eraser,
  Undo2,
  Redo2,
} from "lucide-react";

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
}

type SaveState = "idle" | "saving" | "saved" | "failed";

async function fetchDocument(documentId: string): Promise<DocumentRecord> {
  const res = await fetch(`/api/documents/${documentId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load document.");
  return (await res.json()).document;
}

export default function RichEditor({
  documentId,
  editable,
}: {
  documentId: string;
  editable: boolean;
}) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loaded, setLoaded] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  // `save` reads this, never React state — a retry scheduled via
  // setTimeout/recursion closes over whatever `save` function existed when
  // it was scheduled, which would otherwise keep resending a stale revision
  // on every conflict forever (see Batch 5 postmortem).
  const revisionRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);

  function adoptRevision(rev: number) {
    revisionRef.current = rev;
  }

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, protocols: ["http", "https", "mailto"] },
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder: editable ? "Write a description…" : "" }),
    ],
    onUpdate: () => {
      if (!editable) return;
      const content = editor?.getJSON();
      if (content) persistDraft(documentId, content);
      setSaveState("idle");
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(save, AUTOSAVE_IDLE_MS);
    },
  });

  // Tiptap's `editable` construction option is only read once — it doesn't
  // react to this prop changing on a later render (e.g. MarkerPanel's
  // read/edit toggle), so the live editor instance needs to be told
  // explicitly whenever it does.
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  async function save() {
    if (!editor || revisionRef.current === null || savingRef.current) return;
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

    fetchDocument(documentId).then((doc) => {
      if (cancelled || !editor) return;

      const draftRaw = localStorage.getItem(draftKey(documentId));
      let content: JSONContent = JSON.parse(doc.jsonText);

      if (draftRaw) {
        try {
          const draft = JSON.parse(draftRaw);
          content = draft.json;
        } catch {
          // corrupt draft — fall back to the server copy
        }
      }

      editor.commands.setContent(content, { emitUpdate: false });
      adoptRevision(doc.revision);
      setLoaded(true);

      // A recovered draft differs from what the server has — save it now
      // rather than waiting for the next keystroke, so a refresh right
      // after recovery doesn't lose it again.
      if (draftRaw) {
        idleTimer.current = setTimeout(save, 300);
      }
    });

    return () => {
      cancelled = true;
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `save` intentionally omitted: it's stable enough for this effect's purpose and including it would require restructuring around refs for no behavioral gain here.
  }, [documentId, editor]);

  // Flush a pending save when the user navigates away.
  useEffect(() => {
    return () => {
      if (idleTimer.current) {
        clearTimeout(idleTimer.current);
        save();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  if (!editable) {
    return <div className="rich-reader">{loaded && <EditorContent editor={editor} />}</div>;
  }

  return (
    <div className="rich-editor">
      <div className="rich-toolbar" role="toolbar" aria-label="Formatting">
        <button
          type="button"
          aria-label="Bold"
          title="Bold"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={editor?.isActive("bold") ? "active" : ""}
        >
          <Bold size={15} strokeWidth={2.25} />
        </button>
        <button
          type="button"
          aria-label="Italic"
          title="Italic"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={editor?.isActive("italic") ? "active" : ""}
        >
          <Italic size={15} strokeWidth={2.25} />
        </button>
        <button
          type="button"
          aria-label="Underline"
          title="Underline"
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          className={editor?.isActive("underline") ? "active" : ""}
        >
          <Underline size={15} strokeWidth={2.25} />
        </button>
        <button
          type="button"
          aria-label="Strikethrough"
          title="Strikethrough"
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          className={editor?.isActive("strike") ? "active" : ""}
        >
          <Strikethrough size={15} strokeWidth={2.25} />
        </button>
        <span className="rich-toolbar-divider" aria-hidden="true" />
        <select
          aria-label="Text style"
          className="rich-toolbar-select"
          value={
            editor?.isActive("heading", { level: 1 })
              ? "1"
              : editor?.isActive("heading", { level: 2 })
                ? "2"
                : editor?.isActive("heading", { level: 3 })
                  ? "3"
                  : "0"
          }
          onChange={(e) => {
            const level = Number(e.target.value);
            if (level === 0) editor?.chain().focus().setParagraph().run();
            else editor?.chain().focus().setHeading({ level: level as 1 | 2 | 3 }).run();
          }}
        >
          <option value="0">Paragraph</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
        </select>
        <button
          type="button"
          aria-label="Bulleted list"
          title="Bulleted list"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={editor?.isActive("bulletList") ? "active" : ""}
        >
          <List size={15} strokeWidth={2.25} />
        </button>
        <button
          type="button"
          aria-label="Numbered list"
          title="Numbered list"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={editor?.isActive("orderedList") ? "active" : ""}
        >
          <ListOrdered size={15} strokeWidth={2.25} />
        </button>
        <button
          type="button"
          aria-label="Quote"
          title="Quote"
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          className={editor?.isActive("blockquote") ? "active" : ""}
        >
          <Quote size={15} strokeWidth={2.25} />
        </button>
        <button
          type="button"
          aria-label="Horizontal rule"
          title="Horizontal rule"
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
        >
          <Minus size={15} strokeWidth={2.25} />
        </button>
        <button
          type="button"
          aria-label="Insert link"
          title="Insert link"
          onClick={() => {
            const url = window.prompt("Link URL");
            if (url) editor?.chain().focus().setLink({ href: url }).run();
          }}
          className={editor?.isActive("link") ? "active" : ""}
        >
          <Link2 size={15} strokeWidth={2.25} />
        </button>
        <span className="rich-toolbar-divider" aria-hidden="true" />
        <button
          type="button"
          aria-label="Clear formatting"
          title="Clear formatting"
          onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          <Eraser size={15} strokeWidth={2.25} />
        </button>
        <button type="button" aria-label="Undo" title="Undo" onClick={() => editor?.chain().focus().undo().run()}>
          <Undo2 size={15} strokeWidth={2.25} />
        </button>
        <button type="button" aria-label="Redo" title="Redo" onClick={() => editor?.chain().focus().redo().run()}>
          <Redo2 size={15} strokeWidth={2.25} />
        </button>
        <span className="rich-save-state">
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved"}
          {saveState === "failed" && "Save failed"}
        </span>
      </div>
      <EditorContent editor={editor} className="rich-content" />
    </div>
  );
}
