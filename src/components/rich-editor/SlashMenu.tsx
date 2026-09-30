"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import {
  AtSign,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  ImagePlus,
  List,
  ListOrdered,
  ListTree,
  Minus,
  Pilcrow,
  TextQuote,
  Type,
  type LucideIcon,
} from "lucide-react";
import { addMenuKeyHandler, triggerMatch, type TriggerMatch } from "./menu-keys";
import { DEFAULT_SWATCH, TEXT_COLORS } from "./colors";

const MAX_QUERY = 24;
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = IS_MAC ? "⌘" : "Ctrl";
const ALT = IS_MAC ? "⌥" : "Alt";

export interface SlashActions {
  /** Opens the article link dialog, the link going where the "/" was. */
  linkArticle: (at: number) => void;
  /** Opens the image file picker (the image lands at the caret). */
  insertImage: () => void;
}

interface SlashItem {
  key: string;
  label: string;
  group: "Blocks" | "Insert" | "Text color";
  /** Other words it's found by ("h1", "ul", "#", …). */
  keywords: string[];
  Icon?: LucideIcon;
  /** Color swatch instead of an icon. */
  swatch?: string;
  shortcut?: string;
  /** Runs once the "/query" text is gone; `at` is where it was. */
  run: (editor: Editor, actions: SlashActions, at: number) => void;
}

const HEADING_ICONS = [Heading1, Heading2, Heading3, Heading4, Heading5];

const ITEMS: SlashItem[] = [
  { key: "text", label: "Text", group: "Blocks", keywords: ["paragraph", "plain", "p"], Icon: Pilcrow, shortcut: `${MOD}+${ALT}+0`, run: (e) => e.chain().focus().clearNodes().setParagraph().run() },
  { key: "title", label: "Title", group: "Blocks", keywords: ["big"], Icon: Type, shortcut: `${MOD}+${ALT}+T`, run: (e) => e.chain().focus().clearNodes().setTitle().run() },
  ...([1, 2, 3, 4, 5] as const).map(
    (level): SlashItem => ({
      key: `h${level}`,
      label: `Heading ${level}`,
      group: "Blocks",
      keywords: [`h${level}`, "#".repeat(level), "heading", "header"],
      Icon: HEADING_ICONS[level - 1],
      shortcut: `${MOD}+${ALT}+${level}`,
      run: (e) => e.chain().focus().clearNodes().setHeading({ level }).run(),
    })
  ),
  { key: "bullet", label: "Bullet list", group: "Blocks", keywords: ["ul", "unordered", "-", "*"], Icon: List, shortcut: "- space", run: (e) => e.chain().focus().toggleBulletList().run() },
  { key: "ordered", label: "Numbered list", group: "Blocks", keywords: ["ol", "ordered", "1."], Icon: ListOrdered, shortcut: "1. space", run: (e) => e.chain().focus().toggleOrderedList().run() },
  { key: "quote", label: "Quote", group: "Blocks", keywords: ["blockquote", ">", "citation"], Icon: TextQuote, shortcut: "> space", run: (e) => e.chain().focus().clearNodes().setBlockquote().run() },
  { key: "divider", label: "Divider", group: "Blocks", keywords: ["hr", "rule", "line", "separator", "---"], Icon: Minus, shortcut: "---", run: (e) => e.chain().focus().setHorizontalRule().run() },
  { key: "article", label: "Article link", group: "Insert", keywords: ["link", "mention", "@", "reference"], Icon: AtSign, shortcut: `${MOD}+K`, run: (_e, a, at) => a.linkArticle(at) },
  { key: "toc", label: "Table of contents", group: "Insert", keywords: ["toc", "contents", "index", "outline", "summary"], Icon: ListTree, run: (e) => e.chain().focus().insertTableOfContents().run() },
  { key: "image", label: "Image", group: "Insert", keywords: ["picture", "photo", "img"], Icon: ImagePlus, run: (_e, a) => a.insertImage() },
  ...TEXT_COLORS.map(
    (c): SlashItem => ({
      key: `color-${c.label}`,
      label: c.hex ? c.label : `${c.label} (default)`,
      group: "Text color",
      keywords: ["color", "colour", c.label.toLowerCase(), ...(c.hex ? [] : ["default", "reset"])],
      swatch: c.hex ?? DEFAULT_SWATCH,
      // With nothing selected, the color applies to what's typed next.
      run: (e) => (c.hex ? e.chain().focus().setColor(c.hex).run() : e.chain().focus().unsetColor().run()),
    })
  ),
];

