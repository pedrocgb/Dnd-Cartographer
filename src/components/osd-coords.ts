import type OpenSeadragonType from "openseadragon";

export interface Pt {
  x: number;
  y: number;
}

/**
 * Coordinate helpers shared by the SVG overlay layers (zones, texts). All of
 * them use world item 0 — the map's frame — as the image-pixel reference.
 */

export function frameSize(viewer: OpenSeadragonType.Viewer | null): { w: number; h: number } | null {
  const tiledImage = viewer?.world.getItemAt(0);
  if (!tiledImage) return null;
  const size = tiledImage.getContentSize();
  return { w: size.x, h: size.y };
}

/** A pointer position (client pixels) in frame image pixels. */
export function clientToImagePoint(
  viewer: OpenSeadragonType.Viewer | null,
  osd: typeof OpenSeadragonType | null,
  clientX: number,
  clientY: number
): Pt | null {
  if (!viewer || !osd) return null;
  const tiledImage = viewer.world.getItemAt(0);
  if (!tiledImage) return null;
  const rect = viewer.container.getBoundingClientRect();
  const vp = viewer.viewport.pointFromPixel(new osd.Point(clientX - rect.left, clientY - rect.top));
  const img = tiledImage.viewportToImageCoordinates(vp);
  return { x: img.x, y: img.y };
}

/** CSS-pixel distance per one image-pixel unit, for screen-space tolerances (handle size, closure snap). */
export function screenPxPerImagePx(viewer: OpenSeadragonType.Viewer | null): number {
  if (!viewer) return 1;
  const tiledImage = viewer.world.getItemAt(0);
  if (!tiledImage) return 1;
  const p0 = viewer.viewport.pixelFromPoint(tiledImage.imageToViewportCoordinates(0, 0), true);
  const p1 = viewer.viewport.pixelFromPoint(tiledImage.imageToViewportCoordinates(100, 0), true);
  return Math.hypot(p1.x - p0.x, p1.y - p0.y) / 100;
}
