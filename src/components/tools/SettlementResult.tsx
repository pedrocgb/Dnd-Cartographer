"use client";

import { Castle, Dices } from "lucide-react";
import type { GeneratedSettlement } from "@/lib/settlement-generator/generate";
import type { InputField } from "@/lib/settlement-generator/inputs";
import { settlementLabel, type LabelGroup } from "@/lib/settlement-generator/labels";
import { formatInteger } from "@/server/settings/number-format";
import { useT } from "@/i18n/useT";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="tool-fact">
      <span className="tool-fact-label">{label}</span>
      <span className="tool-fact-value">{value}</span>
    </div>
  );
}

/** The inputs shown as tags, in this order; rolled ones carry a die. */
const INPUT_TAGS: readonly InputField[] = ["geography", "climate", "prosperity", "tone"];

/**
 * One generated settlement, laid out in sections. Later steps of the tool
 * add their own sections here.
 */
export default function SettlementResult({ settlement: s }: { settlement: GeneratedSettlement }) {
  const t = useT("settlement");
  const label = (group: LabelGroup, value: string) => settlementLabel(group, value, t);
  const rolled = new Set(s.randomized);
  const { origins, purposes } = s;

  return (
    <>
      <div className="tool-hero">
        <div className="tool-avatar" aria-hidden>
          <Castle size={28} strokeWidth={2} />
        </div>
        <div className="tool-hero-text">
          <h3 className="tool-hero-name">{s.name}</h3>
          <div className="tool-tags">
            <span className="tool-tag tool-tag-accent">{label("type", s.inputs.type)}</span>
            {INPUT_TAGS.map((field) => (
              <span key={field} className="tool-tag settlement-tag" data-tooltip={rolled.has(field) ? t("result.rolled") : undefined}>
                {rolled.has(field) && <Dices size={11} strokeWidth={2.25} aria-hidden />}
                {label(field, s.inputs[field])}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="tool-sheet">
        <section className="settlement-section">
          <h4>{t("result.summary")}</h4>
          <p className="settlement-summary">{s.summary}</p>
        </section>
        <section className="settlement-section">
          <h4>{t("result.basic")}</h4>
          <div className="tool-facts">
            <Fact label={t("fact.type")} value={label("type", s.inputs.type)} />
            <Fact label={t("fact.population")} value={formatInteger(s.population)} />
            <Fact label={t("fact.primary")} value={label("purpose", purposes.primary)} />
            <Fact label={t("fact.secondary")} value={purposes.secondary.map((p) => label("purpose", p)).join(", ") || t("fact.none")} />
          </div>
        </section>
        <section className="settlement-section">
          <h4>{t("result.origins")}</h4>
          <div className="tool-facts">
            <Fact label={t("fact.founding")} value={t("fact.foundingValue", { founding: label("founding", origins.founding), detail: label("detail", origins.foundingDetail) })} />
            <Fact label={t("fact.age")} value={label("age", origins.age)} />
            <Fact label={t("fact.growth")} value={label("growth", origins.growth)} />
            <Fact label={t("fact.condition")} value={label("condition", origins.condition)} />
            <Fact label={t("fact.change")} value={label("change", origins.recentChange)} />
          </div>
        </section>
      </div>
    </>
  );
}
