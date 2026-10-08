"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SkeletonList } from "../Skeleton";
import { Search, X } from "lucide-react";
import Modal from "@/components/Modal";
import { loadCandidates, type Candidate } from "@/components/articles/candidates";
import { ARTICLE_TEMPLATES, templateOf } from "@/components/articles/templates";
import { MAX_MENTION_LABEL } from "@/server/mentions/kinds";
import type { ArticleTemplateKey } from "@/server/articles/templates";
import { useT } from "@/i18n/useT";
import { formatInteger } from "@/server/settings/number-format";

const MAX_RESULTS = 100;

/** Lower case without accents, so "eliane" finds "Eliâne". */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** 0 name starts with the query, 1 a word starts with it, 2 it's inside; null no match (every word must match). */
function rank(name: string, words: string[], phrase: string): number | null {
  const n = fold(name);
  if (!words.every((w) => n.includes(w))) return null;
  if (n.startsWith(phrase)) return 0;
  return words.every((w) => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(n)) ? 1 : 2;
}

/** The name with every searched word marked. */
function Highlighted({ name, words }: { name: string; words: string[] }) {
  const folded = fold(name);
  // Folding keeps one character per character for the scripts used here, so indexes line up.
  if (!words.length || folded.length !== name.length) return <>{name}</>;
  const marked = new Array<boolean>(name.length).fill(false);
  for (const w of words) {
    for (let i = folded.indexOf(w); i !== -1; i = folded.indexOf(w, i + 1)) marked.fill(true, i, i + w.length);
  }
  const parts: { text: string; mark: boolean }[] = [];
  for (let i = 0; i < name.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.mark === marked[i]) last.text += name[i];
    else parts.push({ text: name[i], mark: marked[i] });
  }
  return <>{parts.map((p, i) => (p.mark ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}</>;
}

export interface ArticleLinkChoice {
  template: ArticleTemplateKey;
  id: string;
  name: string;
  /** What the link reads; null uses the article's name. */
  text: string | null;
}

/**
 * "Link an article": a search over every article (all words must match,
 * accents ignored, names starting with the query first) narrowed by type
 * chips, then the text the link will read — the article's own name when
 * left empty. ↑/↓ move through the results, Enter picks one, Enter in the
 * text field (or Ctrl+Enter anywhere) inserts it.
 */
export default function ArticleLinkModal({
  initialQuery = "",
  initialText = "",
  onPick,
  onClose,
}: {
  initialQuery?: string;
  /** Prefills the link text (e.g. the selected words the link will replace). */
  initialText?: string;
  onPick: (choice: ArticleLinkChoice) => void;
  onClose: () => void;
}) {
  const t = useT("editor");
  const tc = useT("common");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [types, setTypes] = useState<ReadonlySet<ArticleTemplateKey>>(new Set());
  const [active, setActive] = useState(0);
  const [chosen, setChosen] = useState<Candidate | null>(null);
  const [text, setText] = useState(initialText);
  const listRef = useRef<HTMLUListElement>(null);
  const textRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadCandidates().then(
      (all) => !cancelled && setCandidates(all),
      () => !cancelled && setFailed(true)
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const words = useMemo(() => fold(query).split(/\s+/).filter(Boolean), [query]);

  /** Matches of the text query, before the type filter (the chips count these). */
  const matches = useMemo(() => {
    if (!candidates) return [];
    const phrase = words.join(" ");
    return candidates
      .map((c) => ({ c, r: rank(c.name, words, phrase) }))
      .filter((x): x is { c: Candidate; r: number } => x.r !== null)
      .sort((a, b) => a.r - b.r || a.c.name.localeCompare(b.c.name))
      .map((x) => x.c);
  }, [candidates, words]);

  const counts = useMemo(() => {
    const out = new Map<ArticleTemplateKey, number>();
    for (const c of matches) out.set(c.template, (out.get(c.template) ?? 0) + 1);
    return out;
  }, [matches]);

  const filtered = types.size ? matches.filter((c) => types.has(c.template)) : matches;
  const results = filtered.slice(0, MAX_RESULTS);
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));
  // Types that have articles, in the sidebar's order.
  const chips = ARTICLE_TEMPLATES.filter((t) => candidates?.some((c) => c.template === t.key));

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function toggleType(key: ArticleTemplateKey) {
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setActive(0);
  }

  function choose(c: Candidate) {
    setChosen(c);
    textRef.current?.focus();
  }

  function insert(c: Candidate | null = chosen) {
    if (!c) return;
    const value = text.trim().slice(0, MAX_MENTION_LABEL);
    onPick({ template: c.template, id: c.id, name: c.name, text: value && value !== c.name ? value : null });
  }

  function onSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length) setActive((activeIndex + (e.key === "ArrowDown" ? 1 : results.length - 1)) % results.length);
    } else if (e.key === "Enter" && !(e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (results[activeIndex]) choose(results[activeIndex]);
    }
  }

  const linksTo = t("articleLink.linksTo").split("{name}");
  return (
    <Modal open onClose={onClose} title={t("articleLink.title")} className="rich-floating">
      <div
        className="article-link"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            insert();
          }
        }}
      >
        <div className="article-link-search">
          <Search size={15} strokeWidth={2.25} aria-hidden />
          <input
            type="text"
            role="combobox"
            aria-label={t("articleLink.search")}
            aria-expanded
            aria-controls="article-link-results"
            aria-activedescendant={results[activeIndex] ? `article-link-${results[activeIndex].id}` : undefined}
            placeholder={t("articleLink.searchPlaceholder")}
            value={query}
            autoFocus
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onSearchKeyDown}
          />
          {query && (
            <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("articleLink.clear")} data-tooltip={t("articleLink.clear")} onClick={() => setQuery("")}>
              <X size={14} strokeWidth={2.25} />
            </button>
          )}
        </div>

        {chips.length > 1 && (
          <div className="tag-toggle-grid article-link-types" role="group" aria-label={t("articleLink.filter")}>
            <button type="button" className={types.size === 0 ? "tag-toggle active" : "tag-toggle"} aria-pressed={types.size === 0} onClick={() => setTypes(new Set())}>
              {t("articleLink.all")} <span className="article-link-count">{matches.length}</span>
            </button>
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className={types.has(chip.key) ? "tag-toggle active" : "tag-toggle"}
                aria-pressed={types.has(chip.key)}
                onClick={() => toggleType(chip.key)}
              >
                <chip.Icon size={12} strokeWidth={2.25} aria-hidden />
                {chip.plural} <span className="article-link-count">{counts.get(chip.key) ?? 0}</span>
              </button>
            ))}
          </div>
        )}

        {failed && <p className="form-error">{t("articleLink.loadFailed")}</p>}
        {!failed && !candidates && <SkeletonList rows={5} avatar label={t("articleLink.loading")} />}
        {candidates && results.length === 0 && <p className="field-label">{query ? t("articleLink.noMatchQuery", { query }) : t("articleLink.noMatch")}</p>}
        {results.length > 0 && (
          <ul className="article-link-results" id="article-link-results" role="listbox" aria-label={t("articleLink.results")} ref={listRef}>
            {results.map((c, i) => {
              const tpl = templateOf(c.template);
              const selected = chosen?.id === c.id;
              return (
                <li key={`${c.template}:${c.id}`} role="none">
                  <button
                    type="button"
                    id={`article-link-${c.id}`}
                    role="option"
                    aria-selected={selected}
                    data-active={i === activeIndex}
                    className={["article-link-row", i === activeIndex && "active", selected && "selected"].filter(Boolean).join(" ")}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(c)}
                    onDoubleClick={() => insert(c)}
                  >
                    <tpl.Icon size={15} strokeWidth={2} aria-hidden />
                    <span className="article-link-name">
                      <Highlighted name={c.name} words={words} />
                    </span>
                    <span className="article-link-type">{tpl.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {filtered.length > MAX_RESULTS && <p className="field-label">{t("articleLink.truncated", { max: formatInteger(MAX_RESULTS), n: formatInteger(filtered.length) })}</p>}

        <form
          className="article-link-footer"
          onSubmit={(e) => {
            e.preventDefault();
            insert();
          }}
        >
          <label className="field-label" htmlFor="article-link-text">
            {t("articleLink.text")}
          </label>
          <input
            ref={textRef}
            id="article-link-text"
            type="text"
            maxLength={MAX_MENTION_LABEL}
            placeholder={chosen ? t("articleLink.textPlaceholderChosen", { name: chosen.name }) : t("articleLink.textPlaceholder")}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="field-label">
            {chosen ? (
              <>
                {linksTo[0]}
                <strong>{chosen.name}</strong>
                {linksTo[1]}
              </>
            ) : (
              t("articleLink.pick")
            )}
          </p>
          <div className="marker-panel-actions">
            <button type="submit" className="btn btn-sm btn-primary" disabled={!chosen}>
              {t("articleLink.insert")}
            </button>
            <button type="button" className="btn btn-sm" onClick={onClose}>
              {tc("cancel")}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
