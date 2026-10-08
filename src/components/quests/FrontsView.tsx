"use client";

import { useState } from "react";
import { Flame, Pencil, Plus, RotateCcw, Skull, StepForward } from "lucide-react";
import { api } from "@/components/calendars/api";
import { advanceFront, frontAction, setFrontClock } from "@/server/quests/logic";
import { FRONT_KIND_LABELS, FRONT_STATUS_LABELS, type FrontData, type QuestData } from "@/server/quests/types";
import ProgressClock from "./ProgressClock";
import { StatusChip } from "./parts";
import { useT } from "@/i18n/useT";

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
  const t = useT("campaign");
  if (fronts.length === 0) {
    return (
      <div className="ss-empty">
        <p className="cal-help">{t("fronts.empty")}</p>
        <button type="button" className="btn btn-sm btn-primary" onClick={onNew}>
          <Plus size={14} /> {t("fronts.new")}
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
      {loose > 0 && <p className="cal-help qs-fronts-loose">{t("fronts.loose", { count: loose, n: loose })}</p>}
    </>
  );
}

function FrontCard({ front, quests, onChanged, onEdit, onOpenQuest }: { front: FrontData; quests: QuestData[]; onChanged: (f: FrontData) => void; onEdit: () => void; onOpenQuest: (id: string) => void }) {
  const t = useT("campaign");
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
    void patch({ clock, portents }, t("fronts.couldNotAdvance"));
  };
  const setClock = (filled: number) => {
    const { clock, portents } = setFrontClock(front, filled);
    void patch({ clock, portents }, t("fronts.couldNotTick"));
  };
  // With a clock per portent a full clock is only a step; the doom comes once every portent has.
  const allHappened = front.portents.length > 0 && !next;
  const doomNear = front.status === "active" && (perPortent ? allHappened && clockFull : clockFull || allHappened);
  const advanceHint =
    action === "nextPortent" ? t("fronts.hintNextPortent", { portent: next?.text ?? "" }) : perPortent ? t("fronts.hintTick", { portent: next?.text ?? t("fronts.theDoom") }) : next ? t("fronts.hintNext", { portent: next.text }) : t("fronts.hintTickOnly");

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
              <RotateCcw size={14} /> {t("fronts.nextPortent")}
            </>
          ) : (
            <>
              <StepForward size={14} /> {t("fronts.advance")}
            </>
          )}
        </button>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("quest.editNamed", { name: front.name })} data-tooltip={t("fronts.edit")} onClick={onEdit}>
          <Pencil size={14} />
        </button>
      </header>
      {front.threat && <p className="qs-front-threat">{front.threat}</p>}
      <div className="qs-front-body">
        {front.clock && <ProgressClock clock={front.clock} size={72} disabled={busy} onSet={setClock} />}
        <div className="qs-front-portents">
          <span className="field-label">{t("fronts.grimPortents")}</span>
          {perPortent && front.clock && <span className="cal-help">{t("fronts.perPortentNote", { segments: front.clock.segments })}</span>}
          {front.portents.length === 0 ? (
            <p className="cal-help">{t("fronts.noPortents")}</p>
          ) : (
            <ol>
              {front.portents.map((p) => (
                <li key={p.id} className={p === next ? "next" : undefined}>
                  <label className={p.happened ? "cal-check ss-resolved" : "cal-check"}>
                    <input type="checkbox" checked={p.happened} disabled={busy} onChange={(e) => void patch({ portents: front.portents.map((x) => (x.id === p.id ? { ...x, happened: e.target.checked } : x)) }, t("fronts.couldNotUpdatePortent"))} /> {p.text}
                  </label>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      {front.doom && (
        <p className={doomNear ? "qs-front-doom near" : "qs-front-doom"}>
          <Skull size={14} aria-hidden /> <strong>{t("fronts.impendingDoom")}</strong> {front.doom}
        </p>
      )}
      {doomNear && <p className="cal-help">{t("fronts.doomNear", { doom: FRONT_STATUS_LABELS.doom, averted: FRONT_STATUS_LABELS.averted })}</p>}
      <div className="qs-front-quests">
        <span className="field-label">{t("fronts.quests", { n: quests.length })}</span>
        {quests.length === 0 ? (
          <p className="cal-help">{t("fronts.noQuests")}</p>
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
