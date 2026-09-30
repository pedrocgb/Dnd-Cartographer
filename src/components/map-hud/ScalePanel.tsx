"use client";

import { useState } from "react";
import { Crosshair, Ruler, X } from "lucide-react";
import MarkerCard from "@/components/marker-panel/MarkerCard";
import SegmentedControl from "@/components/marker-panel/SegmentedControl";
import Toggle from "@/components/Toggle";
import { SliderField } from "@/components/GridPanel";
import {
  DEFAULT_SCALE,
  formatNumber,
  SCALE_LIMITS,
  SCALE_UNIT_LABELS,
  SCALE_UNITS,
  SUBDIVISIONS,
  unitSuffix,
  type ScaleStyle,
  type ScaleUnit,
} from "@/server/scale/scale-config";
import type { MeasureMode } from "./MeasureLayer";
import type { ScaleBarPatch, ScaleBarState } from "./use-map-scale-bar";

const STYLE_LABELS: Record<ScaleStyle, string> = { alternating: "Boxes", double: "Double", ticks: "Ticks", hollow: "Hollow" };

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
 * The Scale tool: calibrate the map (two points a known distance apart),
 * show and style the scale bar, and measure distances with the ruler. With
 * this panel open, the bar on the map can be dragged around.
 */
export default function ScalePanel({
  scaleBar,
  error,
  measureMode,
  onSetMeasureMode,
  onUpdate,
  onClose,
}: {
  scaleBar: ScaleBarState;
  error: string | null;
  measureMode: MeasureMode | null;
  onSetMeasureMode: (mode: MeasureMode | null) => void;
  onUpdate: (patch: ScaleBarPatch) => void;
  onClose: () => void;
}) {
  const { config, visible } = scaleBar;
  const calibrated = config.framePxPerUnit !== null;
  const suffix = unitSuffix(config);
  const set = (patch: ScaleBarPatch["config"]) => onUpdate({ config: patch });

  return (
    <div className="grid-panel scale-panel">
      <div className="marker-side-panel-header">
        <h2>
          <Ruler size={16} strokeWidth={2.25} style={{ verticalAlign: "-2px", marginRight: "6px" }} />
          Scale &amp; measure
        </h2>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close scale panel">
          <X size={16} strokeWidth={2.25} />
        </button>
      </div>

      <MarkerCard title="Calibration" defaultOpen>
        <p className="field-label">
          {calibrated
            ? `1 ${suffix} = ${formatNumber(config.framePxPerUnit!)} map pixels.`
            : "Tell the map how big it is: click two points a known distance apart (two cities, the ends of a road) and type that distance."}
        </p>
        <button
          type="button"
          className={measureMode === "calibrate" ? "btn btn-sm btn-primary" : "btn btn-sm"}
          aria-pressed={measureMode === "calibrate"}
          onClick={() => onSetMeasureMode(measureMode === "calibrate" ? null : "calibrate")}
        >
          <Crosshair size={14} strokeWidth={2.25} />
          {measureMode === "calibrate" ? "Cancel calibration" : calibrated ? "Recalibrate" : "Calibrate on the map"}
        </button>
      </MarkerCard>

      <MarkerCard title="Scale bar" defaultOpen>
        <Toggle checked={visible} disabled={!calibrated} onChange={(v) => onUpdate({ visible: v })} label="Show the scale bar" />
        {!calibrated && <p className="field-label">Calibrate first; the bar needs to know the distances.</p>}
        <label className="field-label" htmlFor="scale-unit">
          Unit
        </label>
        <select id="scale-unit" value={config.unit} onChange={(e) => set({ unit: e.target.value as ScaleUnit })}>
          {SCALE_UNITS.map((u) => (
            <option key={u} value={u}>
              {SCALE_UNIT_LABELS[u]}
            </option>
          ))}
        </select>
        {config.unit === "custom" && (
          <input type="text" aria-label="Custom unit name" placeholder="Unit name (e.g. days on foot)" maxLength={SCALE_LIMITS.customLabel} value={config.customLabel} onChange={(e) => set({ customLabel: e.target.value })} />
        )}
        <p className="field-label">Changing the unit doesn&rsquo;t convert the calibration: recalibrate if the distances change meaning.</p>
        <label className="field-label" htmlFor="scale-step">
          Each step ({suffix})
        </label>
        <StepInput value={config.stepValue} onChange={(stepValue) => set({ stepValue })} />
        <SliderField label="Steps" value={config.steps} min={SCALE_LIMITS.steps[0]} max={SCALE_LIMITS.steps[1]} defaultValue={DEFAULT_SCALE.steps} onChange={(steps) => set({ steps })} />
        <span className="field-label">Split the first step</span>
        <SegmentedControl
          ariaLabel="Split the first step"
          value={String(config.subdivideFirst)}
          segments={SUBDIVISIONS.map((n) => ({ key: String(n), label: n === 0 ? "No" : `${n}` }))}
          onChange={(key) => set({ subdivideFirst: Number(key) as (typeof SUBDIVISIONS)[number] })}
        />
        <Toggle checked={config.autoStep} onChange={(autoStep) => set({ autoStep })} label="Round the step when zooming" />
        <p className="field-label">When on, zooming far in or out picks a rounder step so the bar stays a readable size.</p>
      </MarkerCard>

      <MarkerCard title="Look">
        <span className="field-label">Style</span>
        <SegmentedControl ariaLabel="Bar style" value={config.style} segments={(Object.keys(STYLE_LABELS) as ScaleStyle[]).map((key) => ({ key, label: STYLE_LABELS[key] }))} onChange={(style) => set({ style })} />
        <span className="field-label">Color</span>
        <SegmentedControl
          ariaLabel="Bar color"
          value={config.tone}
          segments={[
            { key: "light", label: "Light" },
            { key: "dark", label: "Dark" },
          ]}
          onChange={(tone) => set({ tone })}
        />
        <SliderField label="Label size" value={config.labelSize} min={SCALE_LIMITS.labelSize[0]} max={SCALE_LIMITS.labelSize[1]} suffix="px" defaultValue={DEFAULT_SCALE.labelSize} onChange={(labelSize) => set({ labelSize })} />
        <Toggle checked={config.plate} onChange={(plate) => set({ plate })} label="Background plate" />
      </MarkerCard>

      <MarkerCard title="Measure" defaultOpen>
        <p className="field-label">Click points on the map to measure a path{calibrated ? ` in ${suffix}` : " (in map pixels until calibrated)"}.</p>
        <button
          type="button"
          className={measureMode === "measure" ? "btn btn-sm btn-primary" : "btn btn-sm"}
          aria-pressed={measureMode === "measure"}
          onClick={() => onSetMeasureMode(measureMode === "measure" ? null : "measure")}
        >
          <Ruler size={14} strokeWidth={2.25} />
          {measureMode === "measure" ? "Stop measuring" : "Measure distance"}
        </button>
      </MarkerCard>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
