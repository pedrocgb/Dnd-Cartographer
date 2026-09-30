"use client";

import { useCallback, useEffect, useState } from "react";
import type { ArticleTemplateKey } from "@/server/articles/templates";
import { loadCandidates, type Candidate } from "@/components/articles/candidates";
import { invalidateMarkerPreview } from "@/components/MarkerHoverCard";

export interface MarkerArticleLink {
  id: string;
  template: ArticleTemplateKey;
  articleId: string;
  label: string;
  isPrimary: boolean;
  /** Null once the linked article was deleted. */
  name: string | null;
}

export interface MarkerArticleLinks {
  /** Primary first, then oldest first; null while loading. */
  links: MarkerArticleLink[] | null;
  primary: MarkerArticleLink | null;
  /** Links, resolving with an error message or null on success. */
  add: (article: Pick<Candidate, "template" | "id">, options?: { label?: string; primary?: boolean }) => Promise<string | null>;
  update: (linkId: string, patch: { label?: string; primary?: boolean }) => Promise<void>;
  remove: (linkId: string) => Promise<void>;
}

async function fetchLinks(markerId: string): Promise<MarkerArticleLink[]> {
  const r = await fetch(`/api/markers/${markerId}/articles`);
  const d = (await r.json()) as { links: MarkerArticleLink[] };
  return d.links;
}

/**
 * A marker's linked articles, shared by every part of the marker panel that
 * shows or edits them (the Subject card and the Articles tab), so a change
 * in one shows in the other. Each change refetches the list — the server
 * owns the ordering and which link is primary.
 */
export function useMarkerArticleLinks(markerId: string): MarkerArticleLinks {
  const [links, setLinks] = useState<MarkerArticleLink[] | null>(null);

  const reload = useCallback(async () => {
    invalidateMarkerPreview(markerId);
    const next = await fetchLinks(markerId).catch(() => null);
    if (next) setLinks(next);
  }, [markerId]);

  useEffect(() => {
    let cancelled = false;
    fetchLinks(markerId)
      .then((l) => !cancelled && setLinks(l))
      .catch(() => !cancelled && setLinks([]));
    return () => {
      cancelled = true;
    };
  }, [markerId]);

  const add: MarkerArticleLinks["add"] = async (article, options = {}) => {
    const res = await fetch(`/api/markers/${markerId}/articles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: article.template, articleId: article.id, label: options.label ?? "", primary: options.primary }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error ?? "Could not link the article.";
    await reload();
    return null;
  };

  const update: MarkerArticleLinks["update"] = async (linkId, patch) => {
    await fetch(`/api/markers/${markerId}/articles/${linkId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await reload();
  };

  const remove: MarkerArticleLinks["remove"] = async (linkId) => {
    await fetch(`/api/markers/${markerId}/articles/${linkId}`, { method: "DELETE" });
    await reload();
  };

  return { links, primary: links?.find((l) => l.isPrimary) ?? null, add, update, remove };
}

/** Every live article for a link picker, loaded (again) each time `enabled` turns on, so new articles show up. */
export function useArticleCandidates(enabled: boolean): { candidates: Candidate[] | null; error: boolean; refresh: () => void } {
  const [state, setState] = useState<{ candidates: Candidate[] | null; error: boolean }>({ candidates: null, error: false });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadCandidates()
      .then((c) => !cancelled && setState({ candidates: c, error: false }))
      .catch(() => !cancelled && setState({ candidates: null, error: true }));
    return () => {
      cancelled = true;
    };
  }, [enabled, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, refresh };
}
