"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import Modal from "@/components/Modal";
import type { ClientCampaign } from "@/components/sessions/types";
import { SESSION_ZERO, WIZARD_STEPS } from "@/server/writer/guides";
import { STORY_TEMPLATES } from "@/server/writer/templates";
import type { CampaignSetup } from "@/server/writer/types";
import { useT } from "@/i18n/useT";

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
  const t = useT("writer");
  const tc = useT("common");
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
    <Modal open onClose={onClose} title={t("setup.title")} size="wide">
      <ol className="wr-steps" aria-label={t("setup.steps")}>
        {steps.map((s, i) => (
          <li key={s}>
            <button type="button" className={s === step ? "wr-step active" : i < index ? "wr-step done" : "wr-step"} aria-current={s === step ? "step" : undefined} onClick={() => setStep(s)}>
              {t("setup.stepN", { n: i + 1, label: s === "sessionZero" ? t("setup.sessionZero") : (guide(s)?.label ?? s) })}
            </button>
          </li>
        ))}
      </ol>

      <div className="wr-step-body">
        {step === "pitch" && (
          <label className="cal-field">
            <span className="field-label">{guide("pitch")!.label}</span>
            <span className="cal-help">{guide("pitch")!.hint}</span>
            <textarea rows={4} maxLength={4000} autoFocus value={setup.pitch} placeholder={t("setup.pitchPlaceholder")} onChange={(e) => set({ pitch: e.target.value })} />
          </label>
        )}
        {step === "truths" && (
          <LinesField label={guide("truths")!.label} hint={guide("truths")!.hint} values={setup.truths} max={12} placeholder={t("setup.truthPlaceholder")} onChange={(truths) => set({ truths })} warn={setup.truths.filter((x) => x.trim()).length > 7 ? t("setup.tooManyTruths") : null} />
        )}
        {step === "safety" && (
          <>
            <p className="cal-help">{guide("safety")!.hint}</p>
            <div className="qs-general-grid">
              <LinesField label={t("setup.lines")} values={setup.lines} max={40} placeholder={t("setup.linesPlaceholder")} onChange={(lines) => set({ lines })} />
              <LinesField label={t("setup.veils")} values={setup.veils} max={40} placeholder={t("setup.veilsPlaceholder")} onChange={(veils) => set({ veils })} />
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
            <ul className="wr-template-choices" role="radiogroup" aria-label={t("setup.structureLabel")}>
              <li>
                <label className="cal-check">
                  <input type="radio" name="structure" checked={template === null} onChange={() => setTemplate(null)} /> {t("setup.startBlank")}
                </label>
              </li>
              {STORY_TEMPLATES.map((s) => (
                <li key={s.key}>
                  <label className="cal-check">
                    <input type="radio" name="structure" checked={template === s.key} onChange={() => setTemplate(s.key)} />
                    <span>
                      <strong>{s.name}</strong> <span className="cal-help">{t("setup.structureLine", { count: s.beats.length, summary: s.summary })}</span>
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
          {t("setup.back")}
        </button>
        {index < steps.length - 1 && (
          <button type="button" className="btn btn-sm" onClick={() => setStep(steps[index + 1])}>
            {t("setup.next")}
          </button>
        )}
        <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => void finish()}>
          <Check size={14} /> {saving ? tc("saving") : t("setup.save")}
        </button>
      </div>
    </Modal>
  );
}

/** An editable list of one-line entries. */
function LinesField({ label, hint, values, max, placeholder, warn, onChange }: { label: string; hint?: string; values: string[]; max: number; placeholder: string; warn?: string | null; onChange: (v: string[]) => void }) {
  const t = useT("writer");
  return (
    <div className="cal-field">
      <span className="field-label">{label}</span>
      {hint && <span className="cal-help">{hint}</span>}
      {values.map((v, i) => (
        <div key={i} className="ss-line">
          <input type="text" aria-label={t("setup.lineN", { label, n: i + 1 })} maxLength={500} value={v} placeholder={placeholder} onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("setup.removeLineN", { label: label.toLowerCase(), n: i + 1 })} data-tooltip={t("ui.remove")} onClick={() => onChange(values.filter((_, j) => j !== i))}>
            <X size={14} />
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-sm" disabled={values.length >= max} onClick={() => onChange([...values, ""])}>
          <Plus size={14} /> {t("ui.add")}
        </button>
      </div>
      {warn && <span className="cal-help wr-warn-text">{warn}</span>}
    </div>
  );
}
