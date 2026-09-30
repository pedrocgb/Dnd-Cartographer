"use client";

import { useMemo, useState } from "react";
import { Plus, Star, X } from "lucide-react";
import { articleHref, type ArticleTemplateKey } from "@/server/articles/templates";
import InfoPicker from "@/components/articles/InfoPicker";
import { candidateOptions } from "@/components/articles/candidates";
import { QUICK_CREATE_TEMPLATES, quickCreateArticle } from "@/components/articles/quick-create";
import { SkeletonList } from "@/components/Skeleton";
import { useArticleCandidates, type MarkerArticleLink, type MarkerArticleLinks } from "./marker-panel/use-marker-article-links";
import { TemplateIcon } from "./marker-panel/MarkerSubject";

/** Common relationships of an article to a place, one click each; free text still works. */
const ROLE_PRESETS = ["Located here", "Ruler", "Resident", "Owner", "Founded by", "Born here", "Related"];
const MAX_LABEL_LENGTH = 80;
const NEW_PREFIX = "new:";

function RoleChips({ value, onPick }: { value: string; onPick: (role: string) => void }) {
  return (
    <div className="tag-toggle-grid" role="group" aria-label="Common relationships">
      {ROLE_PRESETS.map((role) => (
        <button key={role} type="button" className={value === role ? "tag-toggle active" : "tag-toggle"} aria-pressed={value === role} onClick={() => onPick(value === role ? "" : role)}>
          {role}
        </button>
      ))}
    </div>
  );
}

function AddArticleLink({ links, markerName, onDone }: { links: MarkerArticleLinks; markerName: string; onDone: () => void }) {
  const { candidates, error: loadError, refresh } = useArticleCandidates(true);
  const [picked, setPicked] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const linkedIds = useMemo(() => new Set((links.links ?? []).map((l) => l.articleId)), [links.links]);
  // Already-linked ones left out; "create new" rows in their own folder at the end.
  const options = useMemo(
    () => [
      ...candidateOptions(candidates ?? [], linkedIds),
      ...QUICK_CREATE_TEMPLATES.map((t) => ({ value: `${NEW_PREFIX}${t.key}`, label: `New ${t.label} “${markerName}”`, group: "Create new" })),
    ],
    [candidates, linkedIds, markerName]
  );

  async function submit() {
    if (!picked) return;
    setSaving(true);
    setError(null);
    try {
      const article = picked.startsWith(NEW_PREFIX)
        ? await quickCreateArticle(picked.slice(NEW_PREFIX.length) as ArticleTemplateKey, markerName)
        : candidates?.find((c) => c.id === picked);
      if (!article) return;
      if (picked.startsWith(NEW_PREFIX)) refresh();
      const failure = await links.add(article, { label });
      if (failure) return setError(failure);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the article.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="marker-articles-form">
      <InfoPicker
        options={options}
        value={picked}
        placeholder={candidates === null ? (loadError ? "Could not load the articles" : "Loading articles…") : "Choose or create an article…"}
        ariaLabel="Article"
        collapsibleGroups
        disabled={candidates === null}
        onChange={setPicked}
      />
      <input
        type="text"
        placeholder="Relationship (optional), e.g. Lord of this keep"
        aria-label="Relationship to this marker"
        maxLength={MAX_LABEL_LENGTH}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void submit()}
      />
      <RoleChips value={label} onPick={setLabel} />
      {error && <p className="form-error">{error}</p>}
      <div className="marker-panel-actions">
        <button type="button" className="btn btn-sm btn-primary" disabled={!picked || saving} onClick={submit}>
          {saving ? "Linking…" : "Link"}
        </button>
        <button type="button" className="btn btn-sm" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** One linked article: star (make primary), name, editable relationship, unlink. */
function LinkRow({ link, links }: { link: MarkerArticleLink; links: MarkerArticleLinks }) {
  const [label, setLabel] = useState(link.label);
  const [editing, setEditing] = useState(false);

  function saveLabel(next: string) {
    setLabel(next);
    if (next.trim() !== link.label) void links.update(link.id, { label: next });
  }

  return (
    <li className={link.isPrimary ? "marker-article-row primary" : "marker-article-row"}>
      <button
        type="button"
        className={link.isPrimary ? "btn btn-ghost btn-icon marker-primary-star active" : "btn btn-ghost btn-icon marker-primary-star"}
        aria-pressed={link.isPrimary}
        aria-label={link.isPrimary ? "Main article" : "Make main article"}
        data-tooltip={link.isPrimary ? "Main article (shown on hover)" : "Make main article"}
        onClick={() => !link.isPrimary && links.update(link.id, { primary: true })}
      >
        <Star size={14} strokeWidth={2.25} fill={link.isPrimary ? "currentColor" : "none"} />
      </button>
      <TemplateIcon template={link.template} />
      <span className="marker-article-text">
        {link.name ? (
          <a href={articleHref(link.template, link.articleId)} target="_blank" rel="noopener noreferrer" className="marker-article-name">
            {link.name}
          </a>
        ) : (
          <span className="marker-article-name removed">Deleted article</span>
        )}
        {editing ? (
          <>
            <input
              type="text"
              autoFocus
              aria-label="Relationship to this marker"
              maxLength={MAX_LABEL_LENGTH}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => {
                saveLabel(label);
                setEditing(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
            <RoleChips
              value={label}
              onPick={(role) => {
                saveLabel(role);
                setEditing(false);
              }}
            />
          </>
        ) : (
          <button type="button" className="marker-article-label marker-article-label-btn" onClick={() => setEditing(true)}>
            {link.label || "Add relationship…"}
          </button>
        )}
      </span>
      <button type="button" className="btn btn-ghost btn-icon" onClick={() => links.remove(link.id)} aria-label={`Unlink ${link.name ?? "article"}`} data-tooltip="Unlink">
        <X size={14} strokeWidth={2.25} />
      </button>
    </li>
  );
}

/**
 * The marker panel's Articles tab: every article linked to this marker with
 * its relationship. The starred one is the main article — the one the map's
 * hover card and the panel's card show.
 */
export default function MarkerArticlesPanel({ links, markerName }: { links: MarkerArticleLinks; markerName: string }) {
  const [adding, setAdding] = useState(false);

  if (links.links === null) return <SkeletonList rows={3} label="Loading linked articles…" />;

  return (
    <div className="marker-articles-panel">
      <h3 className="marker-section-title">Articles</h3>
      {adding ? (
        <AddArticleLink links={links} markerName={markerName} onDone={() => setAdding(false)} />
      ) : (
        <button type="button" className="btn btn-sm marker-articles-add" onClick={() => setAdding(true)}>
          <Plus size={14} strokeWidth={2.25} />
          Link an article
        </button>
      )}
      {links.links.length === 0 ? (
        <p className="field-label">No articles linked yet. Link the characters, places, lore or anything else this marker is about.</p>
      ) : (
        <ul className="marker-articles-list">
          {links.links.map((link) => (
            <LinkRow key={`${link.id}:${link.label}`} link={link} links={links} />
          ))}
        </ul>
      )}
    </div>
  );
}
