"use client";

import { X, PenTool, Pencil, Spline, Check, Trash2 } from "lucide-react";
import ColorWheel from "./ColorWheel";
import { SliderField } from "./GridPanel";
import type { MapLayerData } from "./layer-images";
import LayerChecklist from "./LayerChecklist";
import type { MapLineData } from "./LineLayer";
import { LINE_LIMITS, type LineCap, type LineKind, type LineStyle, type LineStyleKind } from "@/server/lines/line-config";
import { COLOR_PRESETS, normalizeColor } from "@/server/markers/icon-registry";

export type LinePatch = Partial<LineStyle & { layerId: string; extraLayerIds: string[] }>;

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid-field">
      <span className="field-label">{label}</span>
      <div className="line-panel-segmented" role="group" aria-label={label} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            className={value === o.key ? "btn btn-sm active" : "btn btn-sm"}
            aria-pressed={value === o.key}
            onClick={() => onChange(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const STYLE_OPTIONS: { key: LineStyleKind; label: string }[] = [
  { key: "solid", label: "Solid" },
  { key: "dot", label: "Dot" },
  { key: "dashed", label: "Dashed" },
];
const CAP_OPTIONS: { key: LineCap; label: string }[] = [
  { key: "round", label: "Circle" },
  { key: "square", label: "Square" },
];

/**
 * Edits the selected line live, or — with nothing selected — the style the
 * next drawn line will use.
 */
export default function LinePanel({
  layerName,
  selected,
  draft,
  layers,
  mode,
  drawing,
  maxWidth,
  onSetMode,
  onToggleDrawing,
  onChange,
  onDelete,
  onDone,
  onClose,
}: {
  /** Name of the active layer this tool edits. */
  layerName: string;
  selected: MapLineData | null;
  draft: LineStyle;
  layers: MapLayerData[];
  mode: LineKind;
  drawing: boolean;
  maxWidth: number;
  onSetMode: (mode: LineKind) => void;
  onToggleDrawing: () => void;
  onChange: (patch: LinePatch) => void;
  onDelete: () => void;
  onDone: () => void;
  onClose: () => void;
}) {
  const v: LineStyle = selected ?? draft;

  return (
    <div className="layers-panel line-panel">
      <div className="marker-side-panel-header">
        <h2>
          <PenTool size={16} strokeWidth={2.25} style={{ verticalAlign: "-2px", marginRight: "6px" }} />
          Lines
        </h2>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close lines panel">
          <X size={16} strokeWidth={2.25} />
        </button>
      </div>
      <p className="panel-layer-label">Layer: {layerName}</p>

      <div className="line-panel-segmented" role="group" aria-label="Drawing mode" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <button type="button" className={mode === "free" ? "btn btn-sm active" : "btn btn-sm"} aria-pressed={mode === "free"} onClick={() => onSetMode("free")}>
          <Pencil size={13} strokeWidth={2.25} />
          Free draw
        </button>
        <button type="button" className={mode === "pen" ? "btn btn-sm active" : "btn btn-sm"} aria-pressed={mode === "pen"} onClick={() => onSetMode("pen")}>
          <Spline size={13} strokeWidth={2.25} />
          Pen
        </button>
      </div>
      <button type="button" className={drawing ? "btn btn-primary" : "btn"} onClick={onToggleDrawing}>
        <PenTool size={15} strokeWidth={2.25} />
        {drawing ? "Drawing… (click to stop)" : "Draw line"}
      </button>
      <p className="field-label zone-tool-hint">
        {drawing
          ? mode === "pen"
            ? "Click = corner, click-and-drag = curve, hold Shift for straight/45° segments. Right-click (or Enter) finishes, Backspace removes the last point, Esc cancels. Click an existing line (before placing a point) to edit it."
            : "Hold the left button and drag to draw. Click an existing line to edit it instead."
          : selected
            ? "Editing the selected line: changes apply to it. Drag it to move it."
            : "These settings apply to the next line you draw on the active layer. Click a line on the map to edit it."}
      </p>

      <span className="field-label">Color</span>
      <ColorWheel value={v.color} onChange={(color) => onChange({ color })} />

      <SliderField label="Size" value={v.width} min={0.5} max={maxWidth} step={0.5} defaultValue={draft.width} suffix=" px" onChange={(width) => onChange({ width })} />
      <SliderField label="Opacity" value={Math.round(v.opacity * 100)} min={0} max={100} defaultValue={100} suffix="%" onChange={(o) => onChange({ opacity: o / 100 })} />

      <Segmented label="Line style" value={v.style} options={STYLE_OPTIONS} onChange={(style) => onChange({ style })} />
      {v.style === "dashed" && (
        <SliderField
          label="Dash length"
          value={v.dashLength}
          min={LINE_LIMITS.dashLength[0]}
          max={LINE_LIMITS.dashLength[1]}
          step={0.1}
          defaultValue={3}
          suffix="×"
          onChange={(dashLength) => onChange({ dashLength })}
        />
      )}
      {v.style !== "solid" && (
        <SliderField
          label="Gap length"
          value={v.gapLength}
          min={LINE_LIMITS.gapLength[0]}
          max={LINE_LIMITS.gapLength[1]}
          step={0.1}
          defaultValue={2}
          suffix="×"
          onChange={(gapLength) => onChange({ gapLength })}
        />
      )}
      <Segmented label="Line cap" value={v.cap} options={CAP_OPTIONS} onChange={(cap) => onChange({ cap })} />

      <label className="layer-checkbox">
        <input type="checkbox" checked={v.shadowEnabled} onChange={(e) => onChange({ shadowEnabled: e.target.checked })} />
        <span className="field-label">Shadow</span>
      </label>
      {v.shadowEnabled && (
        <>
          <div className="color-swatch-row">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                className={normalizeColor(c) === v.shadowColor ? "color-swatch active" : "color-swatch"}
                style={{ background: c }}
                onClick={() => onChange({ shadowColor: normalizeColor(c) })}
                aria-label={`Shadow color ${c}`}
              />
            ))}
          </div>
          <SliderField label="Shadow opacity" value={Math.round(v.shadowOpacity * 100)} min={0} max={100} defaultValue={50} suffix="%" onChange={(o) => onChange({ shadowOpacity: o / 100 })} />
          <SliderField
            label="Shadow blur"
            value={v.shadowBlur}
            min={LINE_LIMITS.shadowBlur[0]}
            max={LINE_LIMITS.shadowBlur[1]}
            step={0.1}
            defaultValue={0.5}
            suffix="×"
            onChange={(shadowBlur) => onChange({ shadowBlur })}
          />
          <SliderField
            label="Shadow offset"
            value={v.shadowDistance}
            min={LINE_LIMITS.shadowDistance[0]}
            max={LINE_LIMITS.shadowDistance[1]}
            step={0.1}
            defaultValue={0.5}
            suffix="×"
            onChange={(shadowDistance) => onChange({ shadowDistance })}
          />
          <SliderField label="Shadow position" value={Math.round(v.shadowAngle)} min={-180} max={180} defaultValue={45} suffix="°" onChange={(shadowAngle) => onChange({ shadowAngle })} />
        </>
      )}

      {selected && (
        <>
          <label className="grid-field">
            <span className="field-label">Layer</span>
            <select value={selected.layerId ?? ""} onChange={(e) => e.target.value && onChange({ layerId: e.target.value })} aria-label="Layer">
              {layers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <LayerChecklist
            layers={layers}
            homeLayerId={selected.layerId}
            value={selected.extraLayerIds ?? []}
            alwaysDrawFlag="linesAlwaysVisible"
            onChange={(extraLayerIds) => onChange({ extraLayerIds })}
          />
          <div className="text-panel-actions">
            <button type="button" className="btn btn-sm btn-primary" onClick={onDone}>
              <Check size={13} strokeWidth={2.25} />
              Done
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={onDelete}>
              <Trash2 size={13} strokeWidth={2.25} />
              Delete line
            </button>
          </div>
        </>
      )}
    </div>
  );
}
