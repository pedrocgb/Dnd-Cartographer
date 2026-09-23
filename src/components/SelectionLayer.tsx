"use client";

import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import type OpenSeadragonType from "openseadragon";
import { OVERLAY_Z, addFullMapOverlay, removeFullMapOverlay } from "./osd-overlay-stack";
import type { Rect } from "./scene-bounds";

/**
 * Selection tool hover box: a faint dashed rectangle around the item under
 * the pointer (frame pixels), drawn above every other map layer. Display
 * only; the tool's picking happens in MapWorkspace.
 */
export default function SelectionLayer({
  viewer,
  box,
  pad,
  imageWidth,
  imageHeight,
}: {
  viewer: OpenSeadragonType.Viewer | null;
  box: Rect | null;
  /** Gap between the item and the box, in frame pixels. */
  pad: number;
  imageWidth: number;
  imageHeight: number;
}) {
  const overlayRef = useRef<{ el: HTMLDivElement; root: Root } | null>(null);

  useEffect(() => {
    if (!viewer?.world.getItemAt(0)) return;
    const el = document.createElement("div");
    el.className = "selection-layer-overlay";
    const entry = { el, root: createRoot(el) };
    overlayRef.current = entry;
    addFullMapOverlay(viewer, el, OVERLAY_Z.selection);
    return () => {
      removeFullMapOverlay(viewer, el);
      queueMicrotask(() => entry.root.unmount());
      overlayRef.current = null;
    };
  }, [viewer]);

  useEffect(() => {
    overlayRef.current?.root.render(
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${imageWidth} ${imageHeight}`}
        preserveAspectRatio="none"
        style={{ display: "block", overflow: "visible", pointerEvents: "none" }}
      >
        {/* Alternating black and white dashes read on any map color. */}
        {box &&
          ["selection-hover-box-dark", "selection-hover-box-light"].map((className) => (
            <rect
              key={className}
              className={className}
              x={box.x - pad}
              y={box.y - pad}
              width={box.width + 2 * pad}
              height={box.height + 2 * pad}
              vectorEffect="non-scaling-stroke"
            />
          ))}
      </svg>
    );
  }, [viewer, box, pad, imageWidth, imageHeight]);

  return null;
}
