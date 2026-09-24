"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { articleHref, type ArticleTemplateKey } from "@/server/articles/templates";
import { ARTICLE_TEMPLATES, templateOf } from "@/components/articles/templates";
import InfoPicker, { type PickerOption } from "@/components/articles/InfoPicker";

interface ArticleLink {
  id: string;
  template: ArticleTemplateKey;
  articleId: string;
  label: string;
  /** Null once the linked article was deleted. */
  name: string | null;
}

interface Candidate {
  template: ArticleTemplateKey;
  id: string;
  name: string;
}

async function json<T>(res: Response): Promise<T> {
  return res.json();
}

/** Every live article, for the picker. */
async function loadCandidates(): Promise<Candidate[]> {
  const [t, p, o, a] = await Promise.all([
    fetch("/api/politics/territories").then((r) => json<{ territories: { id: string; name: string }[] }>(r)),
    fetch("/api/politics/people").then((r) => json<{ people: { id: string; name: string }[] }>(r)),
    fetch("/api/politics/organizations").then((r) => json<{ organizations: { id: string; name: string }[] }>(r)),
    fetch("/api/articles").then((r) => json<{ articles: { id: string; title: string; template: ArticleTemplateKey }[] }>(r)),
  ]);
  return [
    ...t.territories.map((x) => ({ template: "territory" as const, id: x.id, name: x.name })),
    ...p.people.map((x) => ({ template: "character" as const, id: x.id, name: x.name })),
    ...o.organizations.map((x) => ({ template: "organization" as const, id: x.id, name: x.name })),
    ...a.articles.map((x) => ({ template: x.template, id: x.id, name: x.title })),
  ];
}

function AddArticleLink({ markerId, linkedIds, onAdded }: { markerId: string; linkedIds: Set<string>; onAdded: (link: ArticleLink) => void }) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadCandidates()
      .then((c) => !cancelled && setCandidates(c))
      .catch(() => !cancelled && setError("Could not load the articles."));
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Grouped by template in sidebar order, alphabetical within; already-linked ones left out.
  const options = useMemo<PickerOption[]>(
    () =>
      ARTICLE_TEMPLATES.flatMap((t) =>
        (candidates ?? [])
          .filter((c) => c.template === t.key && !linkedIds.has(c.id))
          .sort((x, y) => x.name.localeCompare(y.name))
          .map((c) => ({ value: c.id, label: c.name, group: t.plural }))
      ),
    [candidates, linkedIds]
  );

  function close() {
    setOpen(false);
    setArticleId(null);
    setLabel("");
    setError(null);
  }

  async function submit() {
    const picked = candidates?.find((c) => c.id === articleId);
    if (!picked) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/markers/${markerId}/articles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: picked.template, articleId: picked.id, label }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not link the article.");
      return;
    }
    onAdded(data.link);
    close();
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-sm marker-articles-add" onClick={() => setOpen(true)}>
        <Plus size={14} strokeWidth={2.25} />
        Link an article
      </button>
    );
  }

  return (
    <div className="marker-articles-form">
      <InfoPicker
        options={options}
        value={articleId}
        placeholder={candidates === null ? "Loading articles…" : options.length ? "Choose an article…" : "No article left to link"}
        ariaLabel="Article"
        collapsibleGroups
        disabled={candidates === null || options.length === 0}
        onChange={setArticleId}
      />
      <input
        type="text"
        placeholder="Relationship (optional), e.g. Lord of this keep"
        aria-label="Relationship to this marker"
        maxLength={80}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void submit()}
      />
      {error && <p className="form-error">{error}</p>}
      <div className="marker-panel-actions">
        <button type="button" className="btn btn-sm btn-primary" disabled={!articleId || saving} onClick={submit}>
          {saving ? "Linking…" : "Link"}
        </button>
        <button type="button" className="btn btn-sm" onClick={close}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** The marker panel's Articles tab: any article linked to this marker, with an optional relationship. */
export default function MarkerArticlesPanel({ markerId }: { markerId: string }) {
  const [links, setLinks] = useState<ArticleLink[] | null>(null);

  // Mounted with the marker (hidden while another tab shows), like the other sections.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/markers/${markerId}/articles`)
      .then((r) => json<{ links: ArticleLink[] }>(r))
      .then((d) => !cancelled && setLinks(d.links))
      .catch(() => !cancelled && setLinks([]));
    return () => {
      cancelled = true;
    };
  }, [markerId]);

  const linkedIds = useMemo(() => new Set((links ?? []).map((l) => l.articleId)), [links]);

  async function remove(id: string) {
    await fetch(`/api/markers/${markerId}/articles/${id}`, { method: "DELETE" });
    setLinks((prev) => (prev ?? []).filter((l) => l.id !== id));
  }

  if (links === null) return <p className="field-label">Loading…</p>;

  return (
    <div className="marker-articles-panel">
      <h3 className="marker-section-title">Articles</h3>
      <AddArticleLink markerId={markerId} linkedIds={linkedIds} onAdded={(link) => setLinks((prev) => [...(prev ?? []), link])} />
      {links.length === 0 ? (
        <p className="field-label">No articles linked yet. Link the characters, places, lore or anything else this marker is about.</p>
      ) : (
        <ul className="marker-articles-list">
          {links.map((link) => {
            const { Icon, label } = templateOf(link.template);
            return (
              <li key={link.id} className="marker-article-row">
                <span className="marker-article-icon" title={label}>
                  <Icon size={15} strokeWidth={2.25} aria-label={label} />
                </span>
                <span className="marker-article-text">
                  {link.name ? (
                    <a href={articleHref(link.template, link.articleId)} target="_blank" rel="noopener noreferrer" className="marker-article-name">
                      {link.name}
                    </a>
                  ) : (
                    <span className="marker-article-name removed">Deleted article</span>
                  )}
                  {link.label && <span className="marker-article-label">{link.label}</span>}
                </span>
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => remove(link.id)} aria-label={`Unlink ${link.name ?? "article"}`} title="Unlink">
                  <X size={14} strokeWidth={2.25} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
