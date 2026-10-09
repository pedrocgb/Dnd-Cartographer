"use client";

import { useRef, useState } from "react";
import type OpenSeadragonType from "openseadragon";
import type { MapRouteData, RoutePt, RouteStyleKind } from "@/server/travel/route-config";
import { clientToImagePoint, frameSize } from "@/components/osd-coords";
import { clickMods, type ClickMods } from "@/components/multi-select";
import { useViewportTick } from "./MapScaleBar";

/** Dash pattern for a route style at a given stroke width (screen px). */
export function routeDash(style: RouteStyleKind, width: number): string | undefined {
  if (style === "dashed") return `${width * 3} ${width * 2}`;
  if (style === "dotted") return `0 ${width * 2}`;
  return undefined;
}

function toScreen(viewer: OpenSeadragonType.Viewer, p: RoutePt): RoutePt {
  const tiledImage = viewer.world.getItemAt(0);
  const px = viewer.viewport.pixelFromPoint(tiledImage.imageToViewportCoordinates(p.x, p.y), true);
  return { x: px.x, y: px.y };
}

/** A point being dragged: the route's points while dragging, and which one moves. */
interface PointDrag {
  routeId: string;
  index: number;
  points: RoutePt[];
  moved: boolean;
}

/**
 * Saved travel routes over the map window, redrawn on every pan/zoom frame
 * (their width stays the same on screen). With the Travel panel open, a
 * click on a route selects it (Ctrl/Cmd+click adds or removes it); selected
 * ones are outlined, and routes get a label at their end (name and trip time).
 * The one route being edited shows its points: drag one to move it, drag a
 * "+" between two to add one there, right-click or double-click one to
 * remove it (a route keeps at least two).
 */
export default function RouteLayer({
  viewer,
  osd,
  routes,
  selectedIds,
  selectableIds,
  editableId,
  pulseId,
  labelOf,
  onPick,
  onReshape,
}: {
  viewer: OpenSeadragonType.Viewer | null;
  osd: typeof OpenSeadragonType | null;
  routes: MapRouteData[];
  selectedIds: readonly string[];
  /** Routes a click picks (none while the Travel panel is closed or drawing). */
  selectableIds: ReadonlySet<string>;
  /** The route whose points can be dragged, if any. */
  editableId: string | null;
  pulseId: string | null;
  /** Label at the route's end, or null for none. */
  labelOf: (route: MapRouteData) => string | null;
  onPick: (id: string, mods: ClickMods) => void;
  onReshape: (id: string, points: RoutePt[]) => void;
}) {
  useViewportTick(viewer);
  const [drag, setDrag] = useState<PointDrag | null>(null);
  const dragRef = useRef<PointDrag | null>(null);
  if (!viewer || !viewer.world.getItemAt(0) || routes.length === 0) return null;

  const setDragState = (next: PointDrag | null) => {
    dragRef.current = next;
    setDrag(next);
  };
  const imagePoint = (e: React.PointerEvent): RoutePt | null => {
    const p = clientToImagePoint(viewer, osd, e.clientX, e.clientY);
    const frame = frameSize(viewer);
    if (!p || !frame) return null;
    return { x: Math.min(frame.w, Math.max(0, p.x)), y: Math.min(frame.h, Math.max(0, p.y)) };
  };
  const startDrag = (e: React.PointerEvent, routeId: string, index: number, points: RoutePt[]) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDragState({ routeId, index, points, moved: false });
  };
  const moveDrag = (e: React.PointerEvent) => {
    const current = dragRef.current;
    const p = current && imagePoint(e);
    if (!current || !p) return;
    setDragState({ ...current, moved: true, points: current.points.map((q, i) => (i === current.index ? p : q)) });
  };
  const endDrag = (inserted: boolean) => {
    const current = dragRef.current;
    setDragState(null);
    // A click on a "+" still adds its point; a click on a point changes nothing.
    if (current && (current.moved || inserted)) onReshape(current.routeId, current.points);
  };
  const removePoint = (e: React.MouseEvent, route: MapRouteData, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (route.points.length > 2) onReshape(route.id, route.points.filter((_, i) => i !== index));
  };

  const picked = new Set(selectedIds);
  return (
    <svg className="route-layer" aria-hidden>
      {routes.map((route) => {
        const points = drag?.routeId === route.id ? drag.points : route.points;
        const pts = points.map((p) => toScreen(viewer, p));
        if (pts.length < 2) return null;
        const d = pts.map((p) => `${p.x},${p.y}`).join(" ");
        const end = pts[pts.length - 1];
        const selected = picked.has(route.id);
        const editing = route.id === editableId;
        const label = labelOf(route);
        return (
          <g key={route.id} className={route.id === pulseId ? "route scene-focus-pulse" : "route"}>
            {selected && <polyline points={d} className="route-halo" strokeWidth={route.width + 6} />}
            <polyline
              points={d}
              className="route-path"
              stroke={route.color}
              strokeWidth={route.width}
              strokeDasharray={routeDash(route.style, route.width)}
              strokeLinecap={route.style === "dotted" ? "round" : "butt"}
            />
            <circle cx={pts[0].x} cy={pts[0].y} r={route.width + 1.5} fill={route.color} className="route-end" />
            <circle cx={end.x} cy={end.y} r={route.width + 2.5} fill={route.color} className="route-end" />
            {label && (
              <text x={end.x + 10} y={end.y - 8} className="measure-label">
                {label}
              </text>
            )}
            {selectableIds.has(route.id) && !editing && (
              <polyline
                points={d}
                className="route-hit"
                strokeWidth={Math.max(12, route.width + 8)}
                // Keeps the press from the map's pan (this layer sits inside it).
                onPointerDown={(e) => e.button === 0 && e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onPick(route.id, clickMods(e));
                }}
              />
            )}
            {editing &&
              pts.slice(1).map((p, i) => {
                const mid = { x: (pts[i].x + p.x) / 2, y: (pts[i].y + p.y) / 2 };
                // Too short on screen to fit a "+" between its points.
                if (Math.hypot(p.x - pts[i].x, p.y - pts[i].y) < 28) return null;
                const insertAt = i + 1;
                return (
                  <g
                    key={`mid-${i}`}
                    className="route-mid"
                    onPointerDown={(e) => {
                      const a = points[i];
                      const b = points[insertAt];
                      startDrag(e, route.id, insertAt, [...points.slice(0, insertAt), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, ...points.slice(insertAt)]);
                    }}
                    onPointerMove={moveDrag}
                    onPointerUp={() => endDrag(true)}
                    onPointerCancel={() => setDragState(null)}
                  >
                    <circle cx={mid.x} cy={mid.y} r={6} />
                    <path d={`M${mid.x - 3} ${mid.y}h6M${mid.x} ${mid.y - 3}v6`} />
                  </g>
                );
              })}
            {editing &&
              pts.map((p, i) => (
                <circle
                  key={`pt-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={6}
                  className={drag?.routeId === route.id && drag.index === i ? "route-vertex dragging" : "route-vertex"}
                  onPointerDown={(e) => startDrag(e, route.id, i, points)}
                  onPointerMove={moveDrag}
                  onPointerUp={() => endDrag(false)}
                  onPointerCancel={() => setDragState(null)}
                  onContextMenu={(e) => removePoint(e, route, i)}
                  onDoubleClick={(e) => removePoint(e, route, i)}
                />
              ))}
          </g>
        );
      })}
    </svg>
  );
}
