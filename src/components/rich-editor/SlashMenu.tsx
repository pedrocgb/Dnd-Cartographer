"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import {
  AtSign,
  CalendarDays,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  ImagePlus,
  List,
  ListOrdered,
  ListTree,
  Lock,
  Table,
  Minus,
  Pilcrow,
  TextQuote,
  Type,
  type LucideIcon,
} from "lucide-react";
import { addMenuKeyHandler, triggerMatch, type TriggerMatch } from "./menu-keys";
import { DEFAULT_SWATCH, TEXT_COLORS } from "./colors";
import { useT } from "@/i18n/useT";
import { createTranslator, type Translator } from "@/i18n/translate";

const MAX_QUERY = 24;
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = IS_MAC ? "⌘" : "Ctrl";
const ALT = IS_MAC ? "⌥" : "Alt";

export interface SlashActions {
  /** Opens the article link dialog, the link going where the "/" was. */
  linkArticle: (at: number) => void;
  /** Opens the image file picker (the image lands at the caret). */
  insertImage: () => void;
  /** Opens the calendar date dialog, the date going where the "/" was. */
  linkCalendarDate: (at: number) => void;
  /** Opens the table size picker at `at` (the table lands at the caret). */
  insertTable: (at: number) => void;
}

type T = Translator<"editor">;

interface SlashItem {
  key: string;
  label: (t: T) => string;
  group: "blocks" | "insert" | "color";
  /** Other words it's found by ("h1", "ul", "#", …). */
  keywords: string[];
  Icon?: LucideIcon;
  /** Color swatch instead of an icon. */
  swatch?: string;
  shortcut?: string;
  /** Markdown-style shortcut typed before a space ("-", "1.", ">"): shown as "- space". */
  spaceKey?: string;
  /** Runs once the "/query" text is gone; `at` is where it was. */
  run: (editor: Editor, actions: SlashActions, at: number) => void;
}

const HEADING_ICONS = [Heading1, Heading2, Heading3, Heading4, Heading5];

const ITEMS: SlashItem[] = [
  { key: "text", label: (t) => t("style.text"), group: "blocks", keywords: ["paragraph", "plain", "p"], Icon: Pilcrow, shortcut: `${MOD}+${ALT}+0`, run: (e) => e.chain().focus().clearNodes().setParagraph().run() },
  { key: "title", label: (t) => t("style.title"), group: "blocks", keywords: ["big"], Icon: Type, shortcut: `${MOD}+${ALT}+T`, run: (e) => e.chain().focus().clearNodes().setTitle().run() },
  ...([1, 2, 3, 4, 5] as const).map(
    (level): SlashItem => ({
      key: `h${level}`,
      label: (t) => t("style.heading", { level }),
      group: "blocks",
      keywords: [`h${level}`, "#".repeat(level), "heading", "header"],
      Icon: HEADING_ICONS[level - 1],
      shortcut: `${MOD}+${ALT}+${level}`,
      run: (e) => e.chain().focus().clearNodes().setHeading({ level }).run(),
    })
  ),
  { key: "bullet", label: (t) => t("style.bullet"), group: "blocks", keywords: ["ul", "unordered", "-", "*"], Icon: List, spaceKey: "-", run: (e) => e.chain().focus().toggleBulletList().run() },
  { key: "ordered", label: (t) => t("style.ordered"), group: "blocks", keywords: ["ol", "ordered", "1."], Icon: ListOrdered, spaceKey: "1.", run: (e) => e.chain().focus().toggleOrderedList().run() },
  { key: "quote", label: (t) => t("style.quote"), group: "blocks", keywords: ["blockquote", ">", "citation"], Icon: TextQuote, spaceKey: ">", run: (e) => e.chain().focus().clearNodes().setBlockquote().run() },
  { key: "secret", label: (t) => t("style.secret"), group: "blocks", keywords: ["hidden", "gm", "spoiler", "private"], Icon: Lock, run: (e) => e.chain().focus().toggleSecret().run() },
  { key: "divider", label: (t) => t("style.divider"), group: "blocks", keywords: ["hr", "rule", "line", "separator", "---"], Icon: Minus, shortcut: "---", run: (e) => e.chain().focus().setHorizontalRule().run() },
  { key: "article", label: (t) => t("slash.article"), group: "insert", keywords: ["link", "mention", "@", "reference"], Icon: AtSign, shortcut: `${MOD}+K`, run: (_e, a, at) => a.linkArticle(at) },
  { key: "date", label: (t) => t("slash.date"), group: "insert", keywords: ["date", "day", "calendar", "when", "event"], Icon: CalendarDays, run: (_e, a, at) => a.linkCalendarDate(at) },
  { key: "toc", label: (t) => t("slash.toc"), group: "insert", keywords: ["toc", "contents", "index", "outline", "summary"], Icon: ListTree, run: (e) => e.chain().focus().insertTableOfContents().run() },
  { key: "table", label: (t) => t("slash.table"), group: "insert", keywords: ["grid", "rows", "columns", "cells", "spreadsheet"], Icon: Table, run: (_e, a, at) => a.insertTable(at) },
  { key: "image", label: (t) => t("slash.image"), group: "insert", keywords: ["picture", "photo", "img"], Icon: ImagePlus, run: (_e, a) => a.insertImage() },
  ...TEXT_COLORS.map(
    (c): SlashItem => ({
      key: `color-${c.label}`,
      label: (t) => (c.hex ? t(`color.${c.label}`) : t("color.default", { color: t(`color.${c.label}`) })),
      group: "color",
      keywords: ["color", "colour", c.label.toLowerCase(), ...(c.hex ? [] : ["default", "reset"])],
      swatch: c.hex ?? DEFAULT_SWATCH,
      // With nothing selected, the color applies to what's typed next.
      run: (e) => (c.hex ? e.chain().focus().setColor(c.hex).run() : e.chain().focus().unsetColor().run()),
    })
  ),
];

