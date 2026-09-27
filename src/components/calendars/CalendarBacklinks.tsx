"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { describeRecurrence } from "@/server/calendars/recurrence";
import { dayLabel } from "./evaluate";
import { loadWorldCalendars } from "./profile-lookup";
import type { ClientEntry, WorldCalendars } from "./types";

/**
 * "On the calendar": the dated notes, events and direct links that point
 * at this article, labeled in the world's default calendar. Hidden when
 * there are none.
 */
export default function CalendarBacklinks({ articleId }: { articleId: string }) {
  const [data, setData] = useState<{ entries: ClientEntry[]; world: WorldCalendars } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // The calendars (a large payload) are only needed when the article has entries.
    fetch(`/api/calendar-entries?articleId=${encodeURIComponent(articleId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then(async (e: { entries?: ClientEntry[] }) => {
        const entries = e.entries ?? [];
        if (entries.length === 0) return;
        const world = await loadWorldCalendars();
        if (!cancelled && world) setData({ entries, world });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  if (!data || data.entries.length === 0) return null;
  const { world } = data;
  const calendar = world.calendars.find((c) => c.id === world.chronology.defaultCalendarId) ?? world.calendars.find((c) => !c.archived);
  if (!calendar) return null;
  const ctx = { calendar: (id: string) => world.calendars.find((c) => c.id === id)?.definition ?? null };

  return (
    <section className="article-card cal-backlinks" aria-label="On the calendar">
      <header className="article-card-header">
        <span className="article-card-label">
          <CalendarDays size={15} strokeWidth={2.25} />
          On the calendar
        </span>
      </header>
      <ul>
        {data.entries.map((e) => (
          <li key={e.id}>
            <Link className="politics-link-button" href={`/calendars?day=${e.worldDay}`}>
              {dayLabel(calendar.definition, e.worldDay)}
            </Link>
            <span>{e.kind === "link" ? "Linked to this day" : e.title || "Note"}</span>
            {e.recurrence.kind !== "none" && <span className="cal-help">{describeRecurrence(e.recurrence, ctx)}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
