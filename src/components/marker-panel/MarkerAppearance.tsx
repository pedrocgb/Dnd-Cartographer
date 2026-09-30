"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import MarkerIcon, { RawIcon, ShapeSilhouette } from "../MarkerIcon";
import IconPicker from "../IconPicker";
import ColorWheel from "../ColorWheel";
import SegmentedControl from "./SegmentedControl";
import MarkerCard from "./MarkerCard";
import { BACKGROUND_SHAPES, COLOR_PRESETS, ICONS, IMPORTANCE_LEVELS, LABEL_MODES, importanceSize } from "@/server/markers/icon-registry";
import type { Marker } from "../MarkerLayer";
import type { MarkerPatch, MarkerUpdate } from "./types";

type ColorTarget = "color" | "backgroundColor" | "outlineColor";

const COLOR_ROWS: { key: ColorTarget; label: string }[] = [
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

/** One inspector row: a fixed-width label, then its control. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="marker-prop">
      <span className="marker-prop-label">{label}</span>
      <div className="marker-prop-control">{children}</div>
    </div>
  );
}

/** The marker as the map will draw it — its size and its name as the label mode shows it — on a map-like backdrop. */
function Preview({ marker }: { marker: Marker }) {
  return (
    <div className="marker-preview" aria-hidden="true">
      <div className="marker-preview-pin">
        <MarkerIcon
          iconKey={marker.iconKey}
          color={marker.color}
          backgroundColor={marker.backgroundColor}
          outlineColor={marker.outlineColor}
          backgroundShape={marker.backgroundShape}
          size={importanceSize(marker.importance)}
        />
        {marker.labelMode === "always" && <span className="marker-preview-label">{marker.name}</span>}
      </div>
    </div>
  );
}

/** A color row: the current color as a button; opening it shows the presets and a custom wheel below. */
function ColorRow({
  target,
  label,
  marker,
  open,
  disabled,
  onToggle,
  onUpdate,
}: {
  target: ColorTarget;
  label: string;
  marker: Marker;
  open: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onUpdate: MarkerUpdate;
}) {
  const current = marker[target];
  return (
    <>
      <Row label={label}>
        <button type="button" className="marker-color-value" aria-expanded={open} disabled={disabled} onClick={onToggle}>
          <span className="marker-color-dot" style={{ background: current }} />
          <span className="marker-color-hex">{current}</span>
          <ChevronDown size={14} strokeWidth={2.25} className={open ? "marker-collapsible-chevron open-down" : "marker-collapsible-chevron"} />
        </button>
      </Row>
      {open && (
        <div className="marker-color-palette">
          <div className="color-swatch-row">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                className={color === current ? "color-swatch active" : "color-swatch"}
                style={{ background: color }}
                onClick={() => onUpdate(colorPatch(target, color))}
                aria-label={`${label} color ${color}`}
                aria-pressed={color === current}
              />
            ))}
          </div>
          <ColorWheel value={current} onChange={(hex) => onUpdate(colorPatch(target, hex))} />
        </div>
      )}
    </>
  );
}

/**
 * The marker panel's Appearance card, laid out as an inspector: a live
 * preview on top, then one labelled row per property — shape silhouettes,
 * the icon (grid opened on demand), the three colors (palette opened on
 * demand, one at a time), size and label mode.
 */
export default function MarkerAppearance({ marker, onUpdate }: { marker: Marker; onUpdate: MarkerUpdate }) {
  const [iconsOpen, setIconsOpen] = useState(false);
  const [openColor, setOpenColor] = useState<ColorTarget | null>(null);
  const bare = marker.backgroundShape === "none";

  return (
    <MarkerCard title="Appearance">
      <Preview marker={marker} />

      <Row label="Shape">
        <SegmentedControl
          ariaLabel="Shape"
          value={marker.backgroundShape}
          onChange={(backgroundShape) => onUpdate({ backgroundShape })}
          segments={BACKGROUND_SHAPES.map((s) => ({ key: s.key, label: s.label, icon: <ShapeSilhouette shape={s.key} size={16} /> }))}
        />
      </Row>

      <Row label="Icon">
        <button type="button" className="marker-color-value" aria-expanded={iconsOpen} onClick={() => setIconsOpen((o) => !o)}>
          <RawIcon iconKey={marker.iconKey} size={15} aria-hidden="true" />
          <span className="marker-color-hex">{iconLabel(marker.iconKey)}</span>
          <ChevronDown size={14} strokeWidth={2.25} className={iconsOpen ? "marker-collapsible-chevron open-down" : "marker-collapsible-chevron"} />
        </button>
      </Row>
      {iconsOpen && (
        <div className="marker-color-palette">
          <IconPicker value={marker.iconKey} onChange={(iconKey) => onUpdate({ iconKey })} />
        </div>
      )}

      {COLOR_ROWS.map((row) => (
        <ColorRow
          key={row.key}
          target={row.key}
          label={row.label}
          marker={marker}
          open={openColor === row.key && !(bare && row.key !== "color")}
          disabled={bare && row.key !== "color"}
          onToggle={() => setOpenColor((c) => (c === row.key ? null : row.key))}
          onUpdate={onUpdate}
        />
      ))}

      <Row label="Size">
        <SegmentedControl
          ariaLabel="Size"
          value={marker.importance}
          onChange={(importance) => onUpdate({ importance })}
          segments={IMPORTANCE_LEVELS.map((l) => ({ key: l.key, label: l.label }))}
        />
      </Row>
      <Row label="Label">
        <SegmentedControl
          ariaLabel="Name on map"
          value={marker.labelMode}
          onChange={(labelMode) => onUpdate({ labelMode })}
          segments={LABEL_MODES.map((m) => ({ key: m.key, label: m.key === "hover" ? "Hover" : m.label }))}
        />
      </Row>
    </MarkerCard>
  );
}
