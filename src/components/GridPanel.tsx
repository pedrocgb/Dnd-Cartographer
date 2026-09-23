"use client";

import { useEffect, useRef, useState } from "react";
import { X, Diamond, Square, Hexagon, RotateCcw, Trash2, Grid3x3 } from "lucide-react";
import {
  GRID_SHAPES,
  DEFAULT_GRID,
  MAX_GRID_LINES,
  computeLinkedRows,
  computeLinkedColumns,
  type GridShape,
} from "@/server/grid/grid-config";
import { COLOR_PRESETS } from "@/server/markers/icon-registry";
import type { MapGrid } from "./GridLayer";

function VerticalHexagonIcon({ size = 16, strokeWidth = 2.25 }: { size?: number; strokeWidth?: number }) {
  return (
    <Hexagon
      size={size}
      strokeWidth={strokeWidth}
      style={{ transform: "rotate(90deg)" }}
    />
  );
}

const SHAPE_ICONS: Record<GridShape, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  diamond: Diamond,
  square: Square,
  hexagon: Hexagon,
  "hexagon-vertical": VerticalHexagonIcon,
};

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  // Round to 2 decimals (not a fixed 1) so small values like 0.05 remain
  // visible instead of collapsing to "0.1"/"0.0" — trailing zeros are
  // naturally dropped by the Number->String conversion.
  const formatValue = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));
  const [text, setText] = useState(() => formatValue(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setText(formatValue(value));
  }, [value]);

  function commit(raw: string) {
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      setText(formatValue(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    onChange(clamped);
    setText(formatValue(clamped));
  }

  return (
    <div className="grid-field">
      <div className="grid-field-header">
        <span className="field-label">{label}</span>
        <button
          className="btn btn-ghost btn-icon-xs"
          onClick={() => onChange(defaultValue)}
          aria-label={`Reset ${label.toLowerCase()}`}
          title={`Reset ${label.toLowerCase()}`}
        >
          <RotateCcw size={12} strokeWidth={2.25} />
        </button>
        <span className="grid-field-value">
          <input
            type="number"
            className="grid-field-value-input"
            value={text}
            min={min}
            max={max}
            step={step}
            aria-label={`${label} value`}
            onFocus={() => {
              focusedRef.current = true;
            }}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => {
              focusedRef.current = false;
              commit(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          {suffix ?? ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

type GridPatch = Partial<
  Pick<
    MapGrid,
    "shape" | "columns" | "rows" | "linkedColumnsRows" | "horizontalOffset" | "verticalOffset" | "opacity" | "lineWidth" | "color"
  >
>;

export default function GridPanel({
  layerName,
  grid,
  onUpdate,
  onDelete,
  onClose,
  imageWidth,
  imageHeight,
}: {
  /** Name of the active layer this tool edits. */
  layerName: string;
  grid: MapGrid;
  onUpdate: (patch: GridPatch) => void;
  onDelete: () => void;
  onClose: () => void;
  imageWidth: number;
  imageHeight: number;
}) {
  function updateShape(shape: GridShape) {
    if (grid.linkedColumnsRows) {
      onUpdate({ shape, rows: computeLinkedRows(grid.columns, shape, imageWidth, imageHeight) });
    } else {
      onUpdate({ shape });
    }
  }

  function updateColumns(columns: number) {
    if (grid.linkedColumnsRows) {
      onUpdate({ columns, rows: computeLinkedRows(columns, grid.shape as GridShape, imageWidth, imageHeight) });
    } else {
      onUpdate({ columns });
    }
  }

  function updateRows(rows: number) {
    if (grid.linkedColumnsRows) {
      onUpdate({ rows, columns: computeLinkedColumns(rows, grid.shape as GridShape, imageWidth, imageHeight) });
    } else {
      onUpdate({ rows });
    }
  }

  function toggleLinked(linked: boolean) {
    if (linked) {
      onUpdate({
        linkedColumnsRows: true,
        rows: computeLinkedRows(grid.columns, grid.shape as GridShape, imageWidth, imageHeight),
      });
    } else {
      onUpdate({ linkedColumnsRows: false });
    }
  }

  return (
    <div className="grid-panel">
      <div className="marker-side-panel-header">
        <h2>
          <Grid3x3 size={16} strokeWidth={2.25} style={{ verticalAlign: "-2px", marginRight: "6px" }} />
          Grid
        </h2>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close grid panel">
          <X size={16} strokeWidth={2.25} />
        </button>
      </div>
      <p className="panel-layer-label">Layer: {layerName}</p>

      <span className="field-label">Shape</span>
      <div className="grid-shape-row">
        {GRID_SHAPES.map((shape) => {
          const Icon = SHAPE_ICONS[shape.key];
          return (
            <button
              key={shape.key}
              className={grid.shape === shape.key ? "active" : ""}
              title={shape.label}
              aria-label={shape.label}
              aria-pressed={grid.shape === shape.key}
              onClick={() => updateShape(shape.key)}
            >
              <Icon size={16} strokeWidth={2.25} />
            </button>
          );
        })}
      </div>

      <label className="grid-linked-toggle">
        <input
          type="checkbox"
          checked={grid.linkedColumnsRows}
          onChange={(e) => toggleLinked(e.target.checked)}
        />
        <span>Linked Columns and Rows</span>
      </label>

      <SliderField
        label="Columns"
        value={grid.columns}
        min={1}
        max={MAX_GRID_LINES}
        defaultValue={DEFAULT_GRID.columns}
        onChange={updateColumns}
      />
      <SliderField
        label="Rows"
        value={grid.rows}
        min={1}
        max={MAX_GRID_LINES}
        defaultValue={DEFAULT_GRID.rows}
        onChange={updateRows}
      />
      <SliderField
        label="Horizontal Offset"
        value={grid.horizontalOffset}
        min={-100}
        max={100}
        defaultValue={DEFAULT_GRID.horizontalOffset}
        onChange={(horizontalOffset) => onUpdate({ horizontalOffset })}
      />
      <SliderField
        label="Vertical Offset"
        value={grid.verticalOffset}
        min={-100}
        max={100}
        defaultValue={DEFAULT_GRID.verticalOffset}
        onChange={(verticalOffset) => onUpdate({ verticalOffset })}
      />
      <SliderField
        label="Opacity"
        value={Math.round(grid.opacity * 100)}
        min={0}
        max={100}
        suffix="%"
        defaultValue={Math.round(DEFAULT_GRID.opacity * 100)}
        onChange={(pct) => onUpdate({ opacity: pct / 100 })}
      />
      <SliderField
        label="Width"
        value={grid.lineWidth}
        min={0}
        max={5}
        step={0.1}
        defaultValue={DEFAULT_GRID.lineWidth}
        onChange={(lineWidth) => onUpdate({ lineWidth })}
      />

      <span className="field-label">Color</span>
      <div className="color-swatch-row">
        {COLOR_PRESETS.map((color) => (
          <button
            key={color}
            className={color === grid.color ? "color-swatch active" : "color-swatch"}
            style={{ background: color }}
            onClick={() => onUpdate({ color })}
            aria-label={`Grid color ${color}`}
            aria-pressed={color === grid.color}
          />
        ))}
      </div>

      <button className="btn btn-danger" onClick={onDelete}>
        <Trash2 size={15} strokeWidth={2.25} />
        Delete Grid
      </button>
    </div>
  );
}
