"use client";

import { useState } from "react";
import { X, Lock } from "lucide-react";
import { MAX_TAGS, MAX_TAG_LENGTH } from "@/server/articles/tags";

/**
 * The article's tag chips: the template tag first (fixed, no remove button),
 * then the manual tags, then an input that adds a tag on Enter or comma and
 * suggests tags already used elsewhere.
 */
export default function TagEditor({
  templateTag,
  tags,
  suggestions,
  onChange,
}: {
  templateTag: string;
  tags: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const taken = new Set([templateTag, ...tags].map((t) => t.toLowerCase()));
  const needle = draft.trim().toLowerCase();
  const matches = needle ? suggestions.filter((s) => !taken.has(s.toLowerCase()) && s.toLowerCase().includes(needle)).slice(0, 8) : [];
  const full = tags.length >= MAX_TAGS;

  function add(raw: string) {
    const tag = raw.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH);
    setDraft("");
    if (tag && !taken.has(tag.toLowerCase()) && !full) onChange([...tags, tag]);
  }

  return (
    <div className="article-tags">
      <span className="article-tag fixed" title="Template tag — always present">
        <Lock size={10} strokeWidth={2.5} aria-hidden />
        {templateTag}
      </span>
      {tags.map((t) => (
        <span key={t} className="article-tag">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remove tag ${t}`} title="Remove tag">
            <X size={11} strokeWidth={2.5} />
          </button>
        </span>
      ))}
      <div className="article-tag-input">
        <input
          type="text"
          placeholder={full ? `Max ${MAX_TAGS} tags` : "Add tag…"}
          aria-label="Add tag"
          value={draft}
          maxLength={MAX_TAG_LENGTH}
          disabled={full}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => setDraft(e.target.value.replace(",", ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && tags.length > 0) {
              onChange(tags.slice(0, -1));
            } else if (e.key === "Escape") {
              setDraft("");
            }
          }}
        />
        {focused && matches.length > 0 && (
          <ul className="article-tag-suggestions" role="listbox" aria-label="Tag suggestions">
            {matches.map((s) => (
              <li key={s}>
                {/* mousedown, so the input keeps focus and the pick lands before blur hides the list */}
                <button type="button" onMouseDown={(e) => { e.preventDefault(); add(s); }}>
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
