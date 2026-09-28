"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { api } from "@/components/calendars/api";
import { setMentionKeyHandler } from "./mention";
import type { MentionOption } from "@/server/mentions/kinds";

const MAX_QUERY = 40;
const SEARCH_DELAY_MS = 120;

interface Match {
  /** Where the "@" is. */
  from: number;
  to: number;
  query: string;
}

/** The "@query" right before the caret, if the caret sits after one. */
function currentMatch(editor: Editor): Match | null {
  const { selection } = editor.state;
  if (!editor.isEditable || !selection.empty || !selection.$from.parent.isTextblock) return null;
  const $from = selection.$from;
  const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - MAX_QUERY - 2), $from.parentOffset, undefined, "￼");
  const m = /(?:^|[\s([])@([^@￼\n]*)$/.exec(before);
  if (!m || m[1].length > MAX_QUERY || m[1].startsWith(" ") || m[1].includes("  ")) return null;
  return { from: selection.from - m[1].length - 1, to: selection.from, query: m[1] };
}

/**
 * The @ menu: typing "@" and part of a name lists matching articles (and
 * the campaign's quests, fronts and outline items); arrows move, Enter or
 * Tab inserts, Escape closes.
 */
export default function MentionMenu({ editor, campaignId }: { editor: Editor; campaignId: string | null }) {
  const match = currentMatch(editor);
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

  const open = match !== null && dismissedAt !== match.from && results !== null && results.options.length > 0;
  const options = open ? results.options : [];

  function choose(option: MentionOption) {
    if (!match) return;
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
        setActive((i) => (i + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        choose(options[Math.min(active, options.length - 1)]);
        return true;
      }
      if (event.key === "Escape") {
        setDismissedAt(match.from);
        return true;
      }
      return false;
    };
  });
  useEffect(() => {
    setMentionKeyHandler(editor, (event) => handler.current(event));
    return () => setMentionKeyHandler(editor, null);
  }, [editor]);

  if (!open || !match) return null;
  const coords = editor.view.coordsAtPos(match.from);
  return createPortal(
    <ul className="mention-menu" role="listbox" aria-label="Mention" style={{ top: coords.bottom + 4, left: coords.left }}>
      {options.map((o, i) => (
        <li key={`${o.kind}:${o.id}`} role="option" aria-selected={i === active}>
          <button
            type="button"
            className={i === active ? "mention-option active" : "mention-option"}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => choose(o)}
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
