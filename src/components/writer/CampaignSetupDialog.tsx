"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import Modal from "@/components/Modal";
import type { ClientCampaign } from "@/components/sessions/types";
import { SESSION_ZERO, WIZARD_STEPS } from "@/server/writer/guides";
import { STORY_TEMPLATES } from "@/server/writer/templates";
import type { CampaignSetup } from "@/server/writer/types";

type Step = "pitch" | "truths" | "safety" | "sessionZero" | "structure";

/**
 * The campaign's one-page setup, as a guided walk-through: the pitch,
 * three to seven truths, lines and veils, the session zero checklist and
 * (for an empty outline) a story structure for the first arcs. Every step
 * can be skipped; Save keeps what's written so far.
 */
export default function CampaignSetupDialog({
  campaign,
  outlineEmpty,
  onSave,
  onApplyTemplate,
  onClose,
}: {
  campaign: ClientCampaign;
  outlineEmpty: boolean;
  onSave: (setup: Partial<CampaignSetup>) => Promise<boolean>;
  onApplyTemplate: (key: string) => void;
  onClose: () => void;
}) {
  const steps: Step[] = ["pitch", "truths", "safety", "sessionZero", ...(outlineEmpty ? (["structure"] as const) : [])];
  const [step, setStep] = useState<Step>("pitch");
  const [setup, setSetup] = useState<CampaignSetup>(campaign.setup);
  const [template, setTemplate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const index = steps.indexOf(step);
  const set = (patch: Partial<CampaignSetup>) => setSetup((s) => ({ ...s, ...patch }));

  async function finish() {
    setSaving(true);
    const ok = await onSave({ pitch: setup.pitch, truths: setup.truths.filter((t) => t.trim()), lines: setup.lines.filter((t) => t.trim()), veils: setup.veils.filter((t) => t.trim()), sessionZero: setup.sessionZero });
    setSaving(false);
    if (!ok) return;
    if (template) onApplyTemplate(template);
    onClose();
  }

  const guide = (key: string) => WIZARD_STEPS.find((w) => w.key === key);
  return (
    <Modal open onClose={onClose} title="Campaign setup" size="wide">
      <ol className="wr-steps" aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s}>
            <button type="button" className={s === step ? "wr-step active" : i < index ? "wr-step done" : "wr-step"} aria-current={s === step ? "step" : undefined} onClick={() => setStep(s)}>
              {i + 1}. {s === "sessionZero" ? "Session zero" : (guide(s)?.label ?? s)}
            </button>
          </li>
        ))}
      </ol>

      <div className="wr-step-body">
        {step === "pitch" && (
          <label className="cal-field">
            <span className="field-label">{guide("pitch")!.label}</span>
            <span className="cal-help">{guide("pitch")!.hint}</span>
            <textarea rows={4} maxLength={4000} autoFocus value={setup.pitch} placeholder="Five strangers wake in the salt mines of Karsa with no memory of the last year. The mine is flooding, and someone down there knows why." onChange={(e) => set({ pitch: e.target.value })} />
          </label>
        )}
        {step === "truths" && (
          <LinesField label={guide("truths")!.label} hint={guide("truths")!.hint} values={setup.truths} max={12} placeholder="The gods went silent a hundred years ago." onChange={(truths) => set({ truths })} warn={setup.truths.filter((t) => t.trim()).length > 7 ? "More than seven truths starts to read like homework. Keep the ones the players need." : null} />
        )}
        {step === "safety" && (
          <>
            <p className="cal-help">{guide("safety")!.hint}</p>
            <div className="qs-general-grid">
              <LinesField label="Lines (never appear)" values={setup.lines} max={40} placeholder="Harm to children" onChange={(lines) => set({ lines })} />
              <LinesField label="Veils (happen off-screen)" values={setup.veils} max={40} placeholder="Torture" onChange={(veils) => set({ veils })} />
            </div>
          </>
        )}
        {step === "sessionZero" && (
          <ul className="wr-checklist">
            {SESSION_ZERO.map((item) => (
              <li key={item.key}>
                <label className="cal-check">
                  <input type="checkbox" checked={setup.sessionZero[item.key] === true} onChange={(e) => set({ sessionZero: { ...setup.sessionZero, [item.key]: e.target.checked } })} />
                  <span>
                    <strong>{item.label}</strong>
                    <span className="cal-help"> {item.hint}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {step === "structure" && (
          <>
            <p className="cal-help">{guide("structure")!.hint}</p>
            <ul className="wr-template-choices" role="radiogroup" aria-label="Story structure">
              <li>
                <label className="cal-check">
                  <input type="radio" name="structure" checked={template === null} onChange={() => setTemplate(null)} /> Start blank
                </label>
              </li>
              {STORY_TEMPLATES.map((t) => (
                <li key={t.key}>
                  <label className="cal-check">
                    <input type="radio" name="structure" checked={template === t.key} onChange={() => setTemplate(t.key)} />
                    <span>
                      <strong>{t.name}</strong> <span className="cal-help">· {t.beats.length} arcs · {t.summary}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="cel-footer">
        <button type="button" className="btn btn-sm" disabled={index === 0} onClick={() => setStep(steps[index - 1])}>
          Back
        </button>
        {index < steps.length - 1 && (
          <button type="button" className="btn btn-sm" onClick={() => setStep(steps[index + 1])}>
            Next
          </button>
        )}
        <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => void finish()}>
          <Check size={14} /> {saving ? "Saving…" : "Save setup"}
        </button>
      </div>
    </Modal>
  );
}

/** An editable list of one-line entries. */
function LinesField({ label, hint, values, max, placeholder, warn, onChange }: { label: string; hint?: string; values: string[]; max: number; placeholder: string; warn?: string | null; onChange: (v: string[]) => void }) {
  return (
    <div className="cal-field">
      <span className="field-label">{label}</span>
      {hint && <span className="cal-help">{hint}</span>}
      {values.map((v, i) => (
        <div key={i} className="ss-line">
          <input type="text" aria-label={`${label} ${i + 1}`} maxLength={500} value={v} placeholder={placeholder} onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} data-tooltip="Remove" onClick={() => onChange(values.filter((_, j) => j !== i))}>
            <X size={14} />
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-sm" disabled={values.length >= max} onClick={() => onChange([...values, ""])}>
          <Plus size={14} /> Add
        </button>
      </div>
      {warn && <span className="cal-help wr-warn-text">{warn}</span>}
    </div>
  );
}
