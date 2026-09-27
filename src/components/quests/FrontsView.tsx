"use client";

import { useState } from "react";
import { Flame, Pencil, Plus, RotateCcw, Skull, StepForward } from "lucide-react";
import { api } from "@/components/calendars/api";
import { advanceFront, frontAction, setFrontClock } from "@/server/quests/logic";
import { FRONT_KIND_LABELS, FRONT_STATUS_LABELS, type FrontData, type QuestData } from "@/server/quests/types";
import ProgressClock from "./ProgressClock";
import { StatusChip } from "./parts";

/**
 * The campaign's fronts: each threat with its clock, grim portents
 * (tickable), impending doom and the quests under it. Advance ticks the
 * clock and marks the next portent as happened.
 */
export default function FrontsView({
  fronts,
  quests,
  onChanged,
  onEdit,
  onNew,
  onOpenQuest,
}: {
  fronts: FrontData[];
  quests: QuestData[];
  onChanged: (f: FrontData) => void;
  onEdit: (id: string) => void;
  onNew: () => void;
  onOpenQuest: (id: string) => void;
}) {
  if (fronts.length === 0) {
    return (
      <div className="ss-empty">
        <p className="cal-help">No fronts yet. A front is a threat moving behind the scenes: a villain, a cult, a war. Give it grim portents (what it does next if nobody stops it) and an impending doom, then group its quests under it.</p>
        <button type="button" className="btn btn-sm btn-primary" onClick={onNew}>
          <Plus size={14} /> New front
        </button>
      </div>
    );
  }
  const loose = quests.filter((q) => !q.frontId).length;
  return (
    <>
      <ul className="qs-fronts">
        {fronts.map((f) => (
          <li key={f.id}>
            <FrontCard front={f} quests={quests.filter((q) => q.frontId === f.id)} onChanged={onChanged} onEdit={() => onEdit(f.id)} onOpenQuest={onOpenQuest} />
          </li>
        ))}
      </ul>
      {loose > 0 && <p className="cal-help qs-fronts-loose">{loose} quest{loose === 1 ? " isn't" : "s aren't"} under any front. Pick one in a quest&apos;s Clock &amp; front tab.</p>}
    </>
  );
}

function FrontCard({ front, quests, onChanged, onEdit, onOpenQuest }: { front: FrontData; quests: QuestData[]; onChanged: (f: FrontData) => void; onEdit: () => void; onOpenQuest: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(fields: Partial<FrontData>, failure: string) {
    setBusy(true);
    setError(null);
    const res = await api<{ front: FrontData }>("PATCH", `/api/fronts/${front.id}`, { expectedVersion: front.version, ...fields });
    setBusy(false);
    if (res.ok) onChanged(res.data.front);
    else setError(res.data.error ?? failure);
  }

  const next = front.portents.find((p) => !p.happened) ?? null;
  const clockFull = !!front.clock && front.clock.filled >= front.clock.segments;
  const perPortent = front.clockPerPortent && !!front.clock;
  const action = front.status === "active" ? frontAction(front) : null;
  const advance = () => {
    const { clock, portents } = advanceFront(front);
    void patch({ clock, portents }, "Could not advance the front.");
  };
  const setClock = (filled: number) => {
    const { clock, portents } = setFrontClock(front, filled);
    void patch({ clock, portents }, "Could not tick the clock.");
  };
  // With a clock per portent a full clock is only a step; the doom comes once every portent has.
  const allHappened = front.portents.length > 0 && !next;
  const doomNear = front.status === "active" && (perPortent ? allHappened && clockFull : clockFull || allHappened);
  const advanceHint = action === "nextPortent" ? `Start the clock over for: ${next?.text}` : perPortent ? `Tick the clock; when it fills: ${next?.text ?? "the doom"}` : next ? `Next: ${next.text}` : "Tick the clock";

  return (
    <article className={`qs-front qs-front-${front.status}`} style={front.color ? { ["--qs-front" as string]: front.color } : undefined}>
      <header className="qs-front-head">
        <Flame size={18} aria-hidden className="qs-front-icon" />
        <div className="qs-front-title">
          <h3>{front.name}</h3>
          <span className="cal-help">
            {FRONT_KIND_LABELS[front.kind]} · {FRONT_STATUS_LABELS[front.status]}
          </span>
        </div>
        <button type="button" className={action === "nextPortent" ? "btn btn-sm btn-primary" : "btn btn-sm"} disabled={busy || !action} onClick={advance} data-tooltip={advanceHint}>
          {action === "nextPortent" ? (
            <>
              <RotateCcw size={14} /> Next portent
            </>
          ) : (
            <>
              <StepForward size={14} /> Advance
            </>
          )}
        </button>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Edit ${front.name}`} data-tooltip="Edit" onClick={onEdit}>
          <Pencil size={14} />
        </button>
      </header>
      {front.threat && <p className="qs-front-threat">{front.threat}</p>}
      <div className="qs-front-body">
        {front.clock && <ProgressClock clock={front.clock} size={72} disabled={busy} onSet={setClock} />}
        <div className="qs-front-portents">
          <span className="field-label">Grim portents</span>
          {perPortent && front.clock && <span className="cal-help">The clock fills once per portent ({front.clock.segments} segments each).</span>}
          {front.portents.length === 0 ? (
            <p className="cal-help">None yet. Add them with Edit.</p>
          ) : (
            <ol>
              {front.portents.map((p) => (
                <li key={p.id} className={p === next ? "next" : undefined}>
                  <label className={p.happened ? "cal-check ss-resolved" : "cal-check"}>
                    <input type="checkbox" checked={p.happened} disabled={busy} onChange={(e) => void patch({ portents: front.portents.map((x) => (x.id === p.id ? { ...x, happened: e.target.checked } : x)) }, "Could not update the portent.")} /> {p.text}
                  </label>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      {front.doom && (
        <p className={doomNear ? "qs-front-doom near" : "qs-front-doom"}>
          <Skull size={14} aria-hidden /> <strong>Impending doom:</strong> {front.doom}
        </p>
      )}
      {doomNear && <p className="cal-help">Every portent has come to pass or the clock is full: the doom is at hand. Set the front to &quot;{FRONT_STATUS_LABELS.doom}&quot; or &quot;{FRONT_STATUS_LABELS.averted}&quot; in Edit.</p>}
      <div className="qs-front-quests">
        <span className="field-label">Quests ({quests.length})</span>
        {quests.length === 0 ? (
          <p className="cal-help">No quest under this front yet.</p>
        ) : (
          <ul>
            {quests.map((q) => (
              <li key={q.id}>
                <button type="button" className="qs-sub-link" onClick={() => onOpenQuest(q.id)}>
                  <StatusChip status={q.status} /> {q.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