function matchingItems(query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return ITEMS;
  const score = (item: SlashItem) => {
    const label = item.label.toLowerCase();
    if (label.startsWith(q) || item.keywords.some((k) => k === q)) return 0;
    if (item.keywords.some((k) => k.startsWith(q)) || label.split(" ").some((w) => w.startsWith(q))) return 1;
    return label.includes(q) ? 2 : null;
  };
  return ITEMS.map((item) => ({ item, s: score(item) }))
    .filter((x): x is { item: SlashItem; s: number } => x.s !== null)
    .sort((a, b) => a.s - b.s)
    .map((x) => x.item);
}

/**
 * The "/" menu (as in Notion): typing "/" at the start of a line or after a
 * space lists every block style, inserts (article link, image) and text
 * color; typing more filters them ("/h2", "/quote", "/red"). ↑/↓ move,
 * Enter or Tab applies, Escape closes.
 */
export default function SlashMenu({ editor, actions }: { editor: Editor; actions: SlashActions }) {
  const match = triggerMatch(editor, "/", MAX_QUERY);
  // The highlighted row, for the query it was picked under (a new query starts at the top).
  const [picked, setPicked] = useState<{ query: string | undefined; index: number }>({ query: undefined, index: 0 });
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const items = match ? matchingItems(match.query) : [];
  const open = match !== null && dismissedAt !== match.from && items.length > 0;
  const query = match?.query;
  const activeIndex = picked.query === query ? Math.min(picked.index, Math.max(items.length - 1, 0)) : 0;
  const setActive = (index: number) => setPicked({ query, index });
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function apply(item: SlashItem, m: TriggerMatch) {
    editor.chain().focus().deleteRange({ from: m.from, to: m.to }).run();
    item.run(editor, actions, m.from);
  }

  // The editor's key handler reads the latest menu state through this ref.
  const handler = useRef<(event: KeyboardEvent) => boolean>(() => false);
  useEffect(() => {
    handler.current = (event) => {
      if (!open || !match) return false;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        setActive((activeIndex + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        apply(items[activeIndex], match);
        return true;
      }
      if (event.key === "Escape") {
        setDismissedAt(match.from);
        return true;
      }
      return false;
    };
  });
  useEffect(() => addMenuKeyHandler(editor, (event) => handler.current(event)), [editor]);

  if (!open || !match) return null;
  const coords = editor.view.coordsAtPos(match.from);
  const below = coords.bottom + 4;
  // Open upward when the list wouldn't fit below the line.
  const style = below + 340 > window.innerHeight ? { bottom: window.innerHeight - coords.top + 4, left: coords.left } : { top: below, left: coords.left };
  return createPortal(
    <ul className="mention-menu slash-menu rich-floating" role="listbox" aria-label="Insert or format" style={style} ref={listRef}>
      {items.map((item, i) => (
        <Fragment key={item.key}>
          {!match.query && (i === 0 || items[i - 1].group !== item.group) && (
            <li role="presentation" className="slash-menu-group">
              {item.group}
            </li>
          )}
          <li role="option" aria-selected={i === activeIndex}>
            <button
              type="button"
              className={i === activeIndex ? "mention-option slash-option active" : "mention-option slash-option"}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => apply(item, match)}
            >
              <span className="slash-option-icon" aria-hidden>
                {item.Icon ? <item.Icon size={15} strokeWidth={2.25} /> : <span className="rich-swatch" style={{ background: item.swatch }} />}
              </span>
              <span className="mention-option-label">{item.label}</span>
              {item.shortcut && <kbd className="slash-option-shortcut">{item.shortcut}</kbd>}
            </button>
          </li>
        </Fragment>
      ))}
      <li role="presentation" className="slash-menu-hint">
        ↑↓ move · Enter apply · Esc close · Tab / Shift+Tab nests list items
      </li>
    </ul>,
    document.body
  );
}
