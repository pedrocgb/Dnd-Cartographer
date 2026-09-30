"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Sparkles, X } from "lucide-react";
import { articleHref, type ArticleTemplateKey } from "@/server/articles/templates";
import { TEMPLATE_MARKER_DEFAULTS } from "@/server/markers/icon-registry";
import { templateOf } from "@/components/articles/templates";
import InfoPicker from "@/components/articles/InfoPicker";
import { candidateOptions, type Candidate } from "@/components/articles/candidates";
import { QUICK_CREATE_TEMPLATES, quickCreateArticle } from "@/components/articles/quick-create";
import { RawIcon } from "../MarkerIcon";
import { loadPreview, type MarkerPreview } from "../MarkerHoverCard";
import { useArticleCandidates, type MarkerArticleLink, type MarkerArticleLinks } from "./use-marker-article-links";
import type { Marker } from "../MarkerLayer";
import type { MarkerUpdate } from "./types";

/** The name a freshly placed marker gets (MapWorkspace.placeMarker); linking an article replaces it. */
const PLACEHOLDER_NAME = "New marker";

const CREATE_OPTIONS = QUICK_CREATE_TEMPLATES.map((t) => ({ value: t.key, label: t.label }));

/** A linked article's name, opening the article in a new tab (the map stays as it was). */
function ArticleName({ link }: { link: MarkerArticleLink }) {
  if (!link.name) return <span className="marker-article-name removed">Deleted article</span>;
  return (
    <a href={articleHref(link.template, link.articleId)} target="_blank" rel="noopener noreferrer" className="marker-article-name">
      {link.name}
    </a>
  );
}

