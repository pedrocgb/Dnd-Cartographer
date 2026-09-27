"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Hourglass, Link2 } from "lucide-react";
import { dayLabel } from "@/components/calendars/evaluate";
import type { CalendarDefinition } from "@/server/calendars/engine";
import { loadCandidates, type Candidate } from "@/components/articles/candidates";
import { Skeleton } from "@/components/Skeleton";
import { articleHref, isArticleTemplate } from "@/server/articles/templates";
import { daysToDeadline, questProgress } from "@/server/quests/logic";
import { isClosed, QUEST_KIND_LABELS, QUEST_STATUS_LABELS, type ArticleRef, type Objective, type QuestData, type QuestKind, type QuestStatus } from "@/server/quests/types";

/** Every article, loaded once per mount (names for givers and involved articles); null while loading. */
export function useCandidates(enabled = true): Candidate[] | null {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadCandidates()
      .then((c) => !cancelled && setCandidates(c))
      .catch(() => !cancelled && setCandidates([]));
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return candidates;
}

export function StatusChip({ status }: { status: QuestStatus }) {
  return <span className={`qs-status qs-status-${status}`}>{QUEST_STATUS_LABELS[status]}</span>;
}

export function KindChip({ kind }: { kind: QuestKind }) {
  return <span className={`qs-kind qs-kind-${kind}`}>{QUEST_KIND_LABELS[kind]}</span>;
}

/** Required objectives done, as a thin bar with "2/5"; nothing when the quest has none. */
export function Progress({ objectives }: { objectives: readonly Objective[] }) {
  const { done, total } = questProgress(objectives);
  if (total === 0) return null;
  return (
    <span className="qs-progress" data-tooltip={`${done} of ${total} objectives done`}>
      <span className="qs-progress-bar" aria-hidden>
        <span style={{ width: `${Math.round((done / total) * 100)}%` }} />
      </span>
      <span className="qs-progress-text">
        {done}/{total}
      </span>
    </span>
  );
}

/** A linked article's name, opening its page; "(removed)" when it's gone, a skeleton while names load. */
export function ArticleName({ link, candidates }: { link: ArticleRef; candidates: Candidate[] | null }) {
  const c = candidates?.find((x) => x.id === link.articleId);
  if (!candidates) return <Skeleton className="skeleton-inline" width={90} />;
  if (!c || !isArticleTemplate(c.template)) return <span className="cal-removed">(removed)</span>;
  return (
    <Link className="politics-link-button" href={articleHref(c.template, c.id)}>
      <Link2 size={12} aria-hidden /> {c.name}
    </Link>
  );
}

export const nameOf = (link: ArticleRef | null, candidates: Candidate[] | null) => (link ? (candidates?.find((c) => c.id === link.articleId)?.name ?? null) : null);

/** "Due in 3 days", "Due today", "2 days overdue" (open quests), or the deadline's date once closed; nothing without one. */
export function DeadlineChip({ quest, def, today }: { quest: Pick<QuestData, "deadlineDay" | "status">; def: CalendarDefinition | null; today: number | null }) {
  if (quest.deadlineDay === null) return null;
  const date = def ? dayLabel(def, quest.deadlineDay, { weekday: false }) : `day ${quest.deadlineDay}`;
  const left = today === null ? null : daysToDeadline(quest, today);
  const open = !isClosed(quest.status);
  const text = !open || left === null ? `Due ${date}` : left === 0 ? "Due today" : left > 0 ? `Due in ${left} day${left === 1 ? "" : "s"}` : `${-left} day${left === -1 ? "" : "s"} overdue`;
  const tone = open && left !== null ? (left < 0 ? "late" : left <= 3 ? "soon" : "") : "";
  return (
    <span className={["qs-deadline", tone].filter(Boolean).join(" ")} data-tooltip={`Deadline: ${date}`}>
      <Hourglass size={11} aria-hidden /> {text}
    </span>
  );
}
