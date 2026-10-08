"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import Modal from "@/components/Modal";
import InfoPicker from "@/components/articles/InfoPicker";
import { candidateOptions } from "@/components/articles/candidates";
import { api, newId } from "@/components/calendars/api";
import { ArticleName, useCandidates } from "@/components/quests/parts";
import type { ClientSession } from "@/components/sessions/types";
import { sessionLabel } from "@/components/sessions/types";
import { PREP_STEPS, SUGGESTED_SECRETS } from "@/server/writer/guides";
import type { OutlineNode, SessionPrep } from "@/server/writer/types";
import { useT } from "@/i18n/useT";

const hintOf = (key: string) => PREP_STEPS.find((s) => s.key === key)!;

/** One of the eight steps: its name, its advice (with guides on), its fields. */
function Step({ k, guides, children }: { k: string; guides: boolean; children: React.ReactNode }) {
  return (
    <section className="cel-section">
      <header className="cel-section-head">
        <div>
          <h3>{hintOf(k).label}</h3>
          {guides && <p className="cal-help">{hintOf(k).hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

/**
 * A session's prep, following the Lazy DM's eight steps. Every section is
 * optional; unrevealed secrets carry over to the next session after "What
 * happened?".
 */
export default function SessionPrepDialog({ session, scenes, guides, onSaved, onClose }: { session: ClientSession; scenes: OutlineNode[]; guides: boolean; onSaved: (s: ClientSession) => void; onClose: () => void }) {
  const t = useT("writer");
  const tc = useT("common");
  const [prep, setPrep] = useState<SessionPrep>(session.prep);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const candidates = useCandidates();
  const set = (patch: Partial<SessionPrep>) => setPrep((p) => ({ ...p, ...patch }));

  async function save() {
    setSaving(true);
    const body = { ...prep, secrets: prep.secrets.filter((s) => s.text.trim()), locations: prep.locations.filter((l) => l.trim()) };
    const res = await api<{ session: ClientSession }>("PATCH", `/api/sessions/${session.id}`, { prep: body, expectedVersion: session.version });
    setSaving(false);
    if (res.ok) {
      onSaved(res.data.session);
      onClose();
    } else setError(res.data.error ?? t("prep.couldNotSave"));
  }

  const npcIds = new Set(prep.npcs.map((n) => n.articleId));
  return (
    <Modal open onClose={onClose} title={t("prep.title", { session: sessionLabel(session) })} size="wide">
      <div className="cel-editor">
        <div className="cel-body">
          <Step k="reviewCharacters" guides={guides}>
            <textarea rows={2} maxLength={4000} aria-label={t("prep.characterNotes")} value={prep.reviewCharacters} placeholder={t("prep.charactersPlaceholder")} onChange={(e) => set({ reviewCharacters: e.target.value })} />
          </Step>
          <Step k="strongStart" guides={guides}>
            <textarea rows={2} maxLength={4000} aria-label={t("prep.strongStart")} value={prep.strongStart} placeholder={t("prep.startPlaceholder")} onChange={(e) => set({ strongStart: e.target.value })} />
          </Step>
          <Step k="scenes" guides={guides}>
            {scenes.length === 0 ? <p className="cal-help">{t("prep.noScenes")}</p> : <ul className="wr-prep-scenes">{scenes.map((n) => <li key={n.id}>{n.title}</li>)}</ul>}
          </Step>
          <Step k="secrets" guides={guides}>
            {prep.secrets.map((s, i) => (
              <div key={s.id} className="ss-line">
                <input type="text" aria-label={t("prep.secretN", { n: i + 1 })} maxLength={500} value={s.text} placeholder={t("prep.secretPlaceholder")} onChange={(e) => set({ secrets: prep.secrets.map((x) => (x.id === s.id ? { ...x, text: e.target.value } : x)) })} />
                {s.state === "revealed" && <span className="cv-chip">{t("prep.revealed")}</span>}
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("prep.removeSecret", { n: i + 1 })} data-tooltip={t("ui.remove")} onClick={() => set({ secrets: prep.secrets.filter((x) => x.id !== s.id) })}>
                  <X size={14} />
                </button>
              </div>
            ))}
            <div className="wr-inline-actions">
              <button type="button" className="btn btn-sm" disabled={prep.secrets.length >= 30} onClick={() => set({ secrets: [...prep.secrets, { id: newId("sc"), text: "", state: "unused" }] })}>
                <Plus size={14} /> {t("prep.addSecret")}
              </button>
              <span className="cal-help">
                {prep.secrets.length}/{SUGGESTED_SECRETS}
              </span>
            </div>
          </Step>
          <Step k="locations" guides={guides}>
            {prep.locations.map((l, i) => (
              <div key={i} className="ss-line">
                <input type="text" aria-label={t("prep.locationN", { n: i + 1 })} maxLength={1000} value={l} placeholder={t("prep.locationPlaceholder")} onChange={(e) => set({ locations: prep.locations.map((x, j) => (j === i ? e.target.value : x)) })} />
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("prep.removeLocation", { n: i + 1 })} data-tooltip={t("ui.remove")} onClick={() => set({ locations: prep.locations.filter((_, j) => j !== i) })}>
                  <X size={14} />
                </button>
              </div>
            ))}
            <div>
              <button type="button" className="btn btn-sm" disabled={prep.locations.length >= 20} onClick={() => set({ locations: [...prep.locations, ""] })}>
                <Plus size={14} /> {t("prep.addLocation")}
              </button>
            </div>
          </Step>
          <Step k="npcs" guides={guides}>
            <ul className="wr-chips">
              {prep.npcs.map((n) => (
                <li key={n.articleId} className="wr-chip">
                  <ArticleName link={n} candidates={candidates} />
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("prep.removeNpc")} data-tooltip={t("ui.remove")} onClick={() => set({ npcs: prep.npcs.filter((x) => x.articleId !== n.articleId) })}>
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
            {candidates && (
              <InfoPicker
                options={candidateOptions(candidates.filter((c) => c.template === "character" || c.template === "organization"), npcIds)}
                value={null}
                placeholder={t("prep.addNpcPick")}
                ariaLabel={t("prep.addNpc")}
                onChange={(id) => {
                  const c = candidates.find((x) => x.id === id);
                  if (c) set({ npcs: [...prep.npcs, { template: c.template, articleId: c.id }] });
                }}
              />
            )}
          </Step>
          <Step k="monsters" guides={guides}>
            <textarea rows={2} maxLength={4000} aria-label={t("prep.monsters")} value={prep.monsters} placeholder={t("prep.monstersPlaceholder")} onChange={(e) => set({ monsters: e.target.value })} />
          </Step>
          <Step k="rewards" guides={guides}>
            <textarea rows={2} maxLength={4000} aria-label={t("prep.rewards")} value={prep.rewards} placeholder={t("prep.rewardsPlaceholder")} onChange={(e) => set({ rewards: e.target.value })} />
          </Step>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="cel-footer">
          <button type="button" className="btn btn-sm" onClick={onClose} disabled={saving}>
            {tc("cancel")}
          </button>
          <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? tc("saving") : t("prep.save")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
