import { normalizeColor, DEFAULT_COLOR } from "../markers/icon-registry";

export const GRID_SHAPES = [
  { key: "diamond", label: "Diamond" },
  { key: "square", label: "Square" },
  { key: "hexagon", label: "Hexagon" },
  { key: "hexagon-vertical", label: "Vertical Hexagon" },
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
  linkedColumnsRows: false,
  horizontalOffset: 0,
  verticalOffset: 0,
  opacity: 0.18,
  lineWidth: 0.3,
  color: DEFAULT_COLOR,
};

export const MAX_GRID_LINES = 300;

export function clampColumns(n: number): number {
  return Math.min(MAX_GRID_LINES, Math.max(1, Math.round(n)));
}

export function clampRows(n: number): number {
  return Math.min(MAX_GRID_LINES, Math.max(1, Math.round(n)));
}

/**
 * Ratio of tileHeight/tileWidth that makes one grid cell "regular" for a
 * given shape: an exact square for square/diamond, and a geometrically
 * regular hexagon for the two hex shapes (derived from the vertex math in
 * GridLayer's HexPatternContent/VerticalHexPatternContent).
 */
export function regularCellRatio(shape: GridShape): number {
  if (shape === "hexagon") return Math.sqrt(3) / 2;
  if (shape === "hexagon-vertical") return 2 / Math.sqrt(3);
  return 1;
}

/** Given a fixed columns count, the rows count that keeps cells regular. */
export function computeLinkedRows(columns: number, shape: GridShape, imageWidth: number, imageHeight: number): number {
  const ratio = regularCellRatio(shape);
  return clampRows((imageHeight * columns) / (imageWidth * ratio));
}

/** Given a fixed rows count, the columns count that keeps cells regular. */
export function computeLinkedColumns(rows: number, shape: GridShape, imageWidth: number, imageHeight: number): number {
  const ratio = regularCellRatio(shape);
  return clampColumns((imageWidth * rows * ratio) / imageHeight);
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
