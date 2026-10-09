"use client";

import { useRef, useState } from "react";
import { Castle, Dices } from "lucide-react";
import { generateSettlement } from "@/lib/settlement-generator/generate";
import { parseHistory, type HistoryEntry } from "@/lib/settlement-generator/history";
import { resolveInputs } from "@/lib/settlement-generator/inputs";
import { settlementLabel, type LabelGroup } from "@/lib/settlement-generator/labels";
import { loadNamePool } from "@/lib/settlement-generator/names";
import { CLIMATES, DEFAULT_OPTIONS, GEOGRAPHIES, PROSPERITIES, SETTLEMENT_TYPES, TONES, type SettlementOptions } from "@/lib/settlement-generator/options";
import { formatInteger } from "@/server/settings/number-format";
import { useT } from "@/i18n/useT";
import RecentList from "./RecentList";
import SettlementResult from "./SettlementResult";
import { useToolHistory } from "./useToolHistory";

/** The option selects, in order: each field, its values and its label group. */
const FIELDS: readonly { key: keyof SettlementOptions; values: readonly string[] }[] = [
  { key: "type", values: SETTLEMENT_TYPES },
  { key: "geography", values: GEOGRAPHIES },
  { key: "climate", values: CLIMATES },
  { key: "prosperity", values: PROSPERITIES },
  { key: "tone", values: TONES },
];

/** Advanced Tools › Settlement Generator: rolls a whole settlement shaped by the mood picked. */
export default function SettlementGenerator({ worldId }: { worldId: string }) {
  const t = useT("settlement");
  const { entries, add } = useToolHistory(`settlement-generator-history:${worldId}`, parseHistory);
  const [opts, setOpts] = useState<SettlementOptions>(DEFAULT_OPTIONS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLElement>(null);

  // The newest settlement shows until another one is picked from the list.
  const open = entries.find((e) => e.id === openId) ?? entries[0] ?? null;
  const label = (group: LabelGroup, value: string) => settlementLabel(group, value, t);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const resolved = resolveInputs(opts, Math.random);
      const names = await loadNamePool(resolved.inputs.type);
      const recent = new Set(entries.map((e) => e.settlement.name));
      const settlement = generateSettlement(resolved, names, Math.random, undefined, recent);
      const entry: HistoryEntry = { id: crypto.randomUUID(), createdAt: Date.now(), settlement };
      add(entry);
      setOpenId(entry.id);
    } catch {
      setError(t("namesFailed"));
    } finally {
      setBusy(false);
    }
  }

  function reopen(id: string) {
    setOpenId(id);
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <header className="settings-header">
        <div>
          <h1 className="tool-title">
            <Castle size={22} strokeWidth={2.25} aria-hidden />
            {t("title")}
          </h1>
          <p>{t("intro")}</p>
        </div>
      </header>

      <section className="settings-card">
        <div className="settings-card-head">
          <h2>{t("options")}</h2>
          <p>{t("optionsHint")}</p>
        </div>
        <div className="settings-card-body">
          {FIELDS.map(({ key, values }) => (
            <div key={key} className="settings-row">
              <div className="settings-row-text">
                <label htmlFor={`sg-${key}`}>{t(`opt.${key}`)}</label>
                <p>{t(`opt.${key}Hint`)}</p>
              </div>
              <div className="settings-row-control">
                <select id={`sg-${key}`} value={opts[key]} onChange={(e) => setOpts((o) => ({ ...o, [key]: e.target.value }))}>
                  <option value="random">{t("ui.random")}</option>
                  {values.map((v) => (
                    <option key={v} value={v}>
                      {label(key, v)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="tool-actions">
        <button type="button" className="btn btn-primary" onClick={generate} disabled={busy}>
          <Dices size={16} strokeWidth={2.25} aria-hidden />
          {t("ui.generate")}
        </button>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <section ref={resultRef} className="settings-card settlement-result" aria-live="polite">
        <div className="settings-card-body">{open ? <SettlementResult settlement={open.settlement} /> : <p className="tool-empty">{t("result.empty")}</p>}</div>
      </section>

      <RecentList
        title={t("recent")}
        noun={t("noun")}
        onOpen={reopen}
        items={entries.map((e) => ({
          id: e.id,
          createdAt: e.createdAt,
          title: e.settlement.name,
          meta: [label("type", e.settlement.inputs.type), formatInteger(e.settlement.population), label("geography", e.settlement.inputs.geography)].join(" · "),
        }))}
      />
    </>
  );
}
