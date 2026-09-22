"use client";

import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import type OpenSeadragonType from "openseadragon";
import MarkerIcon from "./MarkerIcon";
import { setOsdNavEnabled } from "./osd-nav";

export interface Marker {
  id: string;
  name: string;
  u: number;
  v: number;
  iconKey: string;
  color: string;
  backgroundColor: string;
  outlineColor: string;
  backgroundShape: string;
  category: string | null;
  linkedMapId: string | null;
  descriptionDocumentId: string | null;
  locked: boolean;
  revision: number;
  statusTags: string[];
  environment: string | null;
  ownership: string | null;
}

const DRAG_THRESHOLD_PX = 5;
const OVERLAP_RADIUS_PX = 16;

interface Props {
  viewer: OpenSeadragonType.Viewer | null;
  osd: typeof OpenSeadragonType | null;
  markers: Marker[];
  addingMarker: boolean;
  onPlaceMarker: (u: number, v: number) => void;
  onSelectMarker: (markerId: string) => void;
  onEditMarker: (markerId: string) => void;
  onOverlapChoice: (markerIds: string[], screenPoint: { x: number; y: number }) => void;
  onMoveMarker: (markerId: string, u: number, v: number) => void;
  selectedMarkerId: string | null;
  /** False while another tool (e.g. zone drawing) needs unobstructed clicks
   * on the map — marker overlays stop intercepting the pointer entirely
   * rather than merely being unclickable, since they'd otherwise sit above
   * that tool's own hit layer and swallow its gestures. */
  interactive?: boolean;
}

interface DragState {
  markerId: string;
  startClient: { x: number; y: number };
  lastClient: { x: number; y: number };
  originalUV: { u: number; v: number };
  dragging: boolean;
  cancelled: boolean;
  revert: () => void;
}

