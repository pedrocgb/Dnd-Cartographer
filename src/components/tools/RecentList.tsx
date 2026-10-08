"use client";

import { History } from "lucide-react";
import { HISTORY_MAX, HISTORY_TTL_MS } from "@/lib/tool-history";
import { useT } from "@/i18n/useT";

export interface RecentItem {
  id: string;
  createdAt: number;
  title: string;
  meta: string;
  /** Shown after the meta, e.g. a badge. */
  extra?: React.ReactNode;
}

const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" });
const TTL_DAYS = Math.round(HISTORY_TTL_MS / (24 * 60 * 60 * 1000));

/** An Advanced Tool's recent results (see useToolHistory); clicking one reopens it. */
export default function RecentList({ title, noun, items, onOpen }: { title: string; noun: string; items: RecentItem[]; onOpen: (id: string) => void }) {
  const t = useT("tools");
  return (
    <section className="settings-card">
      <div className="settings-card-head">
        <h2 className="tool-card-title">
          <History size={16} strokeWidth={2.25} aria-hidden />
          {title}
        </h2>
        <p>{t("recent.about", { max: HISTORY_MAX, noun, days: TTL_DAYS })}</p>
      </div>
      <div className="settings-card-body">
        {items.length === 0 ? (
          <p className="tool-empty">{t("recent.empty", { noun })}</p>
        ) : (
          <ul className="tool-history">
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" className="tool-history-item" onClick={() => onOpen(item.id)}>
                  <span className="tool-history-name">{item.title}</span>
                  <span className="tool-history-meta">{item.meta}</span>
                  {item.extra}
                  <time className="tool-history-time" dateTime={new Date(item.createdAt).toISOString()}>
                    {timeFormat.format(item.createdAt)}
                  </time>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
