"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AtSign } from "lucide-react";
import type { Backlink } from "@/server/mentions/store";

/** "Mentioned in": pages whose text @mentions this. Hidden when there are none. */
export default function MentionBacklinks({ targetId, variant = "card" }: { targetId: string; variant?: "card" | "plain" }) {
  const [list, setList] = useState<Backlink[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/mentions/backlinks?id=${encodeURIComponent(targetId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { backlinks: [] }))
      .then((d: { backlinks?: Backlink[] }) => !cancelled && setList(d.backlinks ?? []))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [targetId]);

  if (!list || list.length === 0) return null;
  const items = (
    <ul>
      {list.map((b) => (
        <li key={b.href} className="mention-backlink">
          <span className="cv-chip">{b.type}</span>
          <Link href={b.href}>{b.title}</Link>
        </li>
      ))}
    </ul>
  );
  if (variant === "plain") return <div className="mention-backlinks">{items}</div>;
  return (
    <section className="article-card cal-backlinks" aria-label="Mentioned in">
      <header className="article-card-header">
        <span className="article-card-label">
          <AtSign size={15} strokeWidth={2.25} />
          Mentioned in
        </span>
      </header>
      {items}
    </section>
  );
}