const EN = createTranslator("en-US", "editor");

/** Matches the label in the user's language and in English (so "/table" works in every language). */
function matchingItems(query: string, t: T): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return ITEMS;
  const scoreLabel = (item: SlashItem, label: string) => {
    if (label.startsWith(q) || item.keywords.some((k) => k === q)) return 0;
    if (item.keywords.some((k) => k.startsWith(q)) || label.split(" ").some((w) => w.startsWith(q))) return 1;
    return label.includes(q) ? 2 : null;
  };
  const score = (item: SlashItem) => {
    const scores = [scoreLabel(item, item.label(t).toLowerCase()), scoreLabel(item, item.label(EN).toLowerCase())].filter((s): s is number => s !== null);
    return scores.length ? Math.min(...scores) : null;
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
  const t = useT("editor");
  const match = triggerMatch(editor, "/", MAX_QUERY);
  // The highlighted row, for the query it was picked under (a new query starts at the top).
  const [picked, setPicked] = useState<{ query: string | undefined; index: number }>({ query: undefined, index: 0 });
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const items = match ? matchingItems(match.query, t) : [];
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
    <ul className="mention-menu slash-menu rich-floating" role="listbox" aria-label={t("slash.label")} style={style} ref={listRef}>
      {items.map((item, i) => (
        <Fragment key={item.key}>
          {!match.query && (i === 0 || items[i - 1].group !== item.group) && (
            <li role="presentation" className="slash-menu-group">
              {t(`slash.group.${item.group}`)}
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
              <span className="mention-option-label">{item.label(t)}</span>
              {item.shortcut && <kbd className="slash-option-shortcut">{item.shortcut}</kbd>}
              {item.spaceKey && <kbd className="slash-option-shortcut">{t("slash.space", { key: item.spaceKey })}</kbd>}
            </button>
          </li>
        </Fragment>
      ))}
      <li role="presentation" className="slash-menu-hint">
        {t("slash.hint")}
      </li>
    </ul>,
    document.body
  );
}
