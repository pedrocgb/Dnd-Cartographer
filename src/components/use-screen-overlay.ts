"use client";

import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import type OpenSeadragonType from "openseadragon";

/**
 * A layer the size of the map window, stacked among the map's own layers
 * (`OVERLAY_Z`) inside OSD's canvas: for things drawn in window pixels, like
 * travel routes, that still belong under texts and markers. It has its own
 * React root (render into it from an effect), so its handlers see a press
 * before OSD's pan does, the same as the full-map layers.
 */
export function useScreenOverlay(viewer: OpenSeadragonType.Viewer | null, zIndex: number) {
  const rootRef = useRef<Root | null>(null);

  useEffect(() => {
    if (!viewer) return;
    const el = document.createElement("div");
    Object.assign(el.style, { position: "absolute", inset: "0", zIndex: String(zIndex), pointerEvents: "none", overflow: "hidden" });
    viewer.canvas.appendChild(el);
    const root = createRoot(el);
    rootRef.current = root;
    return () => {
      rootRef.current = null;
      // Unmounting while the parent root renders warns: let it finish first.
      queueMicrotask(() => {
        root.unmount();
        el.remove();
      });
    };
  }, [viewer, zIndex]);

  return rootRef;
}
