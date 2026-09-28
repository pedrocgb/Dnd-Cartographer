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
    } else setError(res.data.error ?? "Could not save the prep.");
  }

  const npcIds = new Set(prep.npcs.map((n) => n.articleId));
  return (
    <Modal open onClose={onClose} title={`Prep: ${sessionLabel(session)}`} size="wide">
      <div className="cel-editor">
        <div className="cel-body">
          <Step k="reviewCharacters" guides={guides}>
            <textarea rows={2} maxLength={4000} aria-label="Character notes" value={prep.reviewCharacters} placeholder="Mira wants revenge on the baron; Tobin owes the thieves' guild." onChange={(e) => set({ reviewCharacters: e.target.value })} />
          </Step>
          <Step k="strongStart" guides={guides}>
            <textarea rows={2} maxLength={4000} aria-label="Strong start" value={prep.strongStart} placeholder="The bridge collapses under the caravan just as the bandits attack." onChange={(e) => set({ strongStart: e.target.value })} />
          </Step>
          <Step k="scenes" guides={guides}>
            {scenes.length === 0 ? <p className="cal-help">No scenes planned yet. Plan them from the Sessions tab, or with a scene&apos;s &quot;Planned for&quot;.</p> : <ul className="wr-prep-scenes">{scenes.map((n) => <li key={n.id}>{n.title}</li>)}</ul>}
          </Step>
          <Step k="secrets" guides={guides}>
            {prep.secrets.map((s, i) => (
              <div key={s.id} className="ss-line">
                <input type="text" aria-label={`Secret ${i + 1}`} maxLength={500} value={s.text} placeholder="The baron's heir is alive and hiding in the monastery." onChange={(e) => set({ secrets: prep.secrets.map((x) => (x.id === s.id ? { ...x, text: e.target.value } : x)) })} />
                {s.state === "revealed" && <span className="cv-chip">Revealed</span>}
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove secret ${i + 1}`} data-tooltip="Remove" onClick={() => set({ secrets: prep.secrets.filter((x) => x.id !== s.id) })}>
                  <X size={14} />
                </button>
              </div>
            ))}
            <div className="wr-inline-actions">
              <button type="button" className="btn btn-sm" disabled={prep.secrets.length >= 30} onClick={() => set({ secrets: [...prep.secrets, { id: newId("sc"), text: "", state: "unused" }] })}>
                <Plus size={14} /> Add secret
              </button>
              <span className="cal-help">
                {prep.secrets.length}/{SUGGESTED_SECRETS}
              </span>
            </div>
          </Step>
          <Step k="locations" guides={guides}>
            {prep.locations.map((l, i) => (
              <div key={i} className="ss-line">
                <input type="text" aria-label={`Location ${i + 1}`} maxLength={1000} value={l} placeholder="The drowned chapel: bells ring underwater, pews float, a candle burns at the altar." onChange={(e) => set({ locations: prep.locations.map((x, j) => (j === i ? e.target.value : x)) })} />
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove location ${i + 1}`} data-tooltip="Remove" onClick={() => set({ locations: prep.locations.filter((_, j) => j !== i) })}>
                  <X size={14} />
                </button>
              </div>
            ))}
            <div>
              <button type="button" className="btn btn-sm" disabled={prep.locations.length >= 20} onClick={() => set({ locations: [...prep.locations, ""] })}>
                <Plus size={14} /> Add location
              </button>
            </div>
          </Step>
          <Step k="npcs" guides={guides}>
            <ul className="wr-chips">
              {prep.npcs.map((n) => (
                <li key={n.articleId} className="wr-chip">
                  <ArticleName link={n} candidates={candidates} />
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Remove NPC" data-tooltip="Remove" onClick={() => set({ npcs: prep.npcs.filter((x) => x.articleId !== n.articleId) })}>
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
            {candidates && (
              <InfoPicker
                options={candidateOptions(candidates.filter((c) => c.template === "character" || c.template === "organization"), npcIds)}
                value={null}
                placeholder="Add an NPC or organization…"
                ariaLabel="Add an NPC"
                onChange={(id) => {
                  const c = candidates.find((x) => x.id === id);
                  if (c) set({ npcs: [...prep.npcs, { template: c.template, articleId: c.id }] });
                }}
              />
            )}
          </Step>
          <Step k="monsters" guides={guides}>
            <textarea rows={2} maxLength={4000} aria-label="Monsters" value={prep.monsters} placeholder="Drowned ones (zombies that swim), a giant eel, the priest (mage)." onChange={(e) => set({ monsters: e.target.value })} />
          </Step>
          <Step k="rewards" guides={guides}>
            <textarea rows={2} maxLength={4000} aria-label="Rewards" value={prep.rewards} placeholder="The bell of Saint Oda (rings true when someone lies)." onChange={(e) => set({ rewards: e.target.value })} />
          </Step>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="cel-footer">
          <button type="button" className="btn btn-sm" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save prep"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
