"use client";

import { useEffect, useRef, useState } from "react";
import type OpenSeadragonType from "openseadragon";
import { clientToImagePoint, frameSize, screenPxPerImagePx } from "@/components/osd-coords";
import { setOsdNavEnabled } from "@/components/osd-nav";
import { circleFromDrag, rectFromDrag } from "@/components/ZoneLayer";
import { formatArea, shapeAreaPx, type AreaShape, type Pt } from "@/server/scale/area";
import { formatNumber, type ScaleConfig } from "@/server/scale/scale-config";
import { useViewportTick } from "./MapScaleBar";
import { useSettings } from "@/components/settings/SettingsProvider";

export type AreaTool = "rectangle" | "circle" | "polygon";

export interface MeasuredShape {
  id: string;
  shape: AreaShape;
}

/** Below this pointer travel a press is a click (adds a polygon point), not a drag. */
const CLICK_THRESHOLD_PX = 5;
/** Clicking this close to the first point closes the polygon. */
const CLOSURE_SCREEN_PX = 10;

type Draft = { kind: "drag"; start: Pt; current: Pt; shift: boolean } | { kind: "polygon"; points: Pt[] };

function toScreen(viewer: OpenSeadragonType.Viewer, p: Pt): Pt {
  const tiledImage = viewer.world.getItemAt(0);
  const px = viewer.viewport.pixelFromPoint(tiledImage.imageToViewportCoordinates(p.x, p.y), true);
  return { x: px.x, y: px.y };
}

/** The shape a drag or polygon draft makes so far (null while too small). */
function draftShape(tool: AreaTool, draft: Draft, cursor: Pt | null, size: { w: number; h: number }): AreaShape | null {
  if (draft.kind === "polygon") {
    const points = cursor ? [...draft.points, cursor] : draft.points;
    return points.length >= 3 ? { kind: "polygon", points } : null;
  }
  if (tool === "rectangle") {
    const r = rectFromDrag(draft.start, draft.current, draft.shift, size);
    return r && { kind: "rectangle", ...r };
  }
  const c = circleFromDrag(draft.start, draft.current, size);
  return c && { kind: "circle", ...c };
}

/** A shape's outline on screen, and where its area label goes. */
function ShapeOutline({ viewer, shape, className, label }: { viewer: OpenSeadragonType.Viewer; shape: AreaShape; className: string; label: string | null }) {
  let outline: React.ReactNode;
  let center: Pt;
  if (shape.kind === "circle") {
    center = toScreen(viewer, shape);
    outline = <circle cx={center.x} cy={center.y} r={shape.radius * screenPxPerImagePx(viewer)} className={className} />;
  } else {
    const pts =
      shape.kind === "rectangle"
        ? [
            { x: shape.x, y: shape.y },
            { x: shape.x + shape.width, y: shape.y },
            { x: shape.x + shape.width, y: shape.y + shape.height },
            { x: shape.x, y: shape.y + shape.height },
          ]
        : shape.kind === "polygon"
          ? shape.points
          : [];
    const screen = pts.map((p) => toScreen(viewer, p));
    center = screen.reduce((acc, p) => ({ x: acc.x + p.x / screen.length, y: acc.y + p.y / screen.length }), { x: 0, y: 0 });
    outline = <polygon points={screen.map((p) => `${p.x},${p.y}`).join(" ")} className={className} />;
  }
  return (
    <g>
      {outline}
      {label && (
        <text x={center.x} y={center.y} className="measure-label" textAnchor="middle" dominantBaseline="middle">
          {label}
        </text>
      )}
    </g>
  );
}

/**
 * The Area tool's drawing layer: rectangles and circles by dragging (Shift
 * draws a square), polygons click by click (close on the first point, Enter
 * or right-click; Backspace undoes a point; Esc drops the draft). Every
 * shape shows its area; nothing is saved. The map pans with the middle
 * button while it's on, like the zone tools.
 */
