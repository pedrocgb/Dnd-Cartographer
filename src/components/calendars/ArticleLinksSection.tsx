"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Link2, X } from "lucide-react";
import InfoPicker from "@/components/articles/InfoPicker";
import { candidateOptions, loadCandidates, type Candidate } from "@/components/articles/candidates";
import { articleHref, isArticleTemplate } from "@/server/articles/templates";
import type { ArticleRef } from "./types";
import { Skeleton } from "@/components/Skeleton";
import { useT } from "@/i18n/useT";
import { activeT } from "@/i18n/active";

/** A card listing linked articles (each opens its article, each can be unlinked) with a searchable "Link an article…" picker. */
export default function ArticleLinksSection({ links, onChange, title, hint }: { links: ArticleRef[]; onChange: (links: ArticleRef[]) => void; title?: string; hint?: string }) {
  const t = useT("calendars");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadCandidates()
      .then((c) => !cancelled && setCandidates(c))
      .catch(() => !cancelled && setError(activeT("calendars")("entry.loadFailed")));
    return () => {
      cancelled = true;
    };
  }, []);
  const linked = useMemo(() => new Set(links.map((l) => l.articleId)), [links]);
  const find = (id: string) => candidates?.find((c) => c.id === id);

  return (
    <div className="cel-section">
      <header className="cel-section-head">
        <div>
          <h3>{title ?? t("views.linkedArticles")}</h3>
          {hint && <p className="cal-help">{hint}</p>}
        </div>
      </header>
      {links.length === 0 ? (
        <p className="cel-empty">{t("links.none")}</p>
      ) : (
        <ul className="cel-links">
          {links.map((l) => {
            const c = find(l.articleId);
            return (
              <li key={l.articleId} className="cel-link">
                <Link2 size={14} aria-hidden />
                {c && isArticleTemplate(c.template) ? (
                  <Link className="politics-link-button" href={articleHref(c.template, c.id)}>
                    {c.name}
                  </Link>
                ) : (
                  <span className="cal-removed">{candidates ? t("sidebar.removed") : <Skeleton className="skeleton-inline" width={110} />}</span>
                )}
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("links.unlink", { name: c?.name ?? t("links.article") })} onClick={() => onChange(links.filter((x) => x.articleId !== l.articleId))}>
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="cel-link-add">
        <InfoPicker
          options={candidateOptions(candidates ?? [], linked)}
          value={null}
          placeholder={candidates ? t("links.add") : t("entry.loadingArticles")}
          ariaLabel={t("links.addAria")}
          collapsibleGroups
          disabled={!candidates}
          onChange={(id) => {
            const c = id ? find(id) : null;
            if (c) onChange([...links, { template: c.template, articleId: c.id }]);
          }}
        />
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
