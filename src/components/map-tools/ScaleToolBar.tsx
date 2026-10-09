"use client";

import { useState } from "react";
import { Crosshair, Eye, EyeOff, Move, Palette, Ruler, X } from "lucide-react";
import SegmentedControl from "@/components/marker-panel/SegmentedControl";
import Toggle from "@/components/Toggle";
import { SliderField } from "@/components/GridPanel";
import { DEFAULT_SCALE, formatNumber, SCALE_LIMITS, scaleUnitLabel, SCALE_UNITS, SUBDIVISIONS, unitSuffix, type ScaleStyle, type ScaleUnit } from "@/server/scale/scale-config";
import type { MeasureMode } from "../map-hud/MeasureLayer";
import type { ScaleBarPatch, ScaleBarState } from "../map-hud/use-map-scale-bar";
import { useT } from "@/i18n/useT";
import { ToolBar, ToolBarButton, ToolBarDivider, ToolBarPopover } from "./ToolBar";

const STYLE_KEYS: ScaleStyle[] = ["alternating", "double", "ticks", "hollow"];

/** A positive number field that keeps what's typed (e.g. "0.") until it's a valid number. */
function StepInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (Number(text.replace(",", ".")) !== value) setText(String(value));
  }
  return (
    <input
      id="scale-step"
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const v = Number(e.target.value.replace(",", "."));
        if (v >= SCALE_LIMITS.stepValue[0] && v <= SCALE_LIMITS.stepValue[1]) onChange(v);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

/**
 * The Scale tool's bar: move the scale bar on the map, calibrate the map (two
 * points a known distance apart), measure with the ruler; then show/hide the
 * scale bar, its units and its look.
 */
export default function ScaleToolBar({
  inset,
  scaleBar,
  error,
  measureMode,
  onSetMeasureMode,
  onUpdate,
  onClose,
}: {
  /** Where the map's free part starts (right of the side panel). */
  inset: number;
  scaleBar: ScaleBarState;
  error: string | null;
  measureMode: MeasureMode | null;
  onSetMeasureMode: (mode: MeasureMode | null) => void;
  onUpdate: (patch: ScaleBarPatch) => void;
  onClose: () => void;
}) {
  const t = useT("maps");
  const tc = useT("common");
  const { config, visible } = scaleBar;
  const calibrated = config.framePxPerUnit !== null;
  const suffix = unitSuffix(config);
  const set = (patch: ScaleBarPatch["config"]) => onUpdate({ config: patch });
  // The ruler and calibration show their own hint above the bar.
  const caption = error ?? (measureMode ? undefined : calibrated ? t("scale.calibrated", { unit: suffix, px: formatNumber(config.framePxPerUnit!) }) : t("scale.calibrateHint"));

  return (
    <ToolBar label={t("scaleBar.label")} inset={inset} caption={caption}>
      <ToolBarButton Icon={Move} label={t("scaleBar.move")} hint={t("scaleBar.moveHint")} pressed={measureMode === null} onClick={() => onSetMeasureMode(null)} />
      <ToolBarButton
        Icon={Crosshair}
        label={calibrated ? t("scale.recalibrate") : t("scale.calibrate")}
        hint={t("scaleBar.calibrateHint")}
        pressed={measureMode === "calibrate"}
        onClick={() => onSetMeasureMode(measureMode === "calibrate" ? null : "calibrate")}
      />
      <ToolBarButton
        Icon={Ruler}
        label={t("scale.measureDistance")}
        hint={calibrated ? t("scale.measureHint", { unit: suffix }) : t("scale.measureHintPx")}
        pressed={measureMode === "measure"}
        onClick={() => onSetMeasureMode(measureMode === "measure" ? null : "measure")}
      />
      <ToolBarDivider />
      <ToolBarButton
        Icon={visible ? Eye : EyeOff}
        label={t("scale.showBar")}
        hint={calibrated ? (visible ? t("scaleBar.hideBar") : t("scale.showBar")) : t("scale.calibrateFirst")}
        pressed={calibrated && visible}
        disabled={!calibrated}
        onClick={() => onUpdate({ visible: !visible })}
      />
      <ToolBarPopover label={t("scaleBar.units")} hint={t("scaleBar.unitsHint")} disabled={!calibrated} face={<span className="tool-bar-value">{suffix}</span>}>
        <div className="tool-bar-pop-fields">
          <label className="field-label" htmlFor="scale-unit">
            {t("scale.unit")}
          </label>
          <select id="scale-unit" value={config.unit} onChange={(e) => set({ unit: e.target.value as ScaleUnit })}>
            {SCALE_UNITS.map((u) => (
              <option key={u} value={u}>
                {scaleUnitLabel(u)}
              </option>
            ))}
          </select>
          {config.unit === "custom" && (
            <input type="text" aria-label={t("scale.customName")} placeholder={t("scale.customPlaceholder")} maxLength={SCALE_LIMITS.customLabel} value={config.customLabel} onChange={(e) => set({ customLabel: e.target.value })} />
          )}
          <p className="field-label">{t("scale.unitHint")}</p>
          <label className="field-label" htmlFor="scale-step">
            {t("scale.eachStep", { unit: suffix })}
          </label>
          <StepInput value={config.stepValue} onChange={(stepValue) => set({ stepValue })} />
          <SliderField label={t("scale.steps")} value={config.steps} min={SCALE_LIMITS.steps[0]} max={SCALE_LIMITS.steps[1]} defaultValue={DEFAULT_SCALE.steps} onChange={(steps) => set({ steps })} />
          <span className="field-label">{t("scale.split")}</span>
          <SegmentedControl
            ariaLabel={t("scale.split")}
            value={String(config.subdivideFirst)}
            segments={SUBDIVISIONS.map((n) => ({ key: String(n), label: n === 0 ? t("scale.splitNo") : `${n}` }))}
            onChange={(key) => set({ subdivideFirst: Number(key) as (typeof SUBDIVISIONS)[number] })}
          />
          <Toggle checked={config.autoStep} onChange={(autoStep) => set({ autoStep })} label={t("scale.autoStep")} />
          <p className="field-label">{t("scale.autoStepHint")}</p>
        </div>
      </ToolBarPopover>
      <ToolBarPopover label={t("legend.look")} hint={t("scaleBar.lookHint")} disabled={!calibrated} face={<Palette size={16} strokeWidth={2.25} aria-hidden />}>
        <div className="tool-bar-pop-fields">
          <span className="field-label">{t("scale.style")}</span>
          <SegmentedControl ariaLabel={t("scale.barStyle")} value={config.style} segments={STYLE_KEYS.map((key) => ({ key, label: t(`scale.style.${key}`) }))} onChange={(style) => set({ style })} />
          <span className="field-label">{t("style.color")}</span>
          <SegmentedControl
            ariaLabel={t("scale.barColor")}
            value={config.tone}
            segments={[
              { key: "light", label: t("scale.tone.light") },
              { key: "dark", label: t("scale.tone.dark") },
            ]}
            onChange={(tone) => set({ tone })}
          />
          <SliderField label={t("scale.labelSize")} value={config.labelSize} min={SCALE_LIMITS.labelSize[0]} max={SCALE_LIMITS.labelSize[1]} suffix="px" defaultValue={DEFAULT_SCALE.labelSize} onChange={(labelSize) => set({ labelSize })} />
          <Toggle checked={config.plate} onChange={(plate) => set({ plate })} label={t("scale.plate")} />
        </div>
      </ToolBarPopover>
      <ToolBarDivider />
      <ToolBarButton Icon={X} label={tc("closePanel", { title: t("panel.scale") })} onClick={onClose} />
    </ToolBar>
  );
}
