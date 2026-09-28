/**
 * The map frame is the coordinate box every map item is stored in (marker
 * u/v as fractions of it; zones, texts and lines in its pixels; grids span
 * it). Layer images are placed on it by offset and scale, so one can reach
 * past it — and whatever lies outside can't hold a grid or items. The frame
 * therefore grows to cover every layer image; growing left or up moves its
 * origin, so every stored coordinate shifts with it and nothing moves on
 * screen. It never shrinks.
 */

export interface Frame {
  width: number;
  height: number;
}

/** A layer image's placement (frame widths, like map_layers) and its pixel size. */
export interface PlacedImage {
  imageX: number;
  imageY: number;
  imageScale: number;
  assetWidth: number;
  assetHeight: number;
}

/** The grown frame, and how far the old origin moves inside it (frame pixels, never negative). */
export interface FrameGrowth {
  width: number;
  height: number;
  dx: number;
  dy: number;
}

/** Rounding noise in stored placements must not grow the frame by a pixel. */
const EPSILON_PX = 0.5;

/** How the frame must grow to cover every image, or null when it already does. */
export function planFrameGrowth(frame: Frame, images: PlacedImage[]): FrameGrowth | null {
  let minX = 0;
  let minY = 0;
  let maxX = frame.width;
  let maxY = frame.height;
  for (const img of images) {
    if (!(img.assetWidth > 0 && img.assetHeight > 0)) continue;
    const left = img.imageX * frame.width;
    const top = img.imageY * frame.width;
    const width = img.imageScale * frame.width;
    const height = (width * img.assetHeight) / img.assetWidth;
    minX = Math.min(minX, left);
    minY = Math.min(minY, top);
    maxX = Math.max(maxX, left + width);
    maxY = Math.max(maxY, top + height);
  }
  const dx = minX < -EPSILON_PX ? Math.ceil(-minX) : 0;
  const dy = minY < -EPSILON_PX ? Math.ceil(-minY) : 0;
  const width = maxX > frame.width + EPSILON_PX ? Math.ceil(maxX + dx) : frame.width + dx;
  const height = maxY > frame.height + EPSILON_PX ? Math.ceil(maxY + dy) : frame.height + dy;
  if (width === frame.width && height === frame.height) return null;
  return { width, height, dx, dy };
}

/** A marker's u/v on the grown frame (same spot on screen). */
export function growMarkerUV(frame: Frame, g: FrameGrowth, u: number, v: number): { u: number; v: number } {
  return { u: (u * frame.width + g.dx) / g.width, v: (v * frame.height + g.dy) / g.height };
}

/** A layer image's placement on the grown frame (its units are frame widths, which changed). */
export function growImagePlacement(frame: Frame, g: FrameGrowth, p: { imageX: number; imageY: number; imageScale: number }) {
  return {
    imageX: (p.imageX * frame.width + g.dx) / g.width,
    imageY: (p.imageY * frame.width + g.dy) / g.width,
    imageScale: (p.imageScale * frame.width) / g.width,
  };
}

interface GridFit {
  columns: number;
  rows: number;
  horizontalOffset: number;
  verticalOffset: number;
}

/**
 * A grid on the grown frame: about the same cell size (columns/rows are whole
 * numbers, capped at maxLines) with its lines kept where they were. Offsets
 * are percents of a cell.
 */
export function growGrid(frame: Frame, g: FrameGrowth, grid: GridFit, maxLines: number): GridFit {
  const axis = (count: number, offsetPct: number, oldSize: number, newSize: number, shift: number) => {
    const cell = oldSize / count;
    const nextCount = Math.min(maxLines, Math.max(1, Math.round(newSize / cell)));
    const nextCell = newSize / nextCount;
    const origin = (((offsetPct / 100) * cell + shift) % nextCell + nextCell) % nextCell;
    return { count: nextCount, offset: (origin / nextCell) * 100 };
  };
  const h = axis(grid.columns, grid.horizontalOffset, frame.width, g.width, g.dx);
  const v = axis(grid.rows, grid.verticalOffset, frame.height, g.height, g.dy);
  return { columns: h.count, rows: v.count, horizontalOffset: h.offset, verticalOffset: v.offset };
}
