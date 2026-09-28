"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import Modal from "@/components/Modal";
import { api } from "@/components/calendars/api";
import type { ClientSession } from "@/components/sessions/types";
import { sessionLabel } from "@/components/sessions/types";
import { TIPS } from "@/server/writer/guides";
import { REVIEW_OUTCOME_LABELS, REVIEW_OUTCOMES, STATUS_KIND_LABELS, STATUS_KINDS, type OutlineNode, type ReviewOutcome, type StatusKind } from "@/server/writer/types";

export interface ReviewResult {
  sessions: ClientSession[];
  nodes: OutlineNode[];
  createdNext: boolean;
}

type Change = { kind: StatusKind; text: string };

/**
 * "What happened?" after a session: each planned scene played, changed
 * (and how), not reached (it moves to the next session) or cut; which
 * secrets came out (the rest carry on); and what changed in the world.
 */
export default function SessionReviewDialog({ session, scenes, guides, onDone, onClose }: { session: ClientSession; scenes: OutlineNode[]; guides: boolean; onDone: (r: ReviewResult) => void; onClose: () => void }) {
  const [outcomes, setOutcomes] = useState<Record<string, { outcome: ReviewOutcome; changeNote: string }>>(() =>
    Object.fromEntries(scenes.map((n) => [n.id, { outcome: n.status === "changed" || n.status === "played" ? n.status : ("played" as ReviewOutcome), changeNote: n.changeNote }]))
  );
  const [revealed, setRevealed] = useState<Record<string, boolean>>(() => Object.fromEntries(session.prep.secrets.map((s) => [s.id, s.state === "revealed"])));
  const [changes, setChanges] = useState<Change[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    const res = await api<ReviewResult>("POST", `/api/sessions/${session.id}/review`, {
      scenes: scenes.map((n) => ({ id: n.id, ...outcomes[n.id] })),
      secrets: revealed,
      entries: changes.filter((c) => c.text.trim()),
    });
    setSaving(false);
    if (res.ok) onDone(res.data);
    else setError(res.data.error ?? "Could not save the review.");
  }

  const setOutcome = (id: string, patch: Partial<{ outcome: ReviewOutcome; changeNote: string }>) => setOutcomes((o) => ({ ...o, [id]: { ...o[id], ...patch } }));
  const carried = scenes.filter((n) => outcomes[n.id]?.outcome === "later").length + session.prep.secrets.filter((s) => !revealed[s.id]).length;

  return (
    <Modal open onClose={onClose} title={`What happened in ${sessionLabel(session)}?`} size="wide">
      <div className="cel-editor">
        <div className="cel-body">
          {guides && <p className="wr-tip">{TIPS.review}</p>}
          <section className="cel-section">
            <h3>Scenes</h3>
            {scenes.length === 0 && <p className="cal-help">No scenes were planned for this session.</p>}
            {scenes.map((n) => (
              <div key={n.id} className="wr-review-scene">
                <strong>{n.title}</strong>
                <div className="wr-segmented" role="radiogroup" aria-label={`What happened to ${n.title}`}>
                  {REVIEW_OUTCOMES.map((o) => (
                    <label key={o} className={outcomes[n.id]?.outcome === o ? "active" : undefined}>
                      <input type="radio" name={`outcome-${n.id}`} checked={outcomes[n.id]?.outcome === o} onChange={() => setOutcome(n.id, { outcome: o })} />
                      {REVIEW_OUTCOME_LABELS[o]}
                    </label>
                  ))}
                </div>
                {outcomes[n.id]?.outcome === "changed" && (
                  <textarea rows={2} maxLength={4000} aria-label={`How ${n.title} changed`} value={outcomes[n.id].changeNote} placeholder="What happened instead" onChange={(e) => setOutcome(n.id, { changeNote: e.target.value })} />
                )}
              </div>
            ))}
          </section>

          {session.prep.secrets.length > 0 && (
            <section className="cel-section">
              <h3>Secrets that came out</h3>
              <ul className="wr-checklist">
                {session.prep.secrets.map((s) => (
                  <li key={s.id}>
                    <label className="cal-check">
                      <input type="checkbox" checked={revealed[s.id] === true} onChange={(e) => setRevealed((r) => ({ ...r, [s.id]: e.target.checked }))} /> {s.text}
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="cel-section">
            <h3>What changed in the world</h3>
            {guides && <p className="cal-help">{TIPS.status}</p>}
            {changes.map((c, i) => (
              <div key={i} className="ss-line">
                <select aria-label={`Change ${i + 1} type`} value={c.kind} onChange={(e) => setChanges((list) => list.map((x, j) => (j === i ? { ...x, kind: e.target.value as StatusKind } : x)))}>
                  {STATUS_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {STATUS_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <input type="text" aria-label={`Change ${i + 1}`} maxLength={4000} value={c.text} placeholder="The baron knows the party freed his prisoners." onChange={(e) => setChanges((list) => list.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove change ${i + 1}`} data-tooltip="Remove" onClick={() => setChanges((list) => list.filter((_, j) => j !== i))}>
                  <X size={14} />
                </button>
              </div>
            ))}
            <div>
              <button type="button" className="btn btn-sm" disabled={changes.length >= 50} onClick={() => setChanges((list) => [...list, { kind: "world", text: "" }])}>
                <Plus size={14} /> Add a change
              </button>
            </div>
          </section>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="cel-footer">
          {carried > 0 && <span className="cal-help">{carried} item{carried === 1 ? "" : "s"} will move to the next session.</span>}
          <button type="button" className="btn btn-sm" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => void submit()}>
            {saving ? "Saving…" : "Save review"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
