"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/components/calendars/api";
import type { ClientCampaign, ClientSession } from "@/components/sessions/types";
import { sessionLabel } from "@/components/sessions/types";
import { TIPS } from "@/server/writer/guides";
import { STATUS_KIND_LABELS, STATUS_KINDS, type StatusEntry, type StatusKind } from "@/server/writer/types";

/**
 * The World status tab (the Alexandrian's campaign status document): what
 * changed in the world, grouped by session. The outline stays the plan;
 * this is what's true now.
 */
export default function StatusLog({ campaign, sessions, guides }: { campaign: ClientCampaign; sessions: ClientSession[]; guides: boolean }) {
  const [entries, setEntries] = useState<StatusEntry[] | null>(null);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<StatusKind>("world");
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api<{ entries: StatusEntry[] }>("GET", `/api/campaigns/${campaign.id}/status-log`).then((res) => {
      if (cancelled) return;
      if (res.ok) setEntries(res.data.entries);
      else setError(res.data.error ?? "Could not load the world status.");
    });
    return () => {
      cancelled = true;
    };
  }, [campaign.id]);

  async function add() {
    if (!text.trim()) return;
    const res = await api<{ entry: StatusEntry }>("POST", `/api/campaigns/${campaign.id}/status-log`, { text, kind, sessionId: sessionId || null });
    if (!res.ok) return setError(res.data.error ?? "Could not add the change.");
    setEntries((list) => [res.data.entry, ...(list ?? [])]);
    setText("");
    setError(null);
  }

  async function remove(id: string) {
    const res = await api("DELETE", `/api/status-log/${id}`);
    if (res.ok) setEntries((list) => (list ?? []).filter((e) => e.id !== id));
    else setError(res.data.error ?? "Could not delete it.");
  }

  const ordered = [...sessions].sort((a, b) => b.number - a.number);
  const groups = [...ordered.map((s) => ({ key: s.id, label: sessionLabel(s) })), { key: "", label: "Not tied to a session" }]
    .map((g) => ({ ...g, items: (entries ?? []).filter((e) => (e.sessionId ?? "") === g.key) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="wr-status">
      {guides && <p className="wr-tip">{TIPS.status}</p>}
      <form
        className="wr-status-new"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <select aria-label="What kind of change" value={kind} onChange={(e) => setKind(e.target.value as StatusKind)}>
          {STATUS_KINDS.map((k) => (
            <option key={k} value={k}>
              {STATUS_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <input type="text" aria-label="What changed" maxLength={4000} value={text} placeholder="The Red Hand now controls the docks." onChange={(e) => setText(e.target.value)} />
        <select aria-label="After which session" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
          <option value="">No session</option>
          {ordered.map((s) => (
            <option key={s.id} value={s.id}>
              {sessionLabel(s)}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-sm btn-primary" disabled={!text.trim()}>
          <Plus size={14} /> Add
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {entries && entries.length === 0 && <p className="cal-help">Nothing recorded yet. Add changes here, or with &quot;What happened?&quot; after a session.</p>}
      {groups.map((g) => (
        <section key={g.key || "none"} className="cv-block">
          <h3 className="cv-block-title">{g.label}</h3>
          <ul className="wr-status-list">
            {g.items.map((e) => (
              <li key={e.id}>
                <span className={`cv-chip wr-status-kind-${e.kind}`}>{STATUS_KIND_LABELS[e.kind]}</span>
                <span className="wr-status-text">{e.text}</span>
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Delete this change" data-tooltip="Delete" onClick={() => void remove(e.id)}>
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
