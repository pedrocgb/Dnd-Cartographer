"use client";

import { useState } from "react";
import { api } from "@/components/calendars/api";
import { readingOrder } from "@/server/writer/logic";
import { BEAT_ROLE_LABELS, BEAT_ROLES, type BeatRole, type PlotThread, type ThreadBeat } from "@/server/writer/types";
import type { WriterData } from "./useWriterData";
import { useT } from "@/i18n/useT";

const ROLE_MARK: Record<BeatRole, string> = { setup: "●", progress: "◐", payoff: "★" };

/** The next role when a cell is clicked: empty, then each role, then empty again. */
const nextRole = (role: BeatRole | null): BeatRole | null => (role === null ? BEAT_ROLES[0] : (BEAT_ROLES[BEAT_ROLES.indexOf(role) + 1] ?? null));

/**
 * The plot grid (Plottr / J.K. Rowling style): threads as rows, scenes as
 * columns in story order, grouped by chapter. Click a cell to cycle what
 * the thread does there: set up, progress, pay off, nothing.
 */
export default function PlotGrid({ data, onBeatsChanged, onOpenNode }: { data: WriterData; onBeatsChanged: (beats: ThreadBeat[]) => void; onOpenNode: (id: string) => void }) {
  const t = useT("writer");
  const [error, setError] = useState<string | null>(null);
  const scenes = readingOrder(data.nodes).filter((n) => n.kind === "scene");
  const chapterOf = (parentId: string | null) => data.nodes.find((n) => n.id === parentId) ?? null;

  async function cycle(thread: PlotThread, nodeId: string) {
    const current = data.beats.find((b) => b.threadId === thread.id && b.nodeId === nodeId) ?? null;
    const role = nextRole(current?.role ?? null);
    const url = `/api/threads/${thread.id}/beats/${nodeId}`;
    const res = role ? await api<{ beat: ThreadBeat }>("PUT", url, { role }) : await api("DELETE", url);
    if (!res.ok) return setError(res.data.error ?? t("grid.couldNotSave"));
    setError(null);
    const rest = data.beats.filter((b) => b !== current);
    onBeatsChanged(role ? [...rest, (res.data as { beat: ThreadBeat }).beat] : rest);
  }

  if (scenes.length === 0) return <p className="cal-help">{t("grid.empty")}</p>;
  // Chapter header cells: one per run of scenes in the same chapter.
  const groups: { chapterId: string | null; span: number }[] = [];
  for (const s of scenes) {
    const last = groups.at(-1);
    if (last && last.chapterId === s.parentId) last.span += 1;
    else groups.push({ chapterId: s.parentId, span: 1 });
  }

  return (
    <section className="cv-block wr-grid-block" aria-label={t("grid.title")}>
      <h3 className="cv-block-title">{t("grid.title")}</h3>
      <p className="cal-help">
        {t("grid.help", { roles: BEAT_ROLES.map((r) => `${ROLE_MARK[r]} ${BEAT_ROLE_LABELS.promise[r].toLowerCase()}`).join(", ") })}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="wr-grid-scroll">
        <table className="wr-grid">
          <thead>
            <tr>
              <th scope="col" className="wr-grid-corner" rowSpan={2}>
                {t("grid.thread")}
              </th>
              {groups.map((g, i) => (
                <th key={`${g.chapterId}-${i}`} scope="colgroup" colSpan={g.span} className="wr-grid-chapter">
                  {chapterOf(g.chapterId)?.title ?? ""}
                </th>
              ))}
            </tr>
            <tr>
              {scenes.map((s) => (
                <th key={s.id} scope="col" className="wr-grid-scene">
                  <button type="button" className="btn-link" data-tooltip={s.synopsis || s.title} onClick={() => onOpenNode(s.id)}>
                    {s.title}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.threads.map((th) => (
              <tr key={th.id}>
                <th scope="row" className="wr-grid-thread">
                  <span className="wr-thread-swatch" style={th.color ? { background: th.color } : undefined} aria-hidden /> {th.name}
                </th>
                {scenes.map((s) => {
                  const beat = data.beats.find((b) => b.threadId === th.id && b.nodeId === s.id);
                  const label = beat ? BEAT_ROLE_LABELS[th.kind][beat.role] : t("grid.notHere");
                  return (
                    <td key={s.id}>
                      <button type="button" className={beat ? `wr-cell wr-cell-${beat.role}` : "wr-cell"} style={beat && th.color ? { color: th.color } : undefined} aria-label={t("grid.cell", { thread: th.name, scene: s.title, role: label })} data-tooltip={label} onClick={() => void cycle(th, s.id)}>
                        {beat ? ROLE_MARK[beat.role] : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
