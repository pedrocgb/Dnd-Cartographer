"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { AtSign } from "lucide-react";
import { api } from "@/components/calendars/api";
import { addMenuKeyHandler, triggerMatch, type TriggerMatch } from "./menu-keys";
import type { MentionOption } from "@/server/mentions/kinds";

const MAX_QUERY = 40;
const SEARCH_DELAY_MS = 120;

/**
 * The @ menu: its first row, "Article…", opens the article link dialog
 * (full search, type filters, custom link text) with what was typed after
 * the "@"; below it, quick matches among articles (and the campaign's
 * quests, fronts and outline items) insert at once. Arrows move, Enter or
 * Tab picks, Escape closes.
 */
export default function MentionMenu({
  editor,
  campaignId,
  onLinkArticle,
}: {
  editor: Editor;
  campaignId: string | null;
  /** Opens the article link dialog for the "@query" range. */
  onLinkArticle: (match: TriggerMatch) => void;
}) {
  const match = triggerMatch(editor, "@", MAX_QUERY);
  const [results, setResults] = useState<{ query: string; options: MentionOption[] } | null>(null);
  const [active, setActive] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const query = match?.query ?? null;

  useEffect(() => {
    if (query === null) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: query });
      if (campaignId) params.set("campaignId", campaignId);
      void api<{ options: MentionOption[] }>("GET", `/api/mentions/search?${params}`).then((res) => {
        if (cancelled || !res.ok) return;
        setResults({ query, options: res.data.options });
        setActive(0);
      });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, campaignId]);

  const open = match !== null && dismissedAt !== match.from;
  const options = open && results ? results.options : [];
  // Row 0 is "Article…"; row i + 1 is options[i].
  const rows = options.length + 1;

  function pick(row: number) {
    if (!match) return;
    if (row === 0) {
      // The dialog takes over: this "@" stays closed (also if the dialog is cancelled).
      setDismissedAt(match.from);
      onLinkArticle(match);
      return;
    }
    const option = options[row - 1];
    editor
      .chain()
      .focus()
      .insertContentAt({ from: match.from, to: match.to }, [
        { type: "mention", attrs: { kind: option.kind, id: option.id, label: option.label, campaign: option.campaign } },
        { type: "text", text: " " },
      ])
      .run();
    setResults(null);
  }

  // The editor's key handler reads the latest menu state through this ref.
  const handler = useRef<(event: KeyboardEvent) => boolean>(() => false);
  useEffect(() => {
    handler.current = (event) => {
      if (!open || !match) return false;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        setActive((i) => (Math.min(i, rows - 1) + (event.key === "ArrowDown" ? 1 : rows - 1)) % rows);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        pick(Math.min(active, rows - 1));
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
  const activeRow = Math.min(active, rows - 1);
  return createPortal(
    <ul className="mention-menu rich-floating" role="listbox" aria-label="Mention" style={{ top: coords.bottom + 4, left: coords.left }}>
      <li role="option" aria-selected={activeRow === 0}>
        <button
          type="button"
          className={activeRow === 0 ? "mention-option mention-article active" : "mention-option mention-article"}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setActive(0)}
          onClick={() => pick(0)}
        >
          <span className="mention-option-label">
            <AtSign size={14} strokeWidth={2.25} aria-hidden />
            Article…
          </span>
          <span className="mention-option-group">Search, filter, set the text</span>
        </button>
      </li>
      {options.map((o, i) => (
        <li key={`${o.kind}:${o.id}`} role="option" aria-selected={i + 1 === activeRow}>
          <button
            type="button"
            className={i + 1 === activeRow ? "mention-option active" : "mention-option"}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i + 1)}
            onClick={() => pick(i + 1)}
          >
            <span className="mention-option-label">{o.label}</span>
            <span className="mention-option-group">{o.group}</span>
          </button>
        </li>
      ))}
    </ul>,
    document.body
  );
}
