"use client";

import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type OpenSeadragonType from "openseadragon";
import { setOsdNavEnabled } from "./osd-nav";
import { OVERLAY_Z, addFullMapOverlay, removeFullMapOverlay } from "./osd-overlay-stack";
import { clientToImagePoint, frameSize, screenPxPerImagePx, type Pt } from "./osd-coords";
import { dashArray, freePath, penPath, pointsBounds, polylineLength, simplify, snapToAngle } from "./line-geometry";
import { shadowOffset } from "./text-geometry";
import type { LineKind, LineStyle, PenPt } from "@/server/lines/line-config";

export interface MapLineData extends LineStyle {
  id: string;
  mapId: string;
  layerId: string | null;
  /** Other layers it is also shown (and editable) on. */
  extraLayerIds: string[];
  kind: LineKind;
  points: PenPt[];
}

const CLICK_THRESHOLD_PX = 5;
/** Free-draw simplification tolerance, in screen pixels. */
const SIMPLIFY_SCREEN_PX = 0.75;

interface Props {
  viewer: OpenSeadragonType.Viewer | null;
  osd: typeof OpenSeadragonType | null;
  /** Line panel open (and the active layer visible). */
  authoring: boolean;
  /** Armed to draw a new line. */
  drawing: boolean;
  mode: LineKind;
  /** Style previewed while drawing (= what the new line will get). */
  draftStyle: LineStyle;
  lines: MapLineData[];
  /** Lines that can be selected/edited; the rest (other layers' "always draw") are display only. Omitted = all. */
  editableIds?: Set<string>;
  /** Line briefly pulsed after being picked in the Scene panel. */
  pulseId?: string | null;
  selectedLineId: string | null;
  onCreate: (kind: LineKind, points: PenPt[]) => void;
  onCancelDraw: () => void;
  onSelect: (id: string | null) => void;
  onMove: (id: string, dx: number, dy: number) => void;
  onDelete: (id: string) => void;
}

