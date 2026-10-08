"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import type { Impact } from "./types";
import { useT } from "@/i18n/useT";
import { problemText } from "@/server/calendars/engine";

export interface MigrationChoice {
  mode: "physical" | "named";
  keepPhysical: string[];
  acknowledgeReferences: boolean;
}

/**
 * Review of a structural calendar change before it's saved: what happens
 * to the current date label, each affected record under Preserve Physical
 * Day (default) or Preserve Named Dates, and any rule/profile pointing at
 * removed dates. Invalid named dates need an explicit choice per record.
 */
export default function ImpactDialog({
  impact,
  busy,
  error,
  onApply,
  onCancel,
}: {
  impact: Impact;
  busy: boolean;
  error: string | null;
  onApply: (choice: MigrationChoice) => void;
  onCancel: () => void;
}) {
  const t = useT("calendars");
  const tc = useT("common");
  const [mode, setMode] = useState<"physical" | "named">("physical");
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [ack, setAck] = useState(false);
  const invalid = impact.entries.filter((e) => "error" in e.named);
  const unresolved = mode === "named" ? invalid.filter((e) => !keep.has(e.id)) : [];
  const truncated = impact.entryCount > impact.entries.length;
  const canApply = !busy && unresolved.length === 0 && (impact.references.length === 0 || ack) && !(mode === "named" && truncated);

  return (
    <Modal open onClose={() => !busy && onCancel()} title={t("impact.title")} size="wide">
      <p>{t("impact.intro")}</p>
      <p className="cal-impact-current">
        {t("impact.current")} <strong>{impact.currentDay.before}</strong>
        {impact.currentDay.after !== impact.currentDay.before && (
          <>
            {" "}
            {t("impact.willRead")} <strong>{impact.currentDay.after}</strong>
          </>
        )}
      </p>

      {impact.entryCount > 0 && (
        <>
          <fieldset className="cal-radio">
            <legend className="field-label">
              {t("impact.affected", { count: impact.entryCount, n: impact.entryCount })}
            </legend>
            <label className="cal-check">
              <input type="radio" name="impact-mode" checked={mode === "physical"} onChange={() => setMode("physical")} />
              <span>
                <strong>{t("impact.physical")}</strong> {t("impact.physicalHelp")}
              </span>
            </label>
            <label className="cal-check">
              <input type="radio" name="impact-mode" checked={mode === "named"} onChange={() => setMode("named")} />
              <span>
                <strong>{t("impact.named")}</strong> {t("impact.namedHelp")}
              </span>
            </label>
          </fieldset>
          {mode === "named" && truncated && <p className="form-error">{t("impact.tooMany")}</p>}
          <div className="cal-impact-table-wrap">
            <table className="cal-impact-table">
              <thead>
                <tr>
                  <th>{t("impact.record")}</th>
                  <th>{t("impact.now")}</th>
                  <th>{mode === "physical" ? t("impact.afterSame") : t("impact.afterName")}</th>
                </tr>
              </thead>
              <tbody>
                {impact.entries.map((e) => (
                  <tr key={e.id}>
                    <td>{e.title}</td>
                    <td>{e.before}</td>
                    <td>
                      {mode === "physical" ? (
                        e.afterPhysical
                      ) : "error" in e.named ? (
                        <label className="cal-check cal-impact-invalid">
                          <input
                            type="checkbox"
                            checked={keep.has(e.id)}
                            onChange={(ev) => {
                              const next = new Set(keep);
                              if (ev.target.checked) next.add(e.id);
                              else next.delete(e.id);
                              setKeep(next);
                            }}
                          />
                          <span>
                            {t("impact.keepPhysical", { error: problemText(e.named.error), date: e.afterPhysical })}
                          </span>
                        </label>
                      ) : (
                        e.named.label
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {truncated && <p className="cal-help">{t("impact.showing", { shown: impact.entries.length, total: impact.entryCount })}</p>}
        </>
      )}

      {impact.references.length > 0 && (
        <div className="cal-impact-refs">
          <p className="field-label">{t("impact.references")}</p>
          <ul>
            {impact.references.map((r, i) => (
              <li key={i}>{problemText(r)}</li>
            ))}
          </ul>
          <label className="cal-check">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            {t("impact.keepRefs")}
          </label>
        </div>
      )}

      <p className="cal-help">{t("impact.revisionNote")}</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="confirm-dialog-actions">
        <button type="button" className="btn btn-sm" onClick={onCancel} disabled={busy} autoFocus>
          {t("impact.backToEditing")}
        </button>
        <button type="button" className="btn btn-sm btn-primary" disabled={!canApply} onClick={() => onApply({ mode, keepPhysical: [...keep], acknowledgeReferences: ack })}>
          {busy ? tc("saving") : unresolved.length ? t("impact.resolve", { count: unresolved.length, n: unresolved.length }) : t("impact.apply")}
        </button>
      </div>
    </Modal>
  );
}
