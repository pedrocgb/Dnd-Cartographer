"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info, Plus, Trash2 } from "lucide-react";
import { api } from "@/components/calendars/api";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { ClientCampaign } from "@/components/sessions/types";
import { questHref } from "@/components/quests/href";
import { TIPS } from "@/server/writer/guides";
import {
  MICE_HINTS,
  MICE_LABELS,
  MICE_TYPES,
  THREAD_KIND_HINTS,
  THREAD_KIND_LABELS,
  THREAD_KINDS,
  THREAD_STATUS_LABELS,
  THREAD_STATUSES,
  type HealthWarning,
  type MiceType,
  type PlotThread,
  type ThreadKind,
  type ThreadStatus,
} from "@/server/writer/types";
import PlotGrid from "./PlotGrid";
import { upsert, type WriterData } from "./useWriterData";
import { useT } from "@/i18n/useT";

const SWATCHES = ["#47BFAB", "#9CC3F5", "#D29C53", "#E8735F", "#B48EE0", "#7AC77A", "#E8E3D5"];

/**
 * The Threads tab: every promise, setup and MICE thread with where it shows
 * up (the plot grid: threads × scenes), and what may have been forgotten
 * (unpaid promises, unfired setups, MICE threads out of order, quests short
 * of clues).
 */
