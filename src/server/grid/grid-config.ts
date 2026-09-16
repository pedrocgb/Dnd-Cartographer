import { normalizeColor, DEFAULT_COLOR } from "../markers/icon-registry";

export const GRID_SHAPES = [
  { key: "diamond", label: "Diamond" },
  { key: "square", label: "Square" },
  { key: "circle", label: "Circle" },
  { key: "hexagon", label: "Hexagon" },
] as const;

export type GridShape = (typeof GRID_SHAPES)[number]["key"];

const GRID_SHAPE_KEYS = new Set<string>(GRID_SHAPES.map((s) => s.key));

export function isValidGridShape(key: string): key is GridShape {
  return GRID_SHAPE_KEYS.has(key);
}

export const DEFAULT_GRID = {
  shape: "square" as GridShape,
  columns: 100,
  rows: 100,
  horizontalOffset: 0,
  verticalOffset: 0,
  opacity: 0.18,
  lineWidth: 0.3,
  color: DEFAULT_COLOR,
};

export function clampColumns(n: number): number {
  return Math.min(200, Math.max(1, Math.round(n)));
}

export function clampRows(n: number): number {
  return Math.min(200, Math.max(1, Math.round(n)));
}

export function clampOffset(n: number): number {
  return Math.min(100, Math.max(-100, n));
}

export function clampOpacity(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function clampLineWidth(n: number): number {
  return Math.min(5, Math.max(0, n));
}

export { normalizeColor, DEFAULT_COLOR };
