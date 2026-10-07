"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import { buildExtensions } from "./extensions";
import ImageLightbox, { openReaderImage, type ZoomedImage } from "./ImageLightbox";

/**
 * A document given as JSON, read only (a shared page has no world, so it
 * can't load documents by id like RichEditor). Links to other shared pages
 * and to sections of this one open here; anything else in a new tab.
 * Unlinked images open full size.
 * New content (a live update) replaces the old in place.
 */
export default function ReadOnlyRich({ content }: { content: JSONContent }) {
  const [zoomed, setZoomed] = useState<ZoomedImage | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    content,
    extensions: buildExtensions(""),
    editorProps: {
      handleClickOn: (_view, _pos, node) => openReaderImage(node, setZoomed),
      handleClick: (_view, _pos, event) => {
        const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
        const href = anchor?.getAttribute("href");
        if (!href) return false;
        event.preventDefault();
        if (href.startsWith("#")) document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
        else if (href.startsWith("/share/")) window.location.assign(href);
        else window.open(href, "_blank", "noopener,noreferrer");
        return true;
      },
    },
  });

  // What the editor shows, serialized: an update only re-renders a document that actually changed.
  const shownRef = useRef(JSON.stringify(content));
  useEffect(() => {
    const next = JSON.stringify(content);
    if (!editor || editor.isDestroyed || next === shownRef.current) return;
    shownRef.current = next;
    editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, content]);

  return (
    <div className="rich-reader">
      <EditorContent editor={editor} />
      <ImageLightbox image={zoomed} onClose={() => setZoomed(null)} />
    </div>
  );
}
