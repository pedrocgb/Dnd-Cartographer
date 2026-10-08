"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { api, newId } from "@/components/calendars/api";
import { CLOCK_SIZES, FRONT_KIND_LABELS, FRONT_KINDS, FRONT_STATUS_LABELS, FRONT_STATUSES, type Clock, type ClockSize, type FrontData, type FrontKind, type FrontStatus, type Portent } from "@/server/quests/types";

import { useT } from "@/i18n/useT";

const SWATCHES = ["#47BFAB", "#9CC3F5", "#D29C53", "#E8735F", "#B48EE0", "#7AC77A", "#E8E3D5"];

/**
 * Create or edit a front (Dungeon World): the threat, what it does next
 * (grim portents, in order), the impending doom if nobody stops it, and an
 * optional clock counting down to it.
 */
export default function FrontEditor({ campaignId, front, onSaved, onDeleted, onClose }: { campaignId: string; front: FrontData | null; onSaved: (f: FrontData) => void; onDeleted: (id: string) => void; onClose: () => void }) {
  const t = useT("campaign");
  const tc = useT("common");
  const [name, setName] = useState(front?.name ?? "");
  const [kind, setKind] = useState<FrontKind>(front?.kind ?? "adventure");
  const [status, setStatus] = useState<FrontStatus>(front?.status ?? "active");
  const [color, setColor] = useState<string | null>(front?.color ?? null);
  const [threat, setThreat] = useState(front?.threat ?? "");
  const [doom, setDoom] = useState(front?.doom ?? "");
  const [portents, setPortents] = useState<Portent[]>(front?.portents ?? []);
  const [clock, setClock] = useState<Clock | null>(front?.clock ?? null);
  const [perPortent, setPerPortent] = useState(front?.clockPerPortent ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const written = portents.filter((p) => p.text.trim()).length;
  const setPortent = (id: string, patch: Partial<Portent>) => setPortents((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const movePortent = (i: number, by: number) =>
    setPortents((list) => {
      const next = [...list];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });

  async function save() {
    if (!name.trim()) {
      setError(t("problem.frontName"));
      return;
    }
    setSaving(true);
    setError(null);
    const body = { name, kind, status, color, threat, doom, portents: portents.filter((p) => p.text.trim()), clock, clockPerPortent: perPortent };
    const res = front
      ? await api<{ front: FrontData }>("PATCH", `/api/fronts/${front.id}`, { ...body, expectedVersion: front.version })
      : await api<{ front: FrontData }>("POST", `/api/campaigns/${campaignId}/fronts`, body);
    setSaving(false);
    if (res.ok) onSaved(res.data.front);
    else setError(res.data.error ?? t("frontEditor.couldNotSave"));
  }

  async function remove() {
    if (!front) return;
    const res = await api("DELETE", `/api/fronts/${front.id}`);
    if (res.ok) onDeleted(front.id);
    else setDeleteError(res.data.error ?? t("quest.couldNotDelete"));
  }

  return (
    <Modal open onClose={onClose} title={front ? t("quest.editNamed", { name: front.name }) : t("frontEditor.new")} size="wide">
      <div className="cel-editor">
        <div className="cel-body">
          <div className="cel-section">
            <label className="cal-field">
              <span className="field-label">{t("frontEditor.name")}</span>
              <input type="text" value={name} maxLength={120} placeholder={t("frontEditor.namePlaceholder")} onChange={(e) => setName(e.target.value)} autoFocus />
            </label>
            <div className="qs-general-grid">
              <label className="cal-field">
                <span className="field-label">{t("frontEditor.type")}</span>
                <select value={kind} onChange={(e) => setKind(e.target.value as FrontKind)}>
                  {FRONT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {FRONT_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cal-field">
                <span className="field-label">{t("frontEditor.status")}</span>
                <select value={status} onChange={(e) => setStatus(e.target.value as FrontStatus)}>
                  {FRONT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {FRONT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="cal-field">
                <span className="field-label">{t("frontEditor.color")}</span>
                <div className="entry-swatches">
                  <button type="button" className={!color ? "entry-swatch active qs-swatch-none" : "entry-swatch qs-swatch-none"} aria-label={t("frontEditor.noColor")} aria-pressed={!color} data-tooltip={t("frontEditor.noColor")} onClick={() => setColor(null)} />
                  {SWATCHES.map((s) => (
                    <button key={s} type="button" className={s === color ? "entry-swatch active" : "entry-swatch"} style={{ background: s }} aria-label={t("frontEditor.colorN", { color: s })} aria-pressed={s === color} onClick={() => setColor(s)} />
                  ))}
                </div>
              </div>
            </div>
            <label className="cal-field">
              <span className="field-label">{t("frontEditor.threat")}</span>
              <textarea rows={3} maxLength={2000} value={threat} placeholder={t("frontEditor.threatPlaceholder")} onChange={(e) => setThreat(e.target.value)} />
            </label>
          </div>

          <div className="cel-section">
            <header className="cel-section-head">
              <div>
                <h3>{t("fronts.grimPortents")}</h3>
                <p className="cal-help">{t("frontEditor.portentsHelp")}</p>
              </div>
            </header>
            {portents.map((p, i) => (
              <div key={p.id} className="ss-line qs-portent-row">
                <label className="cal-check" data-tooltip={t("frontEditor.happened")}>
                  <input type="checkbox" aria-label={t("frontEditor.portentHappened", { n: i + 1 })} checked={p.happened} onChange={(e) => setPortent(p.id, { happened: e.target.checked })} />
                </label>
                <input type="text" aria-label={t("frontEditor.portentN", { n: i + 1 })} maxLength={500} value={p.text} placeholder={t("frontEditor.portentPlaceholder")} className={p.happened ? "ss-resolved" : undefined} onChange={(e) => setPortent(p.id, { text: e.target.value })} />
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("frontEditor.moveUpN", { n: i + 1 })} data-tooltip={t("frontEditor.moveUp")} disabled={i === 0} onClick={() => movePortent(i, -1)}>
                  <ArrowUp size={14} />
                </button>
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("frontEditor.moveDownN", { n: i + 1 })} data-tooltip={t("frontEditor.moveDown")} disabled={i === portents.length - 1} onClick={() => movePortent(i, 1)}>
                  <ArrowDown size={14} />
                </button>
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("frontEditor.removeN", { n: i + 1 })} data-tooltip={t("quest.remove")} onClick={() => setPortents((list) => list.filter((x) => x.id !== p.id))}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <div>
              <button type="button" className="btn btn-sm" disabled={portents.length >= 12} onClick={() => setPortents((list) => [...list, { id: newId("pt"), text: "", happened: false }])}>
                <Plus size={14} /> {t("frontEditor.addPortent")}
              </button>
            </div>
            <label className="cal-field">
              <span className="field-label">{t("frontEditor.doom")}</span>
              <textarea rows={2} maxLength={2000} value={doom} placeholder={t("frontEditor.doomPlaceholder")} onChange={(e) => setDoom(e.target.value)} />
            </label>
          </div>

          <div className="cel-section">
            <header className="cel-section-head">
              <div>
                <h3>{t("quest.clock")}</h3>
                <p className="cal-help">{t("frontEditor.clockHelp")}</p>
              </div>
            </header>
            {!clock ? (
              <div>
                <button type="button" className="btn btn-sm" onClick={() => setClock({ segments: Math.max(4, Math.min(12, portents.length)) as ClockSize, filled: 0, label: "" })}>
                  <Plus size={14} /> {t("quest.addAClock")}
                </button>
              </div>
            ) : (
              <div className="qs-general-grid">
                <label className="cal-field">
                  <span className="field-label">{t("quest.segments")}</span>
                  <select value={clock.segments} onChange={(e) => setClock({ ...clock, segments: Number(e.target.value) as ClockSize, filled: Math.min(clock.filled, Number(e.target.value)) })}>
                    {CLOCK_SIZES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="cal-field">
                  <span className="field-label">{t("frontEditor.filled")}</span>
                  <input type="number" min={0} max={clock.segments} value={clock.filled} onChange={(e) => setClock({ ...clock, filled: Math.max(0, Math.min(clock.segments, Math.floor(Number(e.target.value)) || 0)) })} />
                </label>
                <div className="cal-field">
                  <span className="field-label">&nbsp;</span>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setClock(null)}>
                    <Trash2 size={14} /> {t("quest.removeClock")}
                  </button>
                </div>
              </div>
            )}
            {clock && (
              <label className="cel-toggle">
                <input type="checkbox" role="switch" checked={perPortent} onChange={(e) => setPerPortent(e.target.checked)} />
                <span className="cel-toggle-track" aria-hidden>
                  <span className="cel-toggle-thumb" />
                </span>
                <span>
                  <strong>{t("frontEditor.perPortent")}</strong>
                  <span className="cal-help">
                    {" "}
                    {t("frontEditor.perPortentHelp")}
                    {portents.length > 0 ? ` ${t("frontEditor.perPortentTotal", { count: written, n: written, ticks: written * clock.segments })}` : ""}
                  </span>
                </span>
              </label>
            )}
          </div>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="cel-footer">
          {front && (
            <button type="button" className="btn btn-sm btn-danger cel-footer-delete" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} /> {tc("delete")}
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={onClose} disabled={saving}>
            {tc("cancel")}
          </button>
          <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={save}>
            {saving ? tc("saving") : front ? t("frontEditor.save") : t("frontEditor.create")}
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        danger
        title={t("quest.deleteNamed", { name: front?.name ?? t("frontEditor.thisFront") })}
        confirmLabel={tc("delete")}
        error={deleteError}
        onConfirm={remove}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteError(null);
        }}
      >
        {t("frontEditor.deleteBody")}
      </ConfirmDialog>
    </Modal>
  );
}
