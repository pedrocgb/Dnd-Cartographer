"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import type { QuestKind, QuestStatus } from "@/server/quests/types";
import { questHref } from "./href";
import { StatusChip } from "./parts";
import { useT } from "@/i18n/useT";

type BriefQuest = { id: string; campaignId: string; campaignName: string; title: string; status: QuestStatus; kind: QuestKind };

/** "In quests": quests that involve this article or were given by it. Hidden when there are none. */
export default function QuestBacklinks({ articleId }: { articleId: string }) {
  const t = useT("campaign");
  const [list, setList] = useState<BriefQuest[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/quests?articleId=${encodeURIComponent(articleId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { quests: [] }))
      .then((d: { quests?: BriefQuest[] }) => !cancelled && setList(d.quests ?? []))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  if (!list || list.length === 0) return null;
  const campaigns = new Set(list.map((q) => q.campaignId));
  return (
    <section className="article-card cal-backlinks" aria-label={t("quest.inQuests")}>
      <header className="article-card-header">
        <span className="article-card-label">
          <ScrollText size={15} strokeWidth={2.25} />
          {t("quest.inQuests")}
        </span>
      </header>
      <ul>
        {list.map((q) => (
          <li key={q.id} className="qs-backlink">
            <StatusChip status={q.status} />
            <Link href={questHref(q)}>{q.title}</Link>
            {campaigns.size > 1 && <span className="cal-help"> · {q.campaignName}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