export default function MarkerLayer({
  viewer,
  osd,
  markers,
  addingMarker,
  onPlaceMarker,
  onSelectMarker,
  onEditMarker,
  onOverlapChoice,
  onMoveMarker,
  selectedMarkerId,
  interactive = true,
}: Props) {
  const overlaysRef = useRef<Map<string, { el: HTMLDivElement; root: Root }>>(new Map());
  const dragRef = useRef<DragState | null>(null);
  // Overlay mousedown listeners are attached once per marker (when its
  // overlay is first created) and must never close over stale markers/selection
  // state — they read from this ref, kept current on every render, instead.
  const latestRef = useRef({ markers, selectedMarkerId });
  useEffect(() => {
    latestRef.current = { markers, selectedMarkerId };
  }, [markers, selectedMarkerId]);

  // Click-to-place: attached to the OSD canvas itself, only active while
  // addingMarker is true. A drag (pan) must never count as a placement.
  useEffect(() => {
    if (!viewer || !osd || !addingMarker) return;

    const handler = (event: OpenSeadragonType.CanvasClickEvent) => {
      if (!event.quick) return; // quick=false means the user dragged, not clicked
      const tiledImage = viewer.world.getItemAt(0);
      if (!tiledImage) return;
      const viewportPoint = viewer.viewport.pointFromPixel(event.position);
      const imagePoint = tiledImage.viewportToImageCoordinates(viewportPoint);
      const size = tiledImage.getContentSize();
      const u = Math.min(1, Math.max(0, imagePoint.x / size.x));
      const v = Math.min(1, Math.max(0, imagePoint.y / size.y));
      onPlaceMarker(u, v);
    };

    viewer.addHandler("canvas-click", handler);
    return () => viewer.removeHandler("canvas-click", handler);
  }, [viewer, osd, addingMarker, onPlaceMarker]);

  // Escape immediately snaps a marker being dragged back to its original spot.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const drag = dragRef.current;
      if (e.key === "Escape" && drag?.dragging) {
        drag.cancelled = true;
        drag.revert();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!viewer || !osd) return;
    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) return;
    const size = tiledImage.getContentSize();

    function toViewportPoint(clientX: number, clientY: number) {
      const rect = viewer!.container.getBoundingClientRect();
      return viewer!.viewport.pointFromPixel(new osd!.Point(clientX - rect.left, clientY - rect.top));
    }

    function screenAnchor(m: Marker) {
      const rect = viewer!.container.getBoundingClientRect();
      const p = tiledImage.imageToViewportCoordinates(m.u * size.x, m.v * size.y);
      const pixel = viewer!.viewport.pixelFromPoint(p, true);
      return { x: pixel.x + rect.left, y: pixel.y + rect.top };
    }

    // Overlap is judged by distance between markers' own anchor points, not
    // by distance from the raw click — comparing to the click point would
    // make even exact-coordinate overlaps miss the radius.
    function selectOrChoose(markerId: string) {
      const clicked = latestRef.current.markers.find((m) => m.id === markerId);
      if (!clicked) return;
      const clickedAnchor = screenAnchor(clicked);
      const nearby = latestRef.current.markers.filter((m) => {
        const a = screenAnchor(m);
        return Math.hypot(a.x - clickedAnchor.x, a.y - clickedAnchor.y) < OVERLAP_RADIUS_PX;
      });
      if (nearby.length > 1) {
        onOverlapChoice(nearby.map((m) => m.id), clickedAnchor);
      } else {
        onSelectMarker(markerId);
      }
    }

    function attachDragHandlers(el: HTMLDivElement, markerId: string) {
      // OpenSeadragon tracks pan/zoom gestures on the canvas independently of
      // this element's own listeners — stopPropagation on our mousedown alone
      // doesn't reliably stop it (OSD's tracker isn't guaranteed to be reached
      // via bubbling of the same event type). The robust fix is to disable
      // OSD's own mouse navigation entirely while the pointer is over a
      // marker, so our handlers are the only thing responding to the drag
      // (see osd-nav.ts for why this has to be the full switch, not just
      // drag-to-pan, and how scroll-zoom stays available anyway).
      el.addEventListener("mouseenter", () => {
        setOsdNavEnabled(viewer, false);
        // Each marker overlay lives in its own OSD-created wrapper div (a
        // sibling of every other marker's wrapper), stacked in whatever
        // order they were created — not by screen position. That means the
        // hover tooltip (a child of this element, positioned above it via
        // `bottom: 100%`) can end up visually behind a neighboring marker
        // that happens to come later in that order. Bumping this marker's
        // own wrapper above all the others while hovered — restored on
        // mouseleave — guarantees its tooltip is always on top.
        if (el.parentElement) el.parentElement.style.zIndex = "1000";
      });
      el.addEventListener("mouseleave", () => {
        if (!dragRef.current) setOsdNavEnabled(viewer, true);
        if (el.parentElement) el.parentElement.style.zIndex = "";
      });

      // Right-click jumps straight to editing this marker's fields, instead
      // of the browser's native context menu.
      el.addEventListener("contextmenu", (e: MouseEvent) => {
        e.preventDefault();
        onEditMarker(markerId);
      });

      el.addEventListener("mousedown", (e: MouseEvent) => {
        if (e.button !== 0) return; // left button only — middle stays free for panning
        const { markers: currentMarkers, selectedMarkerId: currentSelected } = latestRef.current;
        const current = currentMarkers.find((m) => m.id === markerId);
        if (!current) return;
        e.preventDefault();
        e.stopPropagation();

        // Dragging only engages on a marker that's already selected (and
        // never a locked one) — the first click on any other marker just
        // selects it, so you can never accidentally drag something you
        // didn't mean to touch. Once its panel is open, clicking and
        // dragging it directly moves it — no separate "arm to move" step.
        if (current.locked || currentSelected !== markerId) {
          selectOrChoose(markerId);
          return;
        }

        const drag: DragState = {
          markerId,
          startClient: { x: e.clientX, y: e.clientY },
          lastClient: { x: e.clientX, y: e.clientY },
          originalUV: { u: current.u, v: current.v },
          dragging: false,
          cancelled: false,
          revert: () => {
            const revertPoint = tiledImage.imageToViewportCoordinates(
              drag.originalUV.u * size.x,
              drag.originalUV.v * size.y
            );
            viewer!.updateOverlay(el, revertPoint);
          },
        };
        dragRef.current = drag;

        function onMove(moveEvent: MouseEvent) {
          if (dragRef.current !== drag || drag.cancelled) return;
          drag.lastClient = { x: moveEvent.clientX, y: moveEvent.clientY };
          const dx = moveEvent.clientX - drag.startClient.x;
          const dy = moveEvent.clientY - drag.startClient.y;
          if (!drag.dragging) {
            if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
            drag.dragging = true;
            el.classList.add("marker-overlay-dragging");
          }
          viewer!.updateOverlay(el, toViewportPoint(moveEvent.clientX, moveEvent.clientY));
        }

        function onUp() {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          dragRef.current = null;
          el.classList.remove("marker-overlay-dragging");
          setOsdNavEnabled(viewer, true);

          if (!drag.dragging) {
            selectOrChoose(markerId);
            return;
          }
          if (drag.cancelled) return;

          const finalPoint = toViewportPoint(drag.lastClient.x, drag.lastClient.y);
          const imagePoint = tiledImage.viewportToImageCoordinates(finalPoint);
          const u = Math.min(1, Math.max(0, imagePoint.x / size.x));
          const v = Math.min(1, Math.max(0, imagePoint.y / size.y));
          onMoveMarker(markerId, u, v);
        }

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });
    }

    const seen = new Set<string>();

    for (const marker of markers) {
      seen.add(marker.id);
      const viewportPoint = tiledImage.imageToViewportCoordinates(marker.u * size.x, marker.v * size.y);
      let entry = overlaysRef.current.get(marker.id);

      if (!entry) {
        const el = document.createElement("div");
        el.className = "marker-overlay";
        const root = createRoot(el);
        entry = { el, root };
        overlaysRef.current.set(marker.id, entry);
        // Anchored at TOP_LEFT (OSD's simplest, most reliable placement
        // mode) with the actual centering done in CSS via a static
        // `transform: translate(-50%, -50%)` on `.marker-overlay` itself —
        // this sidesteps relying on OSD's own CENTER placement math, which
        // measures the *wrapper* element it creates around ours and can
        // disagree with our element's real rendered box.
        viewer.addOverlay({
          element: el,
          location: viewportPoint,
          placement: osd.Placement.TOP_LEFT,
          checkResize: false,
        });
        attachDragHandlers(el, marker.id);
      } else {
        viewer.updateOverlay(entry.el, viewportPoint);
      }

      entry.el.classList.toggle("marker-overlay-selected", marker.id === selectedMarkerId);
      entry.el.classList.toggle("marker-overlay-noninteractive", !interactive);
      // `pointer-events: none` on our own element doesn't remove OSD's own
      // wrapper div (a sibling-of-content parent OSD creates around every
      // overlay for positioning) from hit-testing — that wrapper has no
      // class unique to this one marker, so it's targeted directly here
      // rather than through a shared CSS rule that would also disable
      // unrelated overlays (Grid, Zones) using the same OSD wrapper class.
      if (entry.el.parentElement) entry.el.parentElement.style.pointerEvents = interactive ? "" : "none";
      entry.root.render(
        <>
          <MarkerIcon
            iconKey={marker.iconKey}
            color={marker.color}
            backgroundColor={marker.backgroundColor}
            outlineColor={marker.outlineColor}
            backgroundShape={marker.backgroundShape}
            size={22}
          />
          <span className="marker-tooltip">{marker.name}</span>
        </>
      );
    }

    for (const [id, entry] of overlaysRef.current) {
      if (!seen.has(id)) {
        viewer.removeOverlay(entry.el);
        // Deferred: unmounting a react-dom root synchronously here fires
        // while React is still committing this very effect's render, which
        // logs "Attempted to synchronously unmount a root while React was
        // already rendering." Pushing it to a microtask avoids that.
        queueMicrotask(() => entry.root.unmount());
        overlaysRef.current.delete(id);
      }
    }
  }, [viewer, osd, markers, selectedMarkerId, interactive, onSelectMarker, onEditMarker, onOverlapChoice, onMoveMarker]);

  // Unmount all overlay roots when the layer itself goes away (map change).
  useEffect(() => {
    const overlays = overlaysRef.current;
    return () => {
      for (const entry of overlays.values()) {
        viewer?.removeOverlay(entry.el);
        queueMicrotask(() => entry.root.unmount());
      }
      overlays.clear();
    };
  }, [viewer]);

  return null;
}
