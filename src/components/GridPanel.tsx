"use client";

import { X, Diamond, Square, Circle, Hexagon, RotateCcw, Trash2, Grid3x3 } from "lucide-react";
import { GRID_SHAPES, DEFAULT_GRID, type GridShape } from "@/server/grid/grid-config";
import { COLOR_PRESETS } from "@/server/markers/icon-registry";
import type { MapGrid } from "./GridLayer";

const SHAPE_ICONS: Record<GridShape, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  diamond: Diamond,
  square: Square,
  circle: Circle,
  hexagon: Hexagon,
};

function SliderField({
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
          {Number.isInteger(value) ? value : value.toFixed(1)}
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

export default function GridPanel({
  grid,
  onUpdate,
  onDelete,
  onClose,
}: {
  grid: MapGrid;
  onUpdate: (patch: Partial<Pick<MapGrid, "shape" | "columns" | "rows" | "horizontalOffset" | "verticalOffset" | "opacity" | "lineWidth" | "color">>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
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
              onClick={() => onUpdate({ shape: shape.key })}
            >
              <Icon size={16} strokeWidth={2.25} />
            </button>
          );
        })}
      </div>

      <SliderField
        label="Columns"
        value={grid.columns}
        min={1}
        max={200}
        defaultValue={DEFAULT_GRID.columns}
        onChange={(columns) => onUpdate({ columns })}
      />
      <SliderField
        label="Rows"
        value={grid.rows}
        min={1}
        max={200}
        defaultValue={DEFAULT_GRID.rows}
        onChange={(rows) => onUpdate({ rows })}
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
