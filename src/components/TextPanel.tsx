"use client";

import { useEffect, useRef, useState } from "react";
import { X, Type, Bold, Check, Trash2, AlignLeft, AlignCenter, AlignRight, MousePointerClick } from "lucide-react";
import ColorWheel from "./ColorWheel";
import FontPicker from "./FontPicker";
import { SliderField } from "./GridPanel";
import type { MapLayerData } from "./layer-images";
import LayerChecklist from "./LayerChecklist";
import type { MapTextData } from "./TextLayer";
import { LIMITS, type TextAlign, type TextStyle } from "@/server/texts/text-config";
import { COLOR_PRESETS, normalizeColor } from "@/server/markers/icon-registry";

export type TextDraft = TextStyle & { text: string };
export type TextPatch = Partial<TextDraft & { layerId: string; extraLayerIds: string[] }>;

function Swatches({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  return (
    <div className="color-swatch-row">
      {COLOR_PRESETS.map((c) => (
        <button
          key={c}
          type="button"
          className={normalizeColor(c) === value ? "color-swatch active" : "color-swatch"}
          style={{ background: c }}
          onClick={() => onChange(normalizeColor(c))}
          aria-label={`${label} ${c}`}
        />
      ))}
    </div>
  );
}

const ALIGNS: { key: TextAlign; label: string; Icon: typeof AlignLeft }[] = [
  { key: "left", label: "Left", Icon: AlignLeft },
  { key: "center", label: "Center", Icon: AlignCenter },
  { key: "right", label: "Right", Icon: AlignRight },
];

/**
 * Edits the selected map text live, or — with nothing selected — the style
 * the next placed text will use.
 */
export default function TextPanel({
  layerName,
  selected,
  draft,
  layers,
  placing,
  maxFontSize,
  onTogglePlacing,
  onChange,
  onDelete,
  onDone,
  onClose,
}: {
  /** Name of the active layer this tool edits. */
  layerName: string;
  selected: MapTextData | null;
  draft: TextDraft;
  layers: MapLayerData[];
  placing: boolean;
  maxFontSize: number;
  onTogglePlacing: () => void;
  onChange: (patch: TextPatch) => void;
  onDelete: () => void;
  onDone: () => void;
  onClose: () => void;
}) {
  const v: TextDraft = selected ?? draft;

  // Local textarea value: an empty text is never saved (the server rejects
  // it), but the user must still be able to clear the field while typing.
  const [textValue, setTextValue] = useState(v.text);
  const focusedRef = useRef(false);
  const sourceKey = selected?.id ?? "draft";
  useEffect(() => {
    if (!focusedRef.current) setTextValue(v.text);
  }, [sourceKey, v.text]);

  return (
    <div className="zones-panel zones-panel-editing text-panel">
      <div className="zones-panel-main">
        <div className="marker-side-panel-header">
          <h2>
            <Type size={16} strokeWidth={2.25} style={{ verticalAlign: "-2px", marginRight: "6px" }} />
            Text
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close text panel">
            <X size={16} strokeWidth={2.25} />
          </button>
        </div>
        <p className="panel-layer-label">Layer: {layerName}</p>

        <button type="button" className={placing ? "btn btn-primary" : "btn"} onClick={onTogglePlacing}>
          <MousePointerClick size={15} strokeWidth={2.25} />
          {placing ? "Click the map to place…" : "Place text"}
        </button>
        <p className="field-label zone-tool-hint">
          {selected
            ? "Editing the selected text. Drag it to move, the corners to scale, the round handle to rotate (Shift snaps)."
            : "These settings apply to the next text you place on the active layer. Click a text on the map to edit it."}
        </p>

        <label className="grid-field">
          <span className="field-label">Text</span>
          <textarea
            className="text-panel-textarea"
            rows={3}
            value={textValue}
            onFocus={() => {
              focusedRef.current = true;
            }}
            onBlur={() => {
              focusedRef.current = false;
              setTextValue(v.text);
            }}
            onChange={(e) => {
              setTextValue(e.target.value);
              if (e.target.value.trim()) onChange({ text: e.target.value });
            }}
          />
        </label>

        <div className="grid-field">
          <span className="field-label">Font</span>
          <div className="text-panel-font-row">
            <FontPicker value={v.fontKey} bold={v.bold} onChange={(fontKey) => onChange({ fontKey })} />
            <button
              type="button"
              className={v.bold ? "btn btn-icon active" : "btn btn-icon"}
              aria-pressed={v.bold}
              aria-label="Bold"
              title="Bold"
              onClick={() => onChange({ bold: !v.bold })}
            >
              <Bold size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <SliderField
          label="Size"
          value={Math.round(v.fontSize)}
          min={4}
          max={maxFontSize}
          defaultValue={Math.round(maxFontSize / 10)}
          suffix=" px"
          onChange={(fontSize) => onChange({ fontSize })}
        />
        <SliderField
          label="Rotation"
          value={Math.round(v.rotation)}
          min={-180}
          max={180}
          defaultValue={0}
          suffix="°"
          onChange={(rotation) => onChange({ rotation })}
        />

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
              alwaysDrawFlag="textsAlwaysVisible"
              onChange={(extraLayerIds) => onChange({ extraLayerIds })}
            />
          </>
        )}

        <SliderField label="Curve" value={v.curve} min={LIMITS.curve[0]} max={LIMITS.curve[1]} defaultValue={0} onChange={(curve) => onChange({ curve })} />
        <SliderField
          label="Letter spacing"
          value={v.letterSpacing}
          min={LIMITS.letterSpacing[0]}
          max={LIMITS.letterSpacing[1]}
          step={0.01}
          defaultValue={0}
          suffix=" em"
          onChange={(letterSpacing) => onChange({ letterSpacing })}
        />

        <div className="grid-field">
          <span className="field-label">Alignment</span>
          <div className="text-panel-align" role="group" aria-label="Alignment">
            {ALIGNS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                className={v.align === key ? "btn btn-sm active" : "btn btn-sm"}
                aria-pressed={v.align === key}
                onClick={() => onChange({ align: key })}
              >
                <Icon size={14} strokeWidth={2.25} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {selected && (
          <div className="text-panel-actions">
            <button type="button" className="btn btn-sm btn-primary" onClick={onDone}>
              <Check size={13} strokeWidth={2.25} />
              Done
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={onDelete}>
              <Trash2 size={13} strokeWidth={2.25} />
              Delete text
            </button>
          </div>
        )}
      </div>

      <div className="zones-panel-editor">
        <span className="field-label">Color</span>
        <ColorWheel value={v.color} onChange={(color) => onChange({ color })} />

        <label className="layer-checkbox">
          <input type="checkbox" checked={v.outlineEnabled} onChange={(e) => onChange({ outlineEnabled: e.target.checked })} />
          <span className="field-label">Outline</span>
        </label>
        {v.outlineEnabled && (
          <>
            <Swatches label="Outline color" value={v.outlineColor} onChange={(outlineColor) => onChange({ outlineColor })} />
            <SliderField
              label="Outline opacity"
              value={Math.round(v.outlineOpacity * 100)}
              min={0}
              max={100}
              defaultValue={80}
              suffix="%"
              onChange={(o) => onChange({ outlineOpacity: o / 100 })}
            />
            <SliderField
              label="Outline width"
              value={v.outlineWidth}
              min={LIMITS.outlineWidth[0]}
              max={LIMITS.outlineWidth[1]}
              step={0.01}
              defaultValue={0.08}
              suffix=" em"
              onChange={(outlineWidth) => onChange({ outlineWidth })}
            />
          </>
        )}

        <label className="layer-checkbox">
          <input type="checkbox" checked={v.shadowEnabled} onChange={(e) => onChange({ shadowEnabled: e.target.checked })} />
          <span className="field-label">Shadow</span>
        </label>
        {v.shadowEnabled && (
          <>
            <SliderField
              label="Shadow direction"
              value={Math.round(v.shadowAngle)}
              min={-180}
              max={180}
              defaultValue={45}
              suffix="°"
              onChange={(shadowAngle) => onChange({ shadowAngle })}
            />
            <SliderField
              label="Shadow distance"
              value={v.shadowDistance}
              min={LIMITS.shadowDistance[0]}
              max={LIMITS.shadowDistance[1]}
              step={0.01}
              defaultValue={0.08}
              suffix=" em"
              onChange={(shadowDistance) => onChange({ shadowDistance })}
            />
            <Swatches label="Shadow color" value={v.shadowColor} onChange={(shadowColor) => onChange({ shadowColor })} />
            <SliderField
              label="Shadow opacity"
              value={Math.round(v.shadowOpacity * 100)}
              min={0}
              max={100}
              defaultValue={60}
              suffix="%"
              onChange={(o) => onChange({ shadowOpacity: o / 100 })}
            />
          </>
        )}
      </div>
    </div>
  );
}