export default function LineLayer({
  viewer,
  osd,
  authoring,
  drawing,
  mode,
  draftStyle,
  lines,
  editableIds,
  pulseId = null,
  selectedLineId,
  onCreate,
  onCancelDraw,
  onSelect,
  onMove,
  onDelete,
}: Props) {
  const overlayRef = useRef<{ el: HTMLDivElement; root: Root } | null>(null);
  const draggingRef = useRef(false);
  /** In-progress line: free-draw samples, or the pen points placed so far. */
  const [draft, setDraft] = useState<PenPt[] | null>(null);
  const [hover, setHover] = useState<Pt | null>(null);
  const [moving, setMoving] = useState<{ id: string; dx: number; dy: number } | null>(null);

  const toImagePoint = (clientX: number, clientY: number) => clientToImagePoint(viewer, osd, clientX, clientY);
  // Parent callbacks are usually inline closures (new every render); read
  // them through a ref so the overlay only re-renders when its data changes.
  const callbacksRef = useRef({ onCreate, onCancelDraw, onSelect, onMove, onDelete });
  useEffect(() => {
    callbacksRef.current = { onCreate, onCancelDraw, onSelect, onMove, onDelete };
  });

  // A half-drawn line never survives a mode switch, disarming or closing the panel.
  const drawKey = `${authoring}|${drawing}|${mode}`;
  const [lastDrawKey, setLastDrawKey] = useState(drawKey);
  if (drawKey !== lastDrawKey) {
    setLastDrawKey(drawKey);
    setDraft(null);
    setHover(null);
  }

  // Same as ZoneLayer/TextLayer: nav must be off before the gesture's mousedown.
  useEffect(() => {
    if (!viewer || !authoring || !(drawing || selectedLineId)) return;
    setOsdNavEnabled(viewer, false);
    return () => setOsdNavEnabled(viewer, true);
  }, [viewer, authoring, drawing, selectedLineId]);

  function finishPen(points: PenPt[] | null) {
    setDraft(null);
    if (points && points.length >= 2) callbacksRef.current.onCreate("pen", points);
  }

  useEffect(() => {
    if (!authoring) return;
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (drawing && mode === "pen" && draft) {
        if (e.key === "Enter") finishPen(draft);
        else if (e.key === "Backspace") setDraft(draft.length > 1 ? draft.slice(0, -1) : null);
        else if (e.key === "Escape") setDraft(null);
        else return;
        e.preventDefault();
        return;
      }
      if (e.key === "Escape") {
        if (drawing) onCancelDraw();
        else if (selectedLineId) onSelect(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedLineId) {
        e.preventDefault();
        onDelete(selectedLineId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    if (!viewer || !osd) return;
    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) return;
    const bounds = tiledImage.getBounds(true);
    if (!overlayRef.current) {
      const el = document.createElement("div");
      el.className = "line-layer-overlay";
      overlayRef.current = { el, root: createRoot(el) };
      addFullMapOverlay(viewer, el, OVERLAY_Z.lines);
    } else {
      viewer.updateOverlay(overlayRef.current.el, bounds);
    }
  }, [viewer, osd]);

  useEffect(() => {
    return () => {
      const entry = overlayRef.current;
      if (entry) {
        removeFullMapOverlay(viewer, entry.el);
        queueMicrotask(() => entry.root.unmount());
        overlayRef.current = null;
      }
    };
  }, [viewer]);

  function onLineHover(hovering: boolean) {
    if (hovering) setOsdNavEnabled(viewer, false);
    else if (!draggingRef.current && !drawing && !selectedLineId) setOsdNavEnabled(viewer, true);
  }

  /** Window-listener drag with a click threshold (same pattern as TextLayer). */
  function drag(e: React.MouseEvent, onDrag: (cur: Pt, ev: MouseEvent) => void, onEnd: (dragged: boolean) => void, threshold = CLICK_THRESHOLD_PX) {
    e.stopPropagation();
    e.preventDefault();
    setOsdNavEnabled(viewer, false);
    draggingRef.current = true;
    const startClient = { x: e.clientX, y: e.clientY };
    let dragged = false;
    function onMoveEv(ev: MouseEvent) {
      if (!dragged && Math.hypot(ev.clientX - startClient.x, ev.clientY - startClient.y) < threshold) return;
      dragged = true;
      const cur = toImagePoint(ev.clientX, ev.clientY);
      if (cur) onDrag(cur, ev);
    }
    function onUp() {
      window.removeEventListener("mousemove", onMoveEv);
      window.removeEventListener("mouseup", onUp);
      draggingRef.current = false;
      onEnd(dragged);
    }
    window.addEventListener("mousemove", onMoveEv);
    window.addEventListener("mouseup", onUp);
  }

  function onDrawMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const start = toImagePoint(e.clientX, e.clientY);
    if (!start) return;
    if (mode === "free") {
      const samples: PenPt[] = [start];
      setDraft(samples);
      drag(
        e,
        (cur) => {
          samples.push(cur);
          setDraft([...samples]);
        },
        () => {
          setDraft(null);
          const tolerance = SIMPLIFY_SCREEN_PX / screenPxPerImagePx(viewer);
          const pts = simplify(samples, tolerance);
          if (pts.length >= 2 && polylineLength(pts) > 0) callbacksRef.current.onCreate("free", pts);
        },
        0
      );
      return;
    }
    // Pen: click = corner point; dragging before release pulls out
    // symmetric handles that make it a smooth point. Shift keeps the new
    // segment (and the handle direction) horizontal, vertical or 45°.
    const base = draft ?? [];
    const prev = base[base.length - 1];
    const anchor = e.shiftKey && prev ? snapToAngle(prev, start) : start;
    let point: PenPt = { ...anchor };
    setDraft([...base, point]);
    drag(
      e,
      (cur, ev) => {
        const handle = ev.shiftKey ? snapToAngle(anchor, cur) : cur;
        point = { x: anchor.x, y: anchor.y, cout: handle, cin: { x: 2 * anchor.x - handle.x, y: 2 * anchor.y - handle.y } };
        setDraft([...base, point]);
      },
      () => setDraft([...base, point])
    );
  }

  function onContextMenu(e: React.MouseEvent) {
    // Right-click finishes the pen line (and never opens the browser menu while drawing).
    e.preventDefault();
    if (mode === "pen") finishPen(draft);
  }

  function onLineMouseDown(e: React.MouseEvent, line: MapLineData) {
    if (e.button !== 0) return;
    const start = toImagePoint(e.clientX, e.clientY);
    if (!start) return;
    let delta = { dx: 0, dy: 0 };
    drag(
      e,
      (cur) => {
        delta = { dx: cur.x - start.x, dy: cur.y - start.y };
        setMoving({ id: line.id, ...delta });
      },
      (dragged) => {
        setMoving(null);
        if (dragged && (delta.dx || delta.dy)) callbacksRef.current.onMove(line.id, delta.dx, delta.dy);
        if (selectedLineId !== line.id) callbacksRef.current.onSelect(line.id);
      }
    );
  }

  function onBackgroundMouseDown(e: React.MouseEvent) {
    if (e.button === 0 && selectedLineId) callbacksRef.current.onSelect(null);
  }

  useEffect(() => {
    const entry = overlayRef.current;
    if (!entry || !viewer) return;
    const size = frameSize(viewer);
    if (!size) return;
    entry.root.render(
      <LineSvg
        imageWidth={size.w}
        imageHeight={size.h}
        lines={lines}
        editableIds={editableIds}
        pulseId={pulseId}
        moving={moving}
        interactive={authoring}
        drawing={authoring && drawing}
        mode={mode}
        draft={draft}
        hover={hover}
        draftStyle={draftStyle}
        selectedLineId={authoring ? selectedLineId : null}
        onDrawMouseDown={onDrawMouseDown}
        onDrawMouseMove={(e) => {
          if (mode !== "pen" || !draft) return;
          const cur = toImagePoint(e.clientX, e.clientY);
          const last = draft[draft.length - 1];
          setHover(cur && e.shiftKey && last ? snapToAngle(last, cur) : cur);
        }}
        onContextMenu={onContextMenu}
        onBackgroundMouseDown={onBackgroundMouseDown}
        onLineMouseDown={onLineMouseDown}
        onLineHover={onLineHover}
      />
    );
    // Handlers are recreated each render but only read the deps below (and
    // callbacksRef), so re-rendering on these alone is complete.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, lines, editableIds, pulseId, moving, authoring, drawing, mode, draft, hover, draftStyle, selectedLineId]);

  return null;
}

function linePathD(kind: LineKind, points: PenPt[]): string {
  return kind === "pen" ? penPath(points) : freePath(points);
}

/**
 * Path data and bounds per saved line, keyed by its points array (replaced,
 * never mutated, on edit), so re-renders don't rebuild every curve.
 */
const geometryCache = new WeakMap<PenPt[], { d: string; bounds: ReturnType<typeof pointsBounds> }>();
function lineGeometry(line: MapLineData) {
  let g = geometryCache.get(line.points);
  if (!g) {
    g = { d: linePathD(line.kind, line.points), bounds: pointsBounds(line.points) };
    geometryCache.set(line.points, g);
  }
  return g;
}

type ShadowStyle = Pick<LineStyle, "shadowEnabled" | "shadowAngle" | "shadowDistance" | "shadowBlur" | "shadowColor" | "shadowOpacity" | "width">;

function shadowKey(s: ShadowStyle): string | null {
  if (!s.shadowEnabled) return null;
  const o = shadowOffset(s.shadowAngle, s.shadowDistance, s.width, 0);
  return [o.x.toFixed(3), o.y.toFixed(3), (s.shadowBlur * s.width).toFixed(3), s.shadowColor, s.shadowOpacity].join("|");
}

/**
 * Consecutive lines with the same shadow share one filtered group: one
 * offscreen filter pass for the run instead of one per line (the shadow of
 * a union equals the union of the shadows except where the lines overlap).
 */
function shadowRuns(lines: MapLineData[]): { key: string | null; lines: MapLineData[] }[] {
  const runs: { key: string | null; lines: MapLineData[] }[] = [];
  for (const line of lines) {
    const key = shadowKey(line);
    const last = runs[runs.length - 1];
    if (last && last.key === key) last.lines.push(line);
    else runs.push({ key, lines: [line] });
  }
  return runs;
}

function ShadowFilter({ id, style, bounds }: { id: string; style: ShadowStyle; bounds: { x: number; y: number; width: number; height: number } }) {
  const shadow = shadowOffset(style.shadowAngle, style.shadowDistance, style.width, 0);
  const blur = style.shadowBlur * style.width;
  // userSpaceOnUse region: a horizontal/vertical line has a zero-height/width
  // bounding box, which would collapse an objectBoundingBox filter region.
  const margin = style.width * 2 + Math.hypot(shadow.x, shadow.y) + blur * 3;
  return (
    <filter
      id={id}
      filterUnits="userSpaceOnUse"
      x={bounds.x - margin}
      y={bounds.y - margin}
      width={bounds.width + margin * 2}
      height={bounds.height + margin * 2}
    >
      <feDropShadow dx={shadow.x} dy={shadow.y} stdDeviation={blur} floodColor={style.shadowColor} floodOpacity={style.shadowOpacity} />
    </filter>
  );
}

function unionBounds(boxes: ({ x: number; y: number; width: number; height: number } | null)[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of boxes) {
    if (!b) continue;
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.width);
    y1 = Math.max(y1, b.y + b.height);
  }
  return x0 === Infinity ? null : { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

interface SvgProps {
  imageWidth: number;
  imageHeight: number;
  lines: MapLineData[];
  editableIds?: Set<string>;
  pulseId?: string | null;
  moving: { id: string; dx: number; dy: number } | null;
  /** Line panel open: lines can be clicked (also while armed to draw, until a pen line is under way). */
  interactive: boolean;
  drawing: boolean;
  mode: LineKind;
  draft: PenPt[] | null;
  hover: Pt | null;
  draftStyle: LineStyle;
  selectedLineId: string | null;
  onDrawMouseDown: (e: React.MouseEvent) => void;
  onDrawMouseMove: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onBackgroundMouseDown: (e: React.MouseEvent) => void;
  onLineMouseDown: (e: React.MouseEvent, line: MapLineData) => void;
  onLineHover: (hovering: boolean) => void;
}

function LineSvg(props: SvgProps) {
  const { imageWidth, imageHeight, lines, moving, interactive, drawing, mode, draft, hover, draftStyle, selectedLineId } = props;
  const hitWidth = Math.max(imageWidth, imageHeight) * 0.006;

  let draftD = "";
  if (draft && draft.length > 0) {
    draftD = linePathD(mode, draft);
    // Pen: rubber-band segment from the last point to the cursor.
    if (mode === "pen" && hover) {
      const last = draft[draft.length - 1];
      draftD += last.cout ? ` C ${last.cout.x} ${last.cout.y} ${hover.x} ${hover.y} ${hover.x} ${hover.y}` : ` L ${hover.x} ${hover.y}`;
    }
  }

  const offsetOf = (id: string) => (moving?.id === id ? `translate(${moving.dx} ${moving.dy})` : undefined);
  const selectedLine = selectedLineId ? lines.find((l) => l.id === selectedLineId) : undefined;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      preserveAspectRatio="none"
      style={{ display: "block", overflow: "visible", pointerEvents: "none" }}
    >
      {(drawing || (interactive && selectedLineId)) && (
        <rect
          x={0}
          y={0}
          width={imageWidth}
          height={imageHeight}
          fill="transparent"
          style={{ pointerEvents: "all", cursor: drawing ? "crosshair" : "default" }}
          onMouseDown={drawing ? props.onDrawMouseDown : props.onBackgroundMouseDown}
          onMouseMove={drawing ? props.onDrawMouseMove : undefined}
          onContextMenu={drawing ? props.onContextMenu : undefined}
        />
      )}

      {shadowRuns(lines).map((run, runIndex) => {
        const bounds = run.key ? unionBounds(run.lines.map((l) => lineGeometry(l).bounds)) : null;
        // A line being dragged widens its run's shadow region by the drag offset.
        const region =
          bounds && moving && run.lines.some((l) => l.id === moving.id)
            ? unionBounds([bounds, { x: bounds.x + moving.dx, y: bounds.y + moving.dy, width: bounds.width, height: bounds.height }])
            : bounds;
        const filterId = `map-line-shadow-run-${runIndex}`;
        return (
          <g key={run.lines[0].id} filter={region ? `url(#${filterId})` : undefined}>
            {region && (
              <defs>
                <ShadowFilter id={filterId} style={run.lines[0]} bounds={region} />
              </defs>
            )}
            {run.lines.map((line) => (
              <LineShape
                key={line.id}
                d={lineGeometry(line).d}
                style={line}
                transform={offsetOf(line.id)}
                className={line.id === props.pulseId ? "scene-focus-pulse" : undefined}
              />
            ))}
          </g>
        );
      })}

      {/* Hit paths and the selection box sit outside the shadow groups (no shadow, one pass).
          While armed to draw, clicking a line selects it instead of starting a
          new one — except mid-way through a pen line, where clicks add points. */}
      {interactive &&
        !(drawing && draft) &&
        lines.filter((line) => !props.editableIds || props.editableIds.has(line.id)).map((line) => (
          <path
            key={line.id}
            d={lineGeometry(line).d}
            transform={offsetOf(line.id)}
            fill="none"
            stroke="transparent"
            strokeWidth={Math.max(line.width * 1.5, hitWidth)}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: "stroke", cursor: line.id === selectedLineId ? "move" : "pointer" }}
            onMouseDown={(e) => props.onLineMouseDown(e, line)}
            onMouseEnter={() => props.onLineHover(true)}
            onMouseLeave={() => props.onLineHover(false)}
          />
        ))}
      {selectedLine && (
        <g transform={offsetOf(selectedLine.id)}>
          <SelectionBox points={selectedLine.points} pad={selectedLine.width} />
        </g>
      )}

      {drawing && draftD && (
        <g style={{ pointerEvents: "none" }}>
          <DraftShape d={draftD} points={draft ?? []} style={draftStyle} />
          {mode === "pen" &&
            draft?.map((p, i) => (
              <g key={i}>
                {p.cin && p.cout && (
                  <line x1={p.cin.x} y1={p.cin.y} x2={p.cout.x} y2={p.cout.y} stroke="#fff" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                )}
                {/* Zero-length paths with square caps and non-scaling strokes:
                    fixed-size squares on screen at any zoom (a rect sized in
                    map pixels grows huge when zoomed in). */}
                <path d={`M ${p.x} ${p.y} h 0`} stroke="#0D0E10" strokeWidth={7} strokeLinecap="square" vectorEffect="non-scaling-stroke" />
                <path d={`M ${p.x} ${p.y} h 0`} stroke={p.cout ? "#fff" : "#9CA3AF"} strokeWidth={5} strokeLinecap="square" vectorEffect="non-scaling-stroke" />
              </g>
            ))}
        </g>
      )}
    </svg>
  );
}

function LineShape({ d, style, transform, className }: { d: string; style: LineStyle; transform?: string; className?: string }) {
  return (
    <path
      d={d}
      transform={transform}
      className={className}
      fill="none"
      stroke={style.color}
      strokeOpacity={style.opacity}
      strokeWidth={style.width}
      strokeLinecap={style.cap}
      strokeLinejoin="round"
      strokeDasharray={dashArray(style.style, style.width, style.dashLength, style.gapLength)}
      style={{ pointerEvents: "none" }}
    />
  );
}

/** The in-progress line: its own shadow filter (it changes every mousemove). */
function DraftShape({ d, points, style }: { d: string; points: PenPt[]; style: LineStyle }) {
  const b = pointsBounds(points);
  const shadowed = style.shadowEnabled && b;
  return (
    <g filter={shadowed ? "url(#map-line-shadow-draft)" : undefined}>
      {shadowed && (
        <defs>
          <ShadowFilter id="map-line-shadow-draft" style={style} bounds={b} />
        </defs>
      )}
      <LineShape d={d} style={style} />
    </g>
  );
}

function SelectionBox({ points, pad }: { points: PenPt[]; pad: number }) {
  const b = pointsBounds(points);
  if (!b) return null;
  return (
    <rect
      x={b.x - pad}
      y={b.y - pad}
      width={b.width + pad * 2}
      height={b.height + pad * 2}
      fill="none"
      stroke="#fff"
      strokeWidth={1.5}
      strokeDasharray="6 4"
      vectorEffect="non-scaling-stroke"
      style={{ pointerEvents: "none" }}
    />
  );
}
