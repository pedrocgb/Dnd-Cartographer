"use client";

import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import type OpenSeadragonType from "openseadragon";

export interface MapGrid {
  id: string;
  mapId: string;
  shape: string;
  columns: number;
  rows: number;
  horizontalOffset: number;
  verticalOffset: number;
  opacity: number;
  lineWidth: number;
  color: string;
}

/**
 * A flat-top hexagon inscribed in a (w, h) box. Adjacent hex columns are
 * spaced `0.75w` apart (not a full `w`) and offset vertically by `0.5h`,
 * which is why the pattern tile below is `1.5w` wide (two columns' worth)
 * rather than a single `w`-wide repeat — the naive single-hex/single-width
 * tile is what produced the disconnected zigzag seen before this fix.
 */
function HexPatternContent({ w, h, color, lineWidth }: { w: number; h: number; color: string; lineWidth: number }) {
  const points = (ox: number, oy: number) =>
    [
      [ox + w * 0.25, oy],
      [ox + w * 0.75, oy],
      [ox + w, oy + h * 0.5],
      [ox + w * 0.75, oy + h],
      [ox + w * 0.25, oy + h],
      [ox, oy + h * 0.5],
    ]
      .map((p) => p.join(","))
      .join(" ");

  return (
    <>
      <polygon points={points(0, 0)} fill="none" stroke={color} strokeWidth={lineWidth} />
      <polygon points={points(w * 0.75, h * 0.5)} fill="none" stroke={color} strokeWidth={lineWidth} />
    </>
  );
}

function GridSvg({ grid, imageWidth, imageHeight }: { grid: MapGrid; imageWidth: number; imageHeight: number }) {
  const { shape, columns, rows, horizontalOffset, verticalOffset, opacity, lineWidth, color } = grid;
  // The viewBox is sized to the image's real pixel dimensions (not a generic
  // 0-100 square) so that one viewBox unit is the same physical distance on
  // both axes — the overlay div always has the image's own aspect ratio, so
  // this is what keeps circles circular and hexagons regular instead of
  // getting non-uniformly stretched into ellipses/rhombi by the SVG scaling
  // to fit a differently-shaped container.
  const tileW = imageWidth / columns;
  const tileH = imageHeight / rows;
  const patternId = "map-grid-pattern";
  const offsetX = (horizontalOffset / 100) * tileW;
  const offsetY = (verticalOffset / 100) * tileH;
  // Stroke width is expressed as a fraction of the image width so it keeps
  // the same visual proportion regardless of the image's actual pixel size.
  const strokeWidth = (lineWidth / 100) * imageWidth;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      preserveAspectRatio="none"
      style={{ opacity, display: "block" }}
    >
      <defs>
        {shape === "hexagon" ? (
          <pattern
            id={patternId}
            x={offsetX}
            y={offsetY}
            width={tileW * 1.5}
            height={tileH}
            patternUnits="userSpaceOnUse"
          >
            <HexPatternContent w={tileW} h={tileH} color={color} lineWidth={strokeWidth} />
          </pattern>
        ) : shape === "circle" ? (
          <pattern id={patternId} x={offsetX} y={offsetY} width={tileW} height={tileH} patternUnits="userSpaceOnUse">
            <circle
              cx={tileW / 2}
              cy={tileH / 2}
              r={(Math.min(tileW, tileH) / 2) * 0.85}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
            />
          </pattern>
        ) : (
          <pattern
            id={patternId}
            x={offsetX}
            y={offsetY}
            width={tileW}
            height={tileH}
            patternUnits="userSpaceOnUse"
            patternTransform={shape === "diamond" ? "rotate(45)" : undefined}
          >
            <path d={`M ${tileW} 0 L 0 0 0 ${tileH}`} fill="none" stroke={color} strokeWidth={strokeWidth} />
          </pattern>
        )}
      </defs>
      <rect x="0" y="0" width={imageWidth} height={imageHeight} fill={`url(#${patternId})`} />
    </svg>
  );
}

/**
 * Draws the grid as a single OpenSeadragon overlay sized to the full image
 * (a Rect location, not a Point) — OSD auto-scales/repositions Rect
 * overlays to match the image's on-screen footprint every frame, so the
 * SVG inside (percentage-sized, viewBox-scaled) just stretches with it. No
 * per-frame recomputation needed here, unlike markers.
 */
export default function GridLayer({
  viewer,
  osd,
  grid,
}: {
  viewer: OpenSeadragonType.Viewer | null;
  osd: typeof OpenSeadragonType | null;
  grid: MapGrid | null;
}) {
  const overlayRef = useRef<{ el: HTMLDivElement; root: Root } | null>(null);

  useEffect(() => {
    if (!viewer || !osd) return;
    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) return;

    if (!grid) {
      if (overlayRef.current) {
        const entry = overlayRef.current;
        viewer.removeOverlay(entry.el);
        queueMicrotask(() => entry.root.unmount());
        overlayRef.current = null;
      }
      return;
    }

    const bounds = tiledImage.getBounds(true);
    const contentSize = tiledImage.getContentSize();

    if (!overlayRef.current) {
      const el = document.createElement("div");
      el.className = "map-grid-overlay";
      const root = createRoot(el);
      overlayRef.current = { el, root };
      viewer.addOverlay({ element: el, location: bounds, checkResize: true });
    } else {
      viewer.updateOverlay(overlayRef.current.el, bounds);
    }

    overlayRef.current.root.render(<GridSvg grid={grid} imageWidth={contentSize.x} imageHeight={contentSize.y} />);
  }, [viewer, osd, grid]);

  useEffect(() => {
    return () => {
      const entry = overlayRef.current;
      if (entry) {
        viewer?.removeOverlay(entry.el);
        queueMicrotask(() => entry.root.unmount());
        overlayRef.current = null;
      }
    };
  }, [viewer]);

  return null;
}
