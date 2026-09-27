"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import type { Impact } from "./types";

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
  const [mode, setMode] = useState<"physical" | "named">("physical");
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [ack, setAck] = useState(false);
  const invalid = impact.entries.filter((e) => "error" in e.named);
  const unresolved = mode === "named" ? invalid.filter((e) => !keep.has(e.id)) : [];
  const truncated = impact.entryCount > impact.entries.length;
  const canApply = !busy && unresolved.length === 0 && (impact.references.length === 0 || ack) && !(mode === "named" && truncated);

  return (
    <Modal open onClose={() => !busy && onCancel()} title="Review this change" size="wide">
      <p>The shared world date stays on the same physical day. Only how dates are labeled in this calendar can change.</p>
      <p className="cal-impact-current">
        Current date: <strong>{impact.currentDay.before}</strong>
        {impact.currentDay.after !== impact.currentDay.before && (
          <>
            {" "}
            will read <strong>{impact.currentDay.after}</strong>
          </>
        )}
      </p>

      {impact.entryCount > 0 && (
        <>
          <fieldset className="cal-radio">
            <legend className="field-label">
              {impact.entryCount} record{impact.entryCount === 1 ? "" : "s"} affected
            </legend>
            <label className="cal-check">
              <input type="radio" name="impact-mode" checked={mode === "physical"} onChange={() => setMode("physical")} />
              <span>
                <strong>Preserve physical day</strong> (recommended) — records stay on the same day; their label in this calendar changes. Other calendars are unaffected.
              </span>
            </label>
            <label className="cal-check">
              <input type="radio" name="impact-mode" checked={mode === "named"} onChange={() => setMode("named")} />
              <span>
                <strong>Preserve named dates</strong> — records keep their label in this calendar and move to a different physical day (so they move in every other calendar, and relative to moons).
              </span>
            </label>
          </fieldset>
          {mode === "named" && truncated && <p className="form-error">Too many records to review one by one; use Preserve physical day.</p>}
          <div className="cal-impact-table-wrap">
            <table className="cal-impact-table">
              <thead>
                <tr>
                  <th>Record</th>
                  <th>Now</th>
                  <th>{mode === "physical" ? "After (same day)" : "After (same name)"}</th>
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
                            {e.named.error} Keep it on its physical day ({e.afterPhysical}).
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
          {truncated && <p className="cal-help">Showing the first {impact.entries.length} of {impact.entryCount}.</p>}
        </>
      )}

      {impact.references.length > 0 && (
        <div className="cal-impact-refs">
          <p className="field-label">Rules that point at removed dates</p>
          <ul>
            {impact.references.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <label className="cal-check">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            Keep them as they are (nothing is deleted; fix them afterwards)
          </label>
        </div>
      )}

      <p className="cal-help">The previous definition is saved as a revision you can restore.</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="confirm-dialog-actions">
        <button type="button" className="btn btn-sm" onClick={onCancel} disabled={busy} autoFocus>
          Back to editing
        </button>
        <button type="button" className="btn btn-sm btn-primary" disabled={!canApply} onClick={() => onApply({ mode, keepPhysical: [...keep], acknowledgeReferences: ack })}>
          {busy ? "Saving…" : unresolved.length ? `Resolve ${unresolved.length} date${unresolved.length === 1 ? "" : "s"} first` : "Apply change"}
        </button>
      </div>
    </Modal>
  );
}