export default function ThreadsView({
  campaign,
  data,
  update,
  guides,
  onOpenNode,
}: {
  campaign: ClientCampaign;
  data: WriterData;
  update: (fn: (d: WriterData) => WriterData) => void;
  guides: boolean;
  onOpenNode: (id: string) => void;
}) {
  const t = useT("writer");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ThreadKind>("promise");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const replace = (t: PlotThread) => update((d) => ({ ...d, threads: upsert(d.threads, t) }));

  async function create() {
    if (!name.trim()) return;
    const res = await api<{ thread: PlotThread }>("POST", `/api/campaigns/${campaign.id}/threads`, { name, kind });
    if (!res.ok) return setError(res.data.error ?? t("threads.couldNotAdd"));
    replace(res.data.thread);
    setName("");
    setError(null);
  }

  return (
    <div className="wr-threads">
      {guides && <p className="wr-tip">{TIPS.threads}</p>}
      <HealthPanel campaignId={campaign.id} data={data} onOpenNode={onOpenNode} onOpenThread={setEditing} />

      <section className="cv-block">
        <h3 className="cv-block-title">{t("threads.title", { n: data.threads.length })}</h3>
        <form
          className="wr-thread-new"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <input type="text" aria-label={t("threads.newName")} maxLength={160} value={name} placeholder={t("threads.namePlaceholder")} onChange={(e) => setName(e.target.value)} />
          <select aria-label={t("threads.newType")} value={kind} onChange={(e) => setKind(e.target.value as ThreadKind)}>
            {THREAD_KINDS.map((k) => (
              <option key={k} value={k}>
                {THREAD_KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-sm btn-primary" disabled={!name.trim()}>
            <Plus size={14} /> {t("threads.add")}
          </button>
        </form>
        {guides && <p className="cal-help">{THREAD_KIND_HINTS[kind]}</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <ul className="wr-thread-list">
          {data.threads.map((th) => (
            <ThreadRow key={th.id} thread={th} data={data} campaignId={campaign.id} open={editing === th.id} onToggle={() => setEditing(editing === th.id ? null : th.id)} onChanged={replace} onDeleted={(id) => update((d) => ({ ...d, threads: d.threads.filter((x) => x.id !== id), beats: d.beats.filter((b) => b.threadId !== id) }))} />
          ))}
        </ul>
      </section>

      {data.threads.length > 0 && <PlotGrid data={data} onBeatsChanged={(beats) => update((d) => ({ ...d, beats }))} onOpenNode={onOpenNode} />}
    </div>
  );
}

/** One thread: a summary line, and its fields when opened. */
function ThreadRow({ thread, data, campaignId, open, onToggle, onChanged, onDeleted }: { thread: PlotThread; data: WriterData; campaignId: string; open: boolean; onToggle: () => void; onChanged: (t: PlotThread) => void; onDeleted: (id: string) => void }) {
  const t = useT("writer");
  const tc = useT("common");
  const [summary, setSummary] = useState(thread.summary);
  const [threadName, setThreadName] = useState(thread.name);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const count = data.beats.filter((b) => b.threadId === thread.id).length;
  const quest = data.quests.find((q) => q.id === thread.questId) ?? null;

  async function save(patch: Partial<Pick<PlotThread, "name" | "kind" | "miceType" | "status" | "summary" | "color" | "questId">>) {
    const res = await api<{ thread: PlotThread }>("PATCH", `/api/threads/${thread.id}`, { ...patch, expectedVersion: thread.version });
    if (res.ok) {
      onChanged(res.data.thread);
      setError(null);
    } else setError(res.data.error ?? t("threads.couldNotSave"));
  }

  async function remove() {
    const res = await api("DELETE", `/api/threads/${thread.id}`);
    setConfirm(false);
    if (res.ok) onDeleted(thread.id);
    else setError(res.data.error ?? t("ui.couldNotDelete"));
  }

  return (
    <li className={open ? "wr-thread open" : "wr-thread"}>
      <button type="button" className="wr-thread-head" aria-expanded={open} onClick={onToggle}>
        <span className="wr-thread-swatch" style={thread.color ? { background: thread.color } : undefined} aria-hidden />
        <strong>{thread.name}</strong>
        <span className="cv-chip">{thread.kind === "mice" && thread.miceType ? t("threads.miceChip", { type: MICE_LABELS[thread.miceType] }) : THREAD_KIND_LABELS[thread.kind]}</span>
        <span className={`wr-thread-status wr-thread-status-${thread.status}`}>{THREAD_STATUS_LABELS[thread.status]}</span>
        <span className="cal-help">
          {t("threads.scenes", { count })}
        </span>
      </button>
      {open && (
        <div className="wr-thread-body">
          <div className="qs-general-grid">
            <label className="cal-field">
              <span className="field-label">{t("threads.name")}</span>
              <input type="text" maxLength={160} value={threadName} onChange={(e) => setThreadName(e.target.value)} onBlur={() => threadName.trim() && threadName !== thread.name && void save({ name: threadName })} />
            </label>
            <label className="cal-field">
              <span className="field-label">{t("threads.type")}</span>
              <select value={thread.kind} onChange={(e) => void save({ kind: e.target.value as ThreadKind })}>
                {THREAD_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {THREAD_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            {thread.kind === "mice" && (
              <label className="cal-field">
                <span className="field-label">{t("threads.miceType")}</span>
                <select value={thread.miceType ?? "inquiry"} onChange={(e) => void save({ miceType: e.target.value as MiceType })}>
                  {MICE_TYPES.map((m) => (
                    <option key={m} value={m}>
                      {MICE_LABELS[m]}
                    </option>
                  ))}
                </select>
                <span className="cal-help">{MICE_HINTS[thread.miceType ?? "inquiry"]}</span>
              </label>
            )}
            <label className="cal-field">
              <span className="field-label">{t("threads.status")}</span>
              <select value={thread.status} onChange={(e) => void save({ status: e.target.value as ThreadStatus })}>
                {THREAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {THREAD_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="cal-field">
              <span className="field-label">{t("threads.quest")}</span>
              <select value={thread.questId ?? ""} onChange={(e) => void save({ questId: e.target.value || null })}>
                <option value="">{t("threads.none")}</option>
                {data.quests.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title}
                  </option>
                ))}
              </select>
              {quest && (
                <a className="cal-help" href={questHref({ campaignId, id: quest.id })}>
                  {t("threads.openQuest")}
                </a>
              )}
            </label>
          </div>
          <div className="cal-field">
            <span className="field-label">{t("threads.color")}</span>
            <div className="entry-swatches">
              <button type="button" className={!thread.color ? "entry-swatch active qs-swatch-none" : "entry-swatch qs-swatch-none"} aria-label={t("ui.noColor")} aria-pressed={!thread.color} data-tooltip={t("ui.noColor")} onClick={() => void save({ color: null })} />
              {SWATCHES.map((s) => (
                <button key={s} type="button" className={s.toLowerCase() === thread.color ? "entry-swatch active" : "entry-swatch"} style={{ background: s }} aria-label={t("ui.colorN", { color: s })} aria-pressed={s.toLowerCase() === thread.color} onClick={() => void save({ color: s })} />
              ))}
            </div>
          </div>
          <label className="cal-field">
            <span className="field-label">{t("threads.about")}</span>
            <textarea rows={2} maxLength={4000} value={summary} placeholder={t("threads.aboutPlaceholder")} onChange={(e) => setSummary(e.target.value)} onBlur={() => summary !== thread.summary && void save({ summary })} />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirm(true)}>
              <Trash2 size={14} /> {t("threads.delete")}
            </button>
          </div>
          <ConfirmDialog open={confirm} danger title={t("threads.deleteTitle", { name: thread.name })} confirmLabel={tc("delete")} onConfirm={remove} onCancel={() => setConfirm(false)}>
            {t("threads.deleteBody")}
          </ConfirmDialog>
        </div>
      )}
    </li>
  );
}

/** What may have been lost track of, refreshed whenever threads, beats, the outline or quests change. */
function HealthPanel({ campaignId, data, onOpenNode, onOpenThread }: { campaignId: string; data: WriterData; onOpenNode: (id: string) => void; onOpenThread: (id: string) => void }) {
  const t = useT("writer");
  const [warnings, setWarnings] = useState<HealthWarning[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void api<{ warnings: HealthWarning[] }>("GET", `/api/campaigns/${campaignId}/writer-health`).then((res) => {
      if (!cancelled && res.ok) setWarnings(res.data.warnings);
    });
    return () => {
      cancelled = true;
    };
  }, [campaignId, data.threads, data.beats, data.nodes, data.quests, t]);

  if (!warnings) return null;
  if (warnings.length === 0) return <p className="wr-health-ok">{t("health.ok")}</p>;
  return (
    <section className="cv-block wr-health" aria-label={t("health.check")}>
      <h3 className="cv-block-title">{t("health.checkN", { n: warnings.length })}</h3>
      <ul>
        {warnings.map((w) => (
          <li key={w.key} className={`wr-health-${w.level}`}>
            {w.level === "warn" ? <AlertTriangle size={14} aria-hidden /> : <Info size={14} aria-hidden />}
            {w.target.kind === "quest" ? (
              <a href={questHref({ campaignId, id: w.target.id })}>{w.text}</a>
            ) : (
              <button type="button" className="btn-link" onClick={() => (w.target.kind === "thread" ? onOpenThread(w.target.id) : onOpenNode(w.target.id))}>
                {w.text}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