/** View mode: the primary article as a card (image, template, first lines), the other links as chips. */
export function MarkerSubjectView({ markerId, links }: { markerId: string; links: MarkerArticleLinks }) {
  const primary = links.primary;
  const [preview, setPreview] = useState<{ linkId: string; data: MarkerPreview | null } | null>(null);

  useEffect(() => {
    if (!primary) return;
    let cancelled = false;
    loadPreview(markerId).then((data) => !cancelled && setPreview({ linkId: primary.id, data }));
    return () => {
      cancelled = true;
    };
  }, [markerId, primary]);

  if (!links.links || links.links.length === 0) return null;
  const card = preview?.linkId === primary?.id ? preview?.data?.article : null;
  const others = links.links.filter((l) => !l.isPrimary);

  return (
    <div className="marker-subject">
      {primary && (
        <div className="marker-subject-card">
          {card?.portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local API route, not a static asset
            <img className="marker-subject-portrait" src={card.portraitUrl} alt="" />
          ) : (
            <TemplateBadge template={primary.template} />
          )}
          <div className="marker-subject-text">
            <span className="marker-hover-card-template">{templateOf(primary.template).label}</span>
            <ArticleName link={primary} />
            {primary.label && <span className="marker-hover-card-role">{primary.label}</span>}
          </div>
          {card?.excerpt && <p className="marker-subject-excerpt">{card.excerpt}</p>}
          {primary.name && (
            <a className="btn btn-sm marker-subject-open" href={articleHref(primary.template, primary.articleId)} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} strokeWidth={2.25} />
              Open article
            </a>
          )}
        </div>
      )}
      {others.length > 0 && (
        <ul className="marker-link-chips" aria-label="Also linked">
          {others.map((l) => {
            const { Icon, label } = templateOf(l.template);
            return (
              <li key={l.id} className="marker-link-chip">
                <Icon size={13} strokeWidth={2.25} aria-label={label} data-tooltip={label} />
                <ArticleName link={l} />
                {l.label && <span className="marker-link-chip-role">{l.label}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** A template's icon for an article row, named by its tooltip. */
export function TemplateIcon({ template }: { template: ArticleTemplateKey }) {
  const { Icon, label } = templateOf(template);
  return (
    <span className="marker-article-icon" data-tooltip={label}>
      <Icon size={15} strokeWidth={2.25} aria-label={label} />
    </span>
  );
}

function TemplateBadge({ template }: { template: ArticleTemplateKey }) {
  const { Icon } = templateOf(template);
  return (
    <span className="marker-subject-portrait marker-hover-card-portrait-empty">
      <Icon size={22} strokeWidth={2} aria-hidden="true" />
    </span>
  );
}

/** Offers the template's icon and category once a marker's main article is set, if it looks different. */
function LookSuggestion({ template, marker, onUpdate, onDismiss }: { template: ArticleTemplateKey; marker: Marker; onUpdate: MarkerUpdate; onDismiss: () => void }) {
  const look = TEMPLATE_MARKER_DEFAULTS[template];
  if (!look || look.iconKey === marker.iconKey) return null;
  return (
    <div className="marker-suggestion">
      <RawIcon iconKey={look.iconKey} size={16} aria-hidden="true" />
      <span>Use the {templateOf(template).label} icon?</span>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => {
          onUpdate({ iconKey: look.iconKey, category: look.category });
          onDismiss();
        }}
      >
        Apply
      </button>
      <button type="button" className="btn btn-ghost btn-icon" aria-label="Dismiss" data-tooltip="Dismiss" onClick={onDismiss}>
        <X size={14} strokeWidth={2.25} />
      </button>
    </div>
  );
}

/**
 * Edit mode: the marker's main article. Link an existing one (a name match
 * is suggested), or create one named after the marker in one step. Setting
 * it names a still-unnamed marker after the article and offers the
 * template's icon.
 */
export function MarkerSubjectEdit({
  marker,
  links,
  onUpdate,
  onRename,
}: {
  marker: Marker;
  links: MarkerArticleLinks;
  onUpdate: MarkerUpdate;
  onRename: (name: string) => void;
}) {
  const { candidates, error: loadError, refresh } = useArticleCandidates(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suggestLook, setSuggestLook] = useState<ArticleTemplateKey | null>(null);
  const primary = links.primary;
  const linked = useMemo(() => new Map((links.links ?? []).map((l) => [l.articleId, l])), [links.links]);
  const options = useMemo(() => candidateOptions(candidates ?? [], primary ? new Set([primary.articleId]) : undefined), [candidates, primary]);

  const trimmedName = marker.name.trim().toLowerCase();
  const nameMatch = !primary && trimmedName !== PLACEHOLDER_NAME.toLowerCase() ? candidates?.find((c) => c.name.toLowerCase() === trimmedName && !linked.has(c.id)) : undefined;

  async function makePrimary(article: Candidate) {
    setBusy(true);
    setError(null);
    const existing = linked.get(article.id);
    const failure = existing ? (await links.update(existing.id, { primary: true }), null) : await links.add(article, { primary: true });
    setBusy(false);
    if (failure) return setError(failure);
    if (marker.name.trim() === PLACEHOLDER_NAME) onRename(article.name);
    setSuggestLook(article.template);
  }

  async function createAndLink(template: ArticleTemplateKey) {
    const name = marker.name.trim() || PLACEHOLDER_NAME;
    setBusy(true);
    setError(null);
    try {
      const created = await quickCreateArticle(template, name);
      refresh();
      setBusy(false);
      await makePrimary(created);
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Could not create the article.");
    }
  }

  return (
    <section className="marker-card" aria-labelledby="marker-subject-title">
      <h3 id="marker-subject-title" className="marker-card-title">
        Main article
      </h3>
      {primary && (
        <div className="marker-article-row marker-subject-row">
          <TemplateIcon template={primary.template} />
          <span className="marker-article-text">
            <ArticleName link={primary} />
            <span className="marker-article-label">{templateOf(primary.template).label}</span>
          </span>
          <button type="button" className="btn btn-ghost btn-icon" aria-label={`Unlink ${primary.name ?? "article"}`} data-tooltip="Unlink" onClick={() => links.remove(primary.id)}>
            <X size={14} strokeWidth={2.25} />
          </button>
        </div>
      )}
      {nameMatch && (
        <div className="marker-suggestion">
          <Sparkles size={15} strokeWidth={2.25} aria-hidden="true" />
          <span>
            Link “{nameMatch.name}” ({templateOf(nameMatch.template).label})?
          </span>
          <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => makePrimary(nameMatch)}>
            Link
          </button>
        </div>
      )}
      <InfoPicker
        options={options}
        value={null}
        placeholder={candidates === null ? (loadError ? "Could not load the articles" : "Loading articles…") : primary ? "Replace with another article…" : "Link an existing article…"}
        ariaLabel="Main article"
        collapsibleGroups
        disabled={candidates === null || busy}
        onChange={(id) => {
          const picked = candidates?.find((c) => c.id === id);
          if (picked) void makePrimary(picked);
        }}
      />
      {!primary && (
        <InfoPicker
          options={CREATE_OPTIONS}
          value={null}
          placeholder={`+ Create “${marker.name.trim() || PLACEHOLDER_NAME}” as a new…`}
          ariaLabel="Create a new article for this marker"
          disabled={busy}
          onChange={(template) => template && void createAndLink(template as ArticleTemplateKey)}
        />
      )}
      {primary && <p className="field-label marker-card-hint">A replaced article stays linked in the Articles tab.</p>}
      {suggestLook && <LookSuggestion template={suggestLook} marker={marker} onUpdate={onUpdate} onDismiss={() => setSuggestLook(null)} />}
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
