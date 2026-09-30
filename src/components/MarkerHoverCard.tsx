"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/dom";
import { templateOf } from "@/components/articles/templates";
import type { ArticleTemplateKey } from "@/server/articles/templates";

export interface MarkerPreview {
  article: {
    template: ArticleTemplateKey;
    id: string;
    name: string;
    portraitUrl: string | null;
    excerpt: string;
    label: string;
  } | null;
  extraCount: number;
  /** The marker's own description excerpt, when it has no primary article. */
  excerpt: string;
}

const VIEWPORT_PADDING = 8;

// One fetch per marker per page view; dropped whenever its links or description change.
const cache = new Map<string, Promise<MarkerPreview | null>>();

/** Forget a marker's cached preview, so the next hover refetches it. */
export function invalidateMarkerPreview(markerId: string) {
  cache.delete(markerId);
}

export function loadPreview(markerId: string): Promise<MarkerPreview | null> {
  let pending = cache.get(markerId);
  if (!pending) {
    pending = fetch(`/api/markers/${markerId}/preview`)
      .then((r) => (r.ok ? (r.json() as Promise<MarkerPreview>) : null))
      .catch(() => null);
    cache.set(markerId, pending);
    // A failed load is retried on the next hover rather than cached.
    pending.then((p) => p === null && cache.delete(markerId));
  }
  return pending;
}

/**
 * The map's hover card for a marker: its primary article's image, template,
 * name, relationship and first lines, or the marker's own description when
 * it has no article. Portaled and positioned with floating-ui beside the
 * marker (flipping to stay on screen, following it while the map moves).
 * Shows nothing when there is nothing beyond the name to show — the name
 * label already covers that. Never takes pointer events, so it can't get in
 * the way of a click or drag on the marker.
 */
export default function MarkerHoverCard({ markerId, anchor }: { markerId: string; anchor: HTMLElement }) {
  const [preview, setPreview] = useState<{ id: string; data: MarkerPreview | null } | null>(null);
  const card = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPreview(markerId).then((data) => !cancelled && setPreview({ id: markerId, data }));
    return () => {
      cancelled = true;
    };
  }, [markerId]);

  const data = preview?.id === markerId ? preview.data : null;
  const hasContent = !!data && (data.article !== null || data.excerpt !== "");

  useEffect(() => {
    const el = card.current;
    if (!el || !hasContent) return;
    return autoUpdate(
      anchor,
      el,
      () => {
        computePosition(anchor, el, {
          placement: "right",
          strategy: "fixed",
          middleware: [offset(12), flip({ padding: VIEWPORT_PADDING }), shift({ padding: VIEWPORT_PADDING })],
        }).then(({ x, y }) => {
          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
          el.style.opacity = "1";
        });
      },
      { animationFrame: true }
    );
  }, [anchor, hasContent]);

  if (!hasContent) return null;
  const article = data.article;
  const template = article ? templateOf(article.template) : null;

  return createPortal(
    <div ref={card} className="marker-hover-card" role="tooltip">
      {article ? (
        <>
          <div className="marker-hover-card-head">
            {article.portraitUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local API route, not a static asset
              <img className="marker-hover-card-portrait" src={article.portraitUrl} alt="" />
            ) : (
              template && (
                <span className="marker-hover-card-portrait marker-hover-card-portrait-empty">
                  <template.Icon size={20} strokeWidth={2} aria-hidden="true" />
                </span>
              )
            )}
            <div className="marker-hover-card-titles">
              {template && (
                <span className="marker-hover-card-template">
                  <template.Icon size={12} strokeWidth={2.25} aria-hidden="true" />
                  {template.label}
                </span>
              )}
              <strong className="marker-hover-card-name">{article.name}</strong>
              {article.label && <span className="marker-hover-card-role">{article.label}</span>}
            </div>
          </div>
          {article.excerpt && <p className="marker-hover-card-excerpt">{article.excerpt}</p>}
          {data.extraCount > 0 && (
            <span className="marker-hover-card-more">
              +{data.extraCount} more linked {data.extraCount === 1 ? "article" : "articles"}
            </span>
          )}
        </>
      ) : (
        <p className="marker-hover-card-excerpt">{data.excerpt}</p>
      )}
    </div>,
    document.body
  );
}