export default function AreaLayer({
  viewer,
  osd,
  tool,
  shapes,
  selectedId,
  config,
  onAdd,
}: {
  viewer: OpenSeadragonType.Viewer | null;
  osd: typeof OpenSeadragonType | null;
  tool: AreaTool;
  shapes: MeasuredShape[];
  selectedId: string | null;
  config: ScaleConfig;
  onAdd: (shape: AreaShape) => void;
}) {
  useViewportTick(viewer);
  const { settings } = useSettings();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const draftRef = useRef(draft);
  const onAddRef = useRef(onAdd);
  useEffect(() => {
    draftRef.current = draft;
    onAddRef.current = onAdd;
  });

  // A tool switch drops an unfinished shape (derived-state reset, not an effect).
  const [lastTool, setLastTool] = useState(tool);
  if (lastTool !== tool) {
    setLastTool(tool);
    setDraft(null);
  }

  // Left drags draw instead of panning (middle-drag still pans).
  useEffect(() => {
    if (!viewer) return;
    setOsdNavEnabled(viewer, false);
    return () => setOsdNavEnabled(viewer, true);
  }, [viewer]);

  useEffect(() => {
    if (!viewer || !osd) return;
    const el = viewer.container;
    const at = (clientX: number, clientY: number) => clientToImagePoint(viewer, osd, clientX, clientY);
    const size = () => frameSize(viewer);

    function commitPolygon(points: Pt[]) {
      if (points.length >= 3) onAddRef.current({ kind: "polygon", points });
      setDraft(null);
    }

    function onMouseDown(e: MouseEvent) {
      // Only presses on the map itself (not on a HUD control over it).
      if (e.button !== 0 || !(e.target instanceof Node) || !viewer!.canvas.contains(e.target)) return;
      const start = at(e.clientX, e.clientY);
      const frame = size();
      if (!start || !frame) return;
      e.preventDefault();
      const startClient = { x: e.clientX, y: e.clientY };
      let dragging = false;

      const onMove = (ev: MouseEvent) => {
        if (tool === "polygon") return;
        if (!dragging && Math.hypot(ev.clientX - startClient.x, ev.clientY - startClient.y) < CLICK_THRESHOLD_PX) return;
        dragging = true;
        const cur = at(ev.clientX, ev.clientY);
        if (cur) setDraft({ kind: "drag", start, current: cur, shift: ev.shiftKey });
      };
      const onUp = (ev: MouseEvent) => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        if (tool !== "polygon") {
          const cur = at(ev.clientX, ev.clientY);
          setDraft(null);
          if (!dragging || !cur) return;
          const shape = draftShape(tool, { kind: "drag", start, current: cur, shift: ev.shiftKey }, null, frame);
          if (shape) onAddRef.current(shape);
          return;
        }
        // Polygon: a click adds a point, or closes the shape on the first one.
        if (start.x < 0 || start.y < 0 || start.x > frame.w || start.y > frame.h) return;
        const current = draftRef.current?.kind === "polygon" ? draftRef.current.points : [];
        if (current.length >= 3 && Math.hypot(start.x - current[0].x, start.y - current[0].y) * screenPxPerImagePx(viewer) <= CLOSURE_SCREEN_PX) {
          commitPolygon(current);
          return;
        }
        setDraft({ kind: "polygon", points: [...current, start] });
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    }

    let frameId = 0;
    const onHover = (e: MouseEvent) => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => setCursor(at(e.clientX, e.clientY)));
    };
    const onLeave = () => {
      cancelAnimationFrame(frameId);
      setCursor(null);
    };
    const onContextMenu = (e: MouseEvent) => {
      const d = draftRef.current;
      if (d?.kind !== "polygon") return;
      e.preventDefault();
      commitPolygon(d.points);
    };
    // Capture phase, ahead of the map's own Esc (which would close the panel).
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const d = draftRef.current;
      if (!d) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setDraft(null);
      } else if (d.kind === "polygon" && e.key === "Enter") {
        e.preventDefault();
        commitPolygon(d.points);
      } else if (d.kind === "polygon" && (e.key === "Backspace" || e.key === "Delete")) {
        e.preventDefault();
        setDraft(d.points.length > 1 ? { kind: "polygon", points: d.points.slice(0, -1) } : null);
      }
    };

    el.addEventListener("mousedown", onMouseDown, true);
    el.addEventListener("mousemove", onHover);
    el.addEventListener("mouseleave", onLeave);
    el.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      cancelAnimationFrame(frameId);
      el.removeEventListener("mousedown", onMouseDown, true);
      el.removeEventListener("mousemove", onHover);
      el.removeEventListener("mouseleave", onLeave);
      el.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [viewer, osd, tool]);

  const frame = frameSize(viewer);
  if (!viewer || !viewer.world.getItemAt(0) || !frame) return null;

  const labelOf = (shape: AreaShape) => {
    const px = shapeAreaPx(shape);
    return formatArea(px, config, settings.lengthSystem) ?? `${formatNumber(px)} px²`;
  };
  const preview = draft && draftShape(tool, draft, cursor, frame);
  const polygonPoints = draft?.kind === "polygon" ? draft.points.map((p) => toScreen(viewer, p)) : [];
  const cursorScreen = cursor && draft?.kind === "polygon" ? toScreen(viewer, cursor) : null;

  return (
    <div className="measure-layer area-layer">
      <svg className="measure-svg" aria-hidden>
        {shapes.map((s) => (
          <ShapeOutline key={s.id} viewer={viewer} shape={s.shape} className={s.id === selectedId ? "area-shape selected" : "area-shape"} label={labelOf(s.shape)} />
        ))}
        {preview && <ShapeOutline viewer={viewer} shape={preview} className="area-shape draft" label={labelOf(preview)} />}
        {polygonPoints.length > 0 && polygonPoints.length < 3 && (
          <polyline points={[...polygonPoints, ...(cursorScreen ? [cursorScreen] : [])].map((p) => `${p.x},${p.y}`).join(" ")} className="measure-path" />
        )}
        {polygonPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === 0 && polygonPoints.length >= 3 ? 6 : 4} className="measure-point" />
        ))}
      </svg>
      <div className="measure-hint" role="status">
        {tool === "polygon"
          ? draft
            ? "Click to add points · click the first point, Enter or right-click to close · Backspace undoes · Esc cancels"
            : "Click on the map to start the polygon, point by point."
          : `Drag on the map to draw a ${tool === "circle" ? "circle from its center" : "rectangle (Shift: a square)"} · middle-drag pans.`}
      </div>
    </div>
  );
}
