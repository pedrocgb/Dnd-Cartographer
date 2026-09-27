"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { dayLabel } from "@/components/calendars/evaluate";
import { loadWorldCalendars } from "@/components/calendars/profile-lookup";
import type { ClientCalendar } from "@/components/calendars/types";
import { sessionHref, sessionLabel, type BriefSession, type ClientCampaign } from "./types";

/**
 * "In sessions": game sessions that link this article, where it played (a
 * PC) or was given as loot. In-world dates use each campaign's calendar.
 * Hidden when there are none.
 */
export default function SessionBacklinks({ articleId }: { articleId: string }) {
  const [data, setData] = useState<{ sessions: BriefSession[]; campaigns: ClientCampaign[]; calendars: ClientCalendar[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const get = (url: string): Promise<{ sessions?: BriefSession[]; campaigns?: ClientCampaign[] }> => fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : {}));
    // Campaigns and calendars are only needed when some session mentions the article.
    get(`/api/sessions?articleId=${encodeURIComponent(articleId)}`)
      .then(async (s) => {
        const sessions = s.sessions ?? [];
        if (sessions.length === 0) return;
        const [c, world] = await Promise.all([get("/api/campaigns"), loadWorldCalendars()]);
        if (!cancelled) setData({ sessions, campaigns: c.campaigns ?? [], calendars: world?.calendars ?? [] });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  if (!data || data.sessions.length === 0) return null;
  const defOf = (campaignId: string) => {
    const calendarId = data.campaigns.find((c) => c.id === campaignId)?.calendarId;
    return data.calendars.find((c) => c.id === calendarId)?.definition ?? null;
  };

  return (
    <section className="article-card cal-backlinks" aria-label="In sessions">
      <header className="article-card-header">
        <span className="article-card-label">
          <ScrollText size={15} strokeWidth={2.25} />
          In sessions
        </span>
      </header>
      <ul>
        {data.sessions.map((s) => {
          const def = defOf(s.campaignId);
          return (
            <li key={s.id}>
              <Link className="politics-link-button" href={sessionHref(s)}>
                {sessionLabel(s)}
              </Link>
              <span>{s.campaignName}</span>
              {def && s.startDay !== null && <span className="cal-help">{dayLabel(def, s.startDay, { weekday: false })}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
