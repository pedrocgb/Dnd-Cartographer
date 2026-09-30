"use client";

import { useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, useEditorState, type NodeViewProps } from "@tiptap/react";
import { ChevronDown, ChevronRight, ListOrdered } from "lucide-react";
import { HEADING_LEVELS } from "@/server/documents/rich-attrs";
import { buildTocTree, collectHeadings, type TocEntry, type TocHeading } from "./toc";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tableOfContents: {
      /** Inserts a table of contents at the caret. */
      insertTableOfContents: () => ReturnType;
    };
  }
}

const FLASH_MS = 1200;

/** Brings the heading at `pos` into view and briefly highlights it; while editing, the caret goes to its end. */
function jumpTo(editor: NodeViewProps["editor"], pos: number) {
  const dom = editor.view.nodeDOM(pos);
  if (!(dom instanceof HTMLElement)) return;
  dom.scrollIntoView({ behavior: "smooth", block: "start" });
  dom.classList.add("rich-heading-flash");
  setTimeout(() => dom.classList.remove("rich-heading-flash"), FLASH_MS);
  const heading = editor.state.doc.nodeAt(pos);
  if (editor.isEditable && heading) editor.commands.setTextSelection(pos + heading.nodeSize - 1);
}

function Entries({ entries, numbered, onJump }: { entries: TocEntry[]; numbered: boolean; onJump: (pos: number) => void }) {
  return (
    <ol className="rich-toc-list">
      {entries.map((e) => (
        <li key={e.pos}>
          <button type="button" className={`rich-toc-link rich-toc-level-${e.level}`} onMouseDown={(ev) => ev.preventDefault()} onClick={() => onJump(e.pos)}>
            {numbered && <span className="rich-toc-number">{e.number}</span>}
            <span className={e.text ? undefined : "rich-toc-untitled"}>{e.text || "Untitled heading"}</span>
          </button>
          {e.children.length > 0 && <Entries entries={e.children} numbered={numbered} onJump={onJump} />}
        </li>
      ))}
    </ol>
  );
}

function TableOfContentsView({ editor, node, updateAttributes, selected }: NodeViewProps) {
  const maxLevel = Number(node.attrs.maxLevel) || 3;
  const numbered = Boolean(node.attrs.numbered);
  // Readers hide/show it for themselves; while editing, the choice is saved as the default.
  const [readerCollapsed, setReaderCollapsed] = useState<boolean | null>(null);
  const collapsed = editor.isEditable ? Boolean(node.attrs.collapsed) : (readerCollapsed ?? Boolean(node.attrs.collapsed));
  // Re-read the headings on every change (compared as text, so only real changes re-render).
  const headingsJson = useEditorState({ editor, selector: ({ editor: e }) => JSON.stringify(collectHeadings(e.state.doc, maxLevel)) });
  const headings: TocHeading[] = JSON.parse(headingsJson ?? "[]");
  const tree = buildTocTree(headings);
  const toggle = () => (editor.isEditable ? updateAttributes({ collapsed: !collapsed }) : setReaderCollapsed(!collapsed));

  return (
    <NodeViewWrapper as="nav" className={selected ? "rich-toc selected" : "rich-toc"} aria-label="Table of contents">
      <div className="rich-toc-header" contentEditable={false}>
        <button
          type="button"
          className="rich-toc-toggle"
          aria-expanded={!collapsed}
          data-tooltip={collapsed ? "Show the contents" : "Hide the contents"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggle}
        >
          {collapsed ? <ChevronRight size={14} strokeWidth={2.5} /> : <ChevronDown size={14} strokeWidth={2.5} />}
          <span className="rich-toc-title">Contents</span>
          {collapsed && tree.length > 0 && <span className="rich-toc-count">{headings.length}</span>}
        </button>
        {editor.isEditable && (
          <span className="rich-toc-options">
            <select aria-label="Headings included" value={maxLevel} onChange={(e) => updateAttributes({ maxLevel: Number(e.target.value) })}>
              {HEADING_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l === 1 ? "H1 only" : `H1 to H${l}`}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={numbered ? "rich-toc-option active" : "rich-toc-option"}
              aria-pressed={numbered}
              aria-label="Number the entries"
              data-tooltip="Number the entries (1, 1.1, …)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => updateAttributes({ numbered: !numbered })}
            >
              <ListOrdered size={14} strokeWidth={2.25} />
            </button>
          </span>
        )}
      </div>
      {!collapsed && (
        <div contentEditable={false}>
          {tree.length ? (
            <Entries entries={tree} numbered={numbered} onJump={(pos) => jumpTo(editor, pos)} />
          ) : (
            <p className="rich-toc-empty">{editor.isEditable ? "Add headings (Heading 1 to 5) and they will be listed here." : "No headings yet."}</p>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}

/**
 * A table of contents block: placed by hand (the "/" menu), filled in
 * automatically from the document's headings, nested by level (an H2 under
 * the H1 before it, and so on) and kept in sync as they change. Clicking an
 * entry scrolls to its heading. It can be collapsed (saved as the default;
 * readers can toggle it for themselves), limited to H1 to Hn, and numbered.
 */
export const TableOfContents = Node.create({
  name: "tableOfContents",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      maxLevel: {
        default: 3,
        parseHTML: (el) => Number(el.getAttribute("data-max-level")) || 3,
        renderHTML: (attrs) => ({ "data-max-level": String(attrs.maxLevel) }),
      },
      collapsed: {
        default: false,
        parseHTML: (el) => el.hasAttribute("data-collapsed"),
        renderHTML: (attrs) => (attrs.collapsed ? { "data-collapsed": "" } : {}),
      },
      numbered: {
        default: false,
        parseHTML: (el) => el.hasAttribute("data-numbered"),
        renderHTML: (attrs) => (attrs.numbered ? { "data-numbered": "" } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: "nav[data-type='table-of-contents']" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["nav", mergeAttributes(HTMLAttributes, { "data-type": "table-of-contents" })];
  },
  addCommands() {
    return {
      insertTableOfContents:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(TableOfContentsView);
  },
});
