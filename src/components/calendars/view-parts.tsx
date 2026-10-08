"use client";

import { formatInteger } from "@/server/settings/number-format";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Link2, type LucideIcon } from "lucide-react";
import { loadCandidates, type Candidate } from "@/components/articles/candidates";
import { articleHref, isArticleTemplate } from "@/server/articles/templates";
import type { ArticleRef } from "./types";
import { Skeleton } from "@/components/Skeleton";
import { useT } from "@/i18n/useT";
import { activeT } from "@/i18n/active";

/** Shared pieces of the read-only views (celestial objects, seasons). */

/** "today", "in 3 days", "12 days ago". */
export function relative(day: number, from: number): string {
  const t = activeT("calendars");
  const n = day - from;
  if (n === 0) return t("rel.today");
  if (n === 1) return t("rel.tomorrow");
  if (n === -1) return t("rel.yesterday");
  return n > 0 ? t("rel.in", { count: n, n: formatInteger(n) }) : t("rel.ago", { count: -n, n: formatInteger(-n) });
}

export function Block({ title, Icon, children }: { title: string; Icon: LucideIcon; children: React.ReactNode }) {
  return (
    <section className="cv-block">
      <h3 className="cv-block-title">
        <Icon size={14} aria-hidden /> {title}
      </h3>
      {children}
    </section>
  );
}

/** Linked articles as chips that open each article (names loaded on demand). */
export function LinkedArticles({ links }: { links: ArticleRef[] }) {
  const t = useT("calendars");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  useEffect(() => {
    if (links.length === 0) return;
    let cancelled = false;
    loadCandidates()
      .then((c) => !cancelled && setCandidates(c))
      .catch(() => !cancelled && setCandidates([]));
    return () => {
      cancelled = true;
    };
  }, [links.length]);
  return (
    <Block title={t("views.linkedArticles")} Icon={Link2}>
      {links.length === 0 ? (
        <p className="cal-help">{t("views.noLinked")}</p>
      ) : (
        <ul className="cv-articles">
          {links.map((l) => {
            const c = candidates?.find((x) => x.id === l.articleId);
            return (
              <li key={l.articleId}>
                {c && isArticleTemplate(c.template) ? (
                  <Link className="cv-article" href={articleHref(c.template, c.id)}>
                    <Link2 size={13} aria-hidden /> {c.name}
                  </Link>
                ) : (
                  <span className="cv-article cal-removed">{candidates ? "(removed)" : <Skeleton className="skeleton-inline" width={110} />}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Block>
  );
}
