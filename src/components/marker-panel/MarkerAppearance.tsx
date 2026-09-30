"use client";

import { useState } from "react";
import { ChevronDown, Pipette } from "lucide-react";
import MarkerIcon, { RawIcon } from "../MarkerIcon";
import IconPicker from "../IconPicker";
import ColorWheel from "../ColorWheel";
import SegmentedControl from "./SegmentedControl";
import { BACKGROUND_SHAPES, COLOR_PRESETS, ICONS, IMPORTANCE_LEVELS, LABEL_MODES } from "@/server/markers/icon-registry";
import type { Marker } from "../MarkerLayer";
import type { MarkerPatch, MarkerUpdate } from "./types";

type ColorTarget = "color" | "backgroundColor" | "outlineColor";

const COLOR_TARGETS: { key: ColorTarget; label: string }[] = [
  { key: "color", label: "Icon" },
  { key: "backgroundColor", label: "Fill" },
  { key: "outlineColor", label: "Outline" },
];

function colorPatch(target: ColorTarget, hex: string): MarkerPatch {
  if (target === "backgroundColor") return { backgroundColor: hex };
  if (target === "outlineColor") return { outlineColor: hex };
  return { color: hex };
}

const iconLabel = (key: string) => ICONS.find((i) => i.key === key)?.label ?? "Icon";

/** The shape strip: each option is a live mini pin in the marker's own colors. */
function ShapeStrip({ marker, onUpdate }: { marker: Marker; onUpdate: MarkerUpdate }) {
  return (
    <SegmentedControl
      ariaLabel="Shape"
      value={marker.backgroundShape}
      onChange={(backgroundShape) => onUpdate({ backgroundShape })}
      segments={BACKGROUND_SHAPES.map((s) => ({
        key: s.key,
        label: s.label,
        icon: (
          <span className="marker-shape-option">
            <MarkerIcon
              iconKey={marker.iconKey}
              color={marker.color}
              backgroundColor={marker.backgroundColor}
              outlineColor={marker.outlineColor}
              backgroundShape={s.key}
              size={10}
            />
          </span>
        ),
      }))}
    />
  );
}

/** One color row for whichever part (icon, fill, outline) is targeted, plus a custom color wheel. */
function ColorPicker({ marker, onUpdate }: { marker: Marker; onUpdate: MarkerUpdate }) {
  const bare = marker.backgroundShape === "none";
  const [picked, setTarget] = useState<ColorTarget>("color");
  const target = bare ? "color" : picked;
  const [wheelOpen, setWheelOpen] = useState(false);
  const current = marker[target];
  const custom = !(COLOR_PRESETS as readonly string[]).includes(current);

  return (
    <div className="marker-color-picker">
      <SegmentedControl
        ariaLabel="Color of"
        value={target}
        onChange={setTarget}
        segments={COLOR_TARGETS.map((t) => ({
          key: t.key,
          label: t.label,
          disabled: bare && t.key !== "color",
          icon: (
            <span className="marker-color-target">
              <span className="marker-color-dot" style={{ background: marker[t.key] }} />
              {t.label}
            </span>
          ),
        }))}
      />
      <div className="color-swatch-row">
        {COLOR_PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            className={color === current ? "color-swatch active" : "color-swatch"}
            style={{ background: color }}
            onClick={() => onUpdate(colorPatch(target, color))}
            aria-label={`${COLOR_TARGETS.find((t) => t.key === target)!.label} color ${color}`}
            aria-pressed={color === current}
          />
        ))}
        <button
          type="button"
          className={custom || wheelOpen ? "color-swatch color-swatch-custom active" : "color-swatch color-swatch-custom"}
          aria-label="Custom color"
          aria-expanded={wheelOpen}
          data-tooltip="Custom color"
          onClick={() => setWheelOpen((o) => !o)}
        >
          <Pipette size={12} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
      {wheelOpen && <ColorWheel key={target} value={current} onChange={(hex) => onUpdate(colorPatch(target, hex))} />}
    </div>
  );
}

/**
 * The marker panel's Appearance card: a live preview, the shape strip, the
 * icon (grid opened on demand), colors, size and label mode — every choice
 * visible at once instead of behind dropdowns.
 */
export default function MarkerAppearance({ marker, onUpdate }: { marker: Marker; onUpdate: MarkerUpdate }) {
  const [iconsOpen, setIconsOpen] = useState(false);

  return (
    <section className="marker-card" aria-labelledby="marker-appearance-title">
      <h3 id="marker-appearance-title" className="marker-card-title">
        Appearance
      </h3>

      <div className="marker-appearance-top">
        <div className="marker-preview" aria-hidden="true">
          <MarkerIcon
            iconKey={marker.iconKey}
            color={marker.color}
            backgroundColor={marker.backgroundColor}
            outlineColor={marker.outlineColor}
            backgroundShape={marker.backgroundShape}
            size={26}
          />
        </div>
        <div className="marker-appearance-fields">
          <span className="field-label">Shape</span>
          <ShapeStrip marker={marker} onUpdate={onUpdate} />
        </div>
      </div>

      <button type="button" className="marker-icon-toggle" aria-expanded={iconsOpen} onClick={() => setIconsOpen((o) => !o)}>
        <span className="marker-icon-toggle-glyph">
          <RawIcon iconKey={marker.iconKey} size={16} aria-hidden="true" />
        </span>
        <span className="marker-icon-toggle-text">
          <span className="field-label">Icon</span>
          <span>{iconLabel(marker.iconKey)}</span>
        </span>
        <ChevronDown size={14} strokeWidth={2.25} className={iconsOpen ? "marker-collapsible-chevron open-down" : "marker-collapsible-chevron"} />
      </button>
      {iconsOpen && <IconPicker value={marker.iconKey} onChange={(iconKey) => onUpdate({ iconKey })} />}

      <div className="marker-field">
        <span className="field-label">Colors</span>
        <ColorPicker marker={marker} onUpdate={onUpdate} />
      </div>

      <div className="marker-field">
        <span className="field-label">Size</span>
        <SegmentedControl
          ariaLabel="Size"
          value={marker.importance}
          onChange={(importance) => onUpdate({ importance })}
          segments={IMPORTANCE_LEVELS.map((l) => ({ key: l.key, label: l.label }))}
        />
      </div>
      <div className="marker-field">
        <span className="field-label">Name on map</span>
        <SegmentedControl
          ariaLabel="Name on map"
          value={marker.labelMode}
          onChange={(labelMode) => onUpdate({ labelMode })}
          segments={LABEL_MODES.map((m) => ({ key: m.key, label: m.label }))}
        />
      </div>
    </section>
  );
}
