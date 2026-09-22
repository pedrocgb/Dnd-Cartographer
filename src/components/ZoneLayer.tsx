"use client";

import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type OpenSeadragonType from "openseadragon";
import { setOsdNavEnabled } from "./osd-nav";

export interface ZoneRegionData {
  id: string;
  mapId: string;
  name: string;
  visible: boolean;
  locked: boolean;
  sortOrder: number;
}

export interface ZoneData {
  id: string;
  regionId: string;
  mapId: string;
  name: string;
  shapeType: "rectangle" | "circle" | "polygon";
  geometry: string; // JSON — parsed on demand
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeOpacity: number;
  strokeWidth: number;
  visible: boolean;
  locked: boolean;
  sortOrder: number;
  territoryId: string | null;
}

export type ZoneTool = "select" | "rectangle" | "circle" | "polygon";

interface Pt {
  x: number;
  y: number;
}

type RectGeom = { x: number; y: number; width: number; height: number };
type CircleGeom = { x: number; y: number; radius: number };
type PolygonGeom = { points: Pt[] };

function parseGeom(zone: ZoneData): RectGeom | CircleGeom | PolygonGeom {
  return JSON.parse(zone.geometry);
}

const CLICK_THRESHOLD_PX = 5;
const CLOSURE_SCREEN_PX = 10;

interface Props {
  viewer: OpenSeadragonType.Viewer | null;
  osd: typeof OpenSeadragonType | null;
  authoring: boolean;
  regions: ZoneRegionData[];
  zones: ZoneData[];
  activeTool: ZoneTool;
  activeRegionId: string | null;
  selectedZoneId: string | null;
  onSelectZone: (id: string | null) => void;
  onCreateZone: (regionId: string, shapeType: ZoneTool, geometry: RectGeom | CircleGeom | PolygonGeom) => void;
  onUpdateZoneGeometry: (zoneId: string, geometry: RectGeom | CircleGeom | PolygonGeom) => void;
}

type Draft =
  | { kind: "rectangle"; start: Pt; current: Pt; shift: boolean }
  | { kind: "circle"; center: Pt; current: Pt }
  | { kind: "polygon"; points: Pt[]; hover: Pt | null };

type Transform =
  | { kind: "move"; zoneId: string; original: RectGeom | CircleGeom | PolygonGeom; startImg: Pt; deltaX: number; deltaY: number }
  | { kind: "resize-rect"; zoneId: string; original: RectGeom; corner: "nw" | "ne" | "se" | "sw"; current: RectGeom; shift: boolean }
  | { kind: "resize-circle"; zoneId: string; original: CircleGeom; current: CircleGeom }
  | { kind: "vertex"; zoneId: string; original: PolygonGeom; index: number; current: PolygonGeom };

export default function ZoneLayer({
  viewer,
  osd,
  authoring,
  regions,
  zones,
  activeTool,
  activeRegionId,
  selectedZoneId,
  onSelectZone,
  onCreateZone,
  onUpdateZoneGeometry,
}: Props) {
  const overlayRef = useRef<{ el: HTMLDivElement; root: Root } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [transform, setTransform] = useState<Transform | null>(null);
  const [hoveredVertex, setHoveredVertex] = useState<number | null>(null);

  const latestRef = useRef({ regions, zones, selectedZoneId, activeTool, activeRegionId });
  useEffect(() => {
    latestRef.current = { regions, zones, selectedZoneId, activeTool, activeRegionId };
  }, [regions, zones, selectedZoneId, activeTool, activeRegionId]);

  // Reset any in-progress draft when the tool changes, the panel closes, or
  // authoring is turned off — an unfinished sketch never survives a tool
  // switch, but completed (already-saved) zones are untouched. Done as a
  // render-time adjustment (React's documented pattern for state that
  // depends on a changed prop) rather than in an effect.
  const toolAuthKey = `${activeTool}|${authoring}`;
  const [lastToolAuthKey, setLastToolAuthKey] = useState(toolAuthKey);
  if (toolAuthKey !== lastToolAuthKey) {
    setLastToolAuthKey(toolAuthKey);
    setDraft(null);
  }

  // Disabling OSD's own nav *inside* a mousedown handler (as the
  // gesture-start functions below already do, as a redundant safety net) is
  // too late to reliably stop it — OSD's own tracker can begin arming a pan
  // on the very same native mousedown before our handler runs, which is
  // exactly what made drawing impossible (every click/drag panned the map
  // instead of drawing). Disabling proactively, as soon as a draw tool is
  // armed or a zone is selected for editing — not waiting for the next
  // mousedown at all — closes that race. This disables scroll-zoom too (see
  // osd-nav.ts for why a narrower toggle isn't safe here); MapWorkspace runs
  // its own wheel-zoom bypass so scrolling still works while this is off.
  // This is a genuine external-system side effect (not a setState call), so
  // a plain effect is the right tool here.
  useEffect(() => {
    if (!viewer || !authoring) return;
    const shouldDisablePan = activeTool !== "select" || Boolean(selectedZoneId);
    if (!shouldDisablePan) return;
    setOsdNavEnabled(viewer, false);
    return () => {
      setOsdNavEnabled(viewer, true);
    };
  }, [viewer, authoring, activeTool, selectedZoneId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") {
        if (transform) setTransform(null);
        else if (draft) setDraft(null);
        return;
      }
      if (draft?.kind === "polygon") {
        if (e.key === "Backspace" && draft.points.length > 0) {
          setDraft({ ...draft, points: draft.points.slice(0, -1) });
        } else if (e.key === "Enter" && draft.points.length >= 3) {
          commitPolygon(draft.points);
        }
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && hoveredVertex !== null && selectedZoneId) {
        const zone = latestRef.current.zones.find((z) => z.id === selectedZoneId);
        if (zone && zone.shapeType === "polygon" && !zone.locked) {
          const geom = parseGeom(zone) as PolygonGeom;
          if (geom.points.length > 3) {
            const nextPoints = geom.points.filter((_, i) => i !== hoveredVertex);
            onUpdateZoneGeometry(zone.id, { points: nextPoints });
            setHoveredVertex(null);
          }
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, transform, hoveredVertex, selectedZoneId]);

  function commitPolygon(points: Pt[]) {
    const active = latestRef.current.activeRegionId;
    if (!active) return;
    onCreateZone(active, "polygon", { points });
    setDraft(null);
    // Stay in the polygon tool (nav stays disabled) until the async create
    // resolves and the parent flips activeTool/selectedZoneId together — an
    // eager tool switch here would open a real window where neither
    // condition holds and OSD's own pan takes over the very next click.
  }

  useEffect(() => {
    if (!viewer || !osd) return;
    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) return;

    const bounds = tiledImage.getBounds(true);
    if (!overlayRef.current) {
      const el = document.createElement("div");
      el.className = "zone-layer-overlay";
      const root = createRoot(el);
      overlayRef.current = { el, root };
      viewer.addOverlay({ element: el, location: bounds, checkResize: true });
    } else {
      viewer.updateOverlay(overlayRef.current.el, bounds);
    }
  }, [viewer, osd]);

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

  function getImageSize(): { w: number; h: number } | null {
    const tiledImage = viewer?.world.getItemAt(0);
    if (!tiledImage) return null;
    const size = tiledImage.getContentSize();
    return { w: size.x, h: size.y };
  }

  function toImagePoint(clientX: number, clientY: number): Pt | null {
    if (!viewer || !osd) return null;
    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) return null;
    const rect = viewer.container.getBoundingClientRect();
    const vp = viewer.viewport.pointFromPixel(new osd.Point(clientX - rect.left, clientY - rect.top));
    const img = tiledImage.viewportToImageCoordinates(vp);
    return { x: img.x, y: img.y };
  }

  /** CSS-pixel distance per one image-pixel unit, for screen-space tolerances (handle size, closure snap). */
  function screenPxPerImagePx(): number {
    if (!viewer) return 1;
    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) return 1;
    const p0 = viewer.viewport.pixelFromPoint(tiledImage.imageToViewportCoordinates(0, 0), true);
    const p1 = viewer.viewport.pixelFromPoint(tiledImage.imageToViewportCoordinates(100, 0), true);
    return Math.hypot(p1.x - p0.x, p1.y - p0.y) / 100;
  }

  function setNav(enabled: boolean) {
    setOsdNavEnabled(viewer, enabled);
  }

  // ---- Drawing gestures (rectangle/circle drag, polygon click) ----

  function beginRectOrCircleDraw(e: React.MouseEvent) {
    if (e.button !== 0) return; // left button only — middle stays free for panning
    if (!activeRegionId) return;
    const start = toImagePoint(e.clientX, e.clientY);
    const imageSize = getImageSize();
    if (!start || !imageSize) return;
    setNav(false);
    let dragging = false;
    const startClient = { x: e.clientX, y: e.clientY };

    function onMove(ev: MouseEvent) {
      const cur = toImagePoint(ev.clientX, ev.clientY);
      if (!cur) return;
      if (!dragging && Math.hypot(ev.clientX - startClient.x, ev.clientY - startClient.y) < CLICK_THRESHOLD_PX) return;
      dragging = true;
      if (activeTool === "rectangle") {
        setDraft({ kind: "rectangle", start: start!, current: cur, shift: ev.shiftKey });
      } else if (activeTool === "circle") {
        setDraft({ kind: "circle", center: start!, current: cur });
      }
    }

    // Nav is re-enabled by the effect below (keyed on authoring/activeTool/
    // selectedZoneId), not here — this gesture always starts while that
    // effect has already disabled it, and re-enabling unconditionally on
    // every mouseup raced the *next* gesture's own mousedown, reopening the
    // exact "clicking pans the map" bug this was meant to fix.
    function onUp(ev: MouseEvent) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (!dragging) {
        setDraft(null);
        return;
      }
      const cur = toImagePoint(ev.clientX, ev.clientY);
      if (!cur || !imageSize) {
        setDraft(null);
        return;
      }
      if (activeTool === "rectangle") {
        const geom = rectFromDrag(start!, cur, ev.shiftKey, imageSize);
        setDraft(null);
        if (geom) onCreateZoneAndReset(geom);
      } else if (activeTool === "circle") {
        const geom = circleFromDrag(start!, cur, imageSize);
        setDraft(null);
        if (geom) onCreateZoneAndReset(geom);
      }
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function onCreateZoneAndReset(geom: RectGeom | CircleGeom) {
    if (!activeRegionId) return;
    onCreateZone(activeRegionId, activeTool === "circle" ? "circle" : "rectangle", geom);
    // See the comment in commitPolygon: leave the draw tool armed until the
    // async create resolves, so nav stays disabled continuously instead of
    // being re-enabled for the gap before selection lands.
  }

  function handlePolygonClick(e: React.MouseEvent) {
    const imageSize = getImageSize();
    if (!activeRegionId || !imageSize) return;
    const pt = toImagePoint(e.clientX, e.clientY);
    if (!pt) return;
    if (pt.x < 0 || pt.y < 0 || pt.x > imageSize.w || pt.y > imageSize.h) return;

    const current = draft?.kind === "polygon" ? draft.points : [];
    if (current.length >= 3) {
      const first = current[0];
      const scale = screenPxPerImagePx();
      const distScreen = Math.hypot(pt.x - first.x, pt.y - first.y) * scale;
      if (distScreen <= CLOSURE_SCREEN_PX) {
        commitPolygon(current);
        return;
      }
    }
    setDraft({ kind: "polygon", points: [...current, pt], hover: null });
  }

  function handlePolygonHover(e: React.MouseEvent) {
    if (draft?.kind !== "polygon") return;
    const pt = toImagePoint(e.clientX, e.clientY);
    if (pt) setDraft({ ...draft, hover: pt });
  }

  // ---- Selection / move / resize (Select mode) ----

  function beginMove(zone: ZoneData, e: React.MouseEvent) {
    if (e.button !== 0) return;
    if (zone.locked) return;
    e.stopPropagation();
    const startImg = toImagePoint(e.clientX, e.clientY);
    if (!startImg) return;
    const original = parseGeom(zone);
    const imageSize = getImageSize();
    const startClient = { x: e.clientX, y: e.clientY };
    let dragging = false;
    let delta = { x: 0, y: 0 };
    setNav(false);

    function onMove(ev: MouseEvent) {
      if (!dragging && Math.hypot(ev.clientX - startClient.x, ev.clientY - startClient.y) < CLICK_THRESHOLD_PX) return;
      dragging = true;
      const cur = toImagePoint(ev.clientX, ev.clientY);
      if (!cur) return;
      delta = { x: cur.x - startImg!.x, y: cur.y - startImg!.y };
      setTransform({ kind: "move", zoneId: zone.id, original, startImg: startImg!, deltaX: delta.x, deltaY: delta.y });
    }

    // Commit reads the gesture's own tracked values (delta/dragging above),
    // not the React state via a setState updater — calling another
    // component's setState (onUpdateZoneGeometry -> setZones) from inside a
    // setTransform updater function fires during React's render phase and
    // triggers "Cannot update a component while rendering a different
    // component." Plain state (this closure) has no such restriction.
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setTransform(null);
      if (!dragging) {
        onSelectZone(zone.id);
        return;
      }
      if (!imageSize) return;
      const moved = translateGeometry(original, delta.x, delta.y, imageSize);
      onUpdateZoneGeometry(zone.id, moved);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function beginRectResize(zone: ZoneData, corner: "nw" | "ne" | "se" | "sw", e: React.MouseEvent) {
    if (e.button !== 0) return;
    if (zone.locked) return;
    e.stopPropagation();
    const original = parseGeom(zone) as RectGeom;
    const imageSize = getImageSize();
    let latest = original;
    setNav(false);
    setTransform({ kind: "resize-rect", zoneId: zone.id, original, corner, current: original, shift: e.shiftKey });

    function onMove(ev: MouseEvent) {
      const cur = toImagePoint(ev.clientX, ev.clientY);
      if (!cur || !imageSize) return;
      latest = resizeRect(original, corner, cur, ev.shiftKey, imageSize);
      setTransform({ kind: "resize-rect", zoneId: zone.id, original, corner, current: latest, shift: ev.shiftKey });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setTransform(null);
      onUpdateZoneGeometry(zone.id, latest);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function beginCircleResize(zone: ZoneData, e: React.MouseEvent) {
    if (e.button !== 0) return;
    if (zone.locked) return;
    e.stopPropagation();
    const original = parseGeom(zone) as CircleGeom;
    const imageSize = getImageSize();
    let latest = original;
    setNav(false);

    function onMove(ev: MouseEvent) {
      const cur = toImagePoint(ev.clientX, ev.clientY);
      if (!cur || !imageSize) return;
      const maxR = Math.max(1, Math.min(original.x, original.y, imageSize.w - original.x, imageSize.h - original.y));
      const radius = Math.min(maxR, Math.max(1, Math.hypot(cur.x - original.x, cur.y - original.y)));
      latest = { ...original, radius };
      setTransform({ kind: "resize-circle", zoneId: zone.id, original, current: latest });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setTransform(null);
      onUpdateZoneGeometry(zone.id, latest);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function beginVertexDrag(zone: ZoneData, index: number, e: React.MouseEvent, insertAt?: Pt) {
    if (e.button !== 0) return;
    if (zone.locked) return;
    e.stopPropagation();
    const original = parseGeom(zone) as PolygonGeom;
    let points = original.points;
    let idx = index;
    if (insertAt) {
      points = [...points.slice(0, index + 1), insertAt, ...points.slice(index + 1)];
      idx = index + 1;
    }
    const imageSize = getImageSize();
    let latestPoints = points;
    setNav(false);
    setTransform({ kind: "vertex", zoneId: zone.id, original, index: idx, current: { points } });

    function onMove(ev: MouseEvent) {
      const cur = toImagePoint(ev.clientX, ev.clientY);
      if (!cur || !imageSize) return;
      const clamped = { x: Math.min(imageSize.w, Math.max(0, cur.x)), y: Math.min(imageSize.h, Math.max(0, cur.y)) };
      latestPoints = points.map((p, i) => (i === idx ? clamped : p));
      setTransform({ kind: "vertex", zoneId: zone.id, original, index: idx, current: { points: latestPoints } });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setTransform(null);
      onUpdateZoneGeometry(zone.id, { points: latestPoints });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // ---- Render ----

  useEffect(() => {
    const entry = overlayRef.current;
    const imageSize = getImageSize();
    if (!entry || !imageSize) return;

    if (!authoring) {
      entry.root.render(
        <ZoneSvg
          imageWidth={imageSize.w}
          imageHeight={imageSize.h}
          regions={regions}
          zones={zones}
          interactive={false}
        />
      );
      return;
    }

    const drawTool = activeTool !== "select";
    entry.root.render(
      <ZoneSvg
        imageWidth={imageSize.w}
        imageHeight={imageSize.h}
        regions={regions}
        zones={zones}
        interactive={!drawTool}
        selectedZoneId={selectedZoneId}
        transform={transform}
        onZoneMouseDown={beginMove}
        onRectHandleMouseDown={beginRectResize}
        onCircleHandleMouseDown={beginCircleResize}
        onVertexMouseDown={(zone, i, e) => beginVertexDrag(zone, i, e)}
        onMidpointMouseDown={(zone, i, pt, e) => beginVertexDrag(zone, i, e, pt)}
        onVertexHover={setHoveredVertex}
        draft={draft}
        drawTool={drawTool ? activeTool : null}
        onDrawMouseDown={activeTool === "rectangle" || activeTool === "circle" ? beginRectOrCircleDraw : undefined}
        onDrawClick={activeTool === "polygon" ? handlePolygonClick : undefined}
        onDrawMouseMove={activeTool === "polygon" ? handlePolygonHover : undefined}
        onBackgroundMouseDown={() => onSelectZone(null)}
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, osd, authoring, regions, zones, activeTool, activeRegionId, selectedZoneId, draft, transform]);

  return null;
}

// ---------- geometry helpers ----------

function rectFromDrag(start: Pt, end: Pt, shift: boolean, size: { w: number; h: number }): RectGeom | null {
  let x0 = Math.min(start.x, end.x);
  let y0 = Math.min(start.y, end.y);
  let x1 = Math.max(start.x, end.x);
  let y1 = Math.max(start.y, end.y);
  if (shift) {
    const side = Math.min(x1 - x0, y1 - y0);
    x1 = start.x >= end.x ? start.x : start.x + side;
    x0 = start.x >= end.x ? start.x - side : start.x;
    y1 = start.y >= end.y ? start.y : start.y + side;
    y0 = start.y >= end.y ? start.y - side : start.y;
  }
  x0 = Math.max(0, x0);
  y0 = Math.max(0, y0);
  x1 = Math.min(size.w, x1);
  y1 = Math.min(size.h, y1);
  const width = x1 - x0;
  const height = y1 - y0;
  if (width < 2 || height < 2) return null;
  return { x: x0, y: y0, width, height };
}

function circleFromDrag(center: Pt, edge: Pt, size: { w: number; h: number }): CircleGeom | null {
  const maxR = Math.max(0, Math.min(center.x, center.y, size.w - center.x, size.h - center.y));
  const radius = Math.min(maxR, Math.hypot(edge.x - center.x, edge.y - center.y));
  if (radius < 2) return null;
  return { x: center.x, y: center.y, radius };
}

function resizeRect(original: RectGeom, corner: "nw" | "ne" | "se" | "sw", cur: Pt, shift: boolean, size: { w: number; h: number }): RectGeom {
  const fixed =
    corner === "nw"
      ? { x: original.x + original.width, y: original.y + original.height }
      : corner === "ne"
        ? { x: original.x, y: original.y + original.height }
        : corner === "se"
          ? { x: original.x, y: original.y }
          : { x: original.x + original.width, y: original.y };
  const px = Math.min(size.w, Math.max(0, cur.x));
  const py = Math.min(size.h, Math.max(0, cur.y));
  let x0 = Math.min(fixed.x, px);
  let y0 = Math.min(fixed.y, py);
  let x1 = Math.max(fixed.x, px);
  let y1 = Math.max(fixed.y, py);
  if (shift) {
    const side = Math.max(1, Math.min(x1 - x0, y1 - y0));
    if (px >= fixed.x) x1 = x0 + side;
    else x0 = x1 - side;
    if (py >= fixed.y) y1 = y0 + side;
    else y0 = y1 - side;
  }
  return { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
}

function translateGeometry(
  geom: RectGeom | CircleGeom | PolygonGeom,
  dx: number,
  dy: number,
  size: { w: number; h: number }
): RectGeom | CircleGeom | PolygonGeom {
  if ("width" in geom) {
    const clampedDx = Math.min(size.w - geom.width - geom.x, Math.max(-geom.x, dx));
    const clampedDy = Math.min(size.h - geom.height - geom.y, Math.max(-geom.y, dy));
    return { ...geom, x: geom.x + clampedDx, y: geom.y + clampedDy };
  }
  if ("radius" in geom) {
    const clampedDx = Math.min(size.w - geom.radius - geom.x, Math.max(geom.radius - geom.x, dx));
    const clampedDy = Math.min(size.h - geom.radius - geom.y, Math.max(geom.radius - geom.y, dy));
    return { ...geom, x: geom.x + clampedDx, y: geom.y + clampedDy };
  }
  const xs = geom.points.map((p) => p.x);
  const ys = geom.points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const clampedDx = Math.min(size.w - maxX, Math.max(-minX, dx));
  const clampedDy = Math.min(size.h - maxY, Math.max(-minY, dy));
  return { points: geom.points.map((p) => ({ x: p.x + clampedDx, y: p.y + clampedDy })) };
}

function polygonPointsAttr(points: Pt[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

// ---------- SVG content ----------

interface SvgProps {
  imageWidth: number;
  imageHeight: number;
  regions: ZoneRegionData[];
  zones: ZoneData[];
  interactive: boolean;
  selectedZoneId?: string | null;
  transform?: Transform | null;
  onZoneMouseDown?: (zone: ZoneData, e: React.MouseEvent) => void;
  onRectHandleMouseDown?: (zone: ZoneData, corner: "nw" | "ne" | "se" | "sw", e: React.MouseEvent) => void;
  onCircleHandleMouseDown?: (zone: ZoneData, e: React.MouseEvent) => void;
  onVertexMouseDown?: (zone: ZoneData, index: number, e: React.MouseEvent) => void;
  onMidpointMouseDown?: (zone: ZoneData, index: number, pt: Pt, e: React.MouseEvent) => void;
  onVertexHover?: (index: number | null) => void;
  draft?: Draft | null;
  drawTool?: ZoneTool | null;
  onDrawMouseDown?: (e: React.MouseEvent) => void;
  onDrawClick?: (e: React.MouseEvent) => void;
  onDrawMouseMove?: (e: React.MouseEvent) => void;
  onBackgroundMouseDown?: () => void;
}

function ZoneSvg(props: SvgProps) {
  const { imageWidth, imageHeight, regions, zones, interactive } = props;
  const regionById = new Map(regions.map((r) => [r.id, r]));

  // Paint order: bottom of the (region, then zone) list first, top last —
  // "items higher in the list render in front."
  const combined = zones
    .map((z) => ({ zone: z, region: regionById.get(z.regionId) }))
    .filter((c): c is { zone: ZoneData; region: ZoneRegionData } => Boolean(c.region));
  combined.sort((a, b) => (a.region.sortOrder - b.region.sortOrder) || (a.zone.sortOrder - b.zone.sortOrder));
  const paintOrder = [...combined].reverse();

  const handleImgSize = Math.max(imageWidth, imageHeight) * 0.006;
  const strokeScale = imageWidth / 100;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      preserveAspectRatio="none"
      style={{ display: "block", pointerEvents: interactive || props.drawTool ? "auto" : "none" }}
      onMouseDown={
        props.drawTool
          ? props.onDrawMouseDown ??
            ((e: React.MouseEvent) => {
              if (e.button === 0) props.onBackgroundMouseDown?.();
            })
          : (e: React.MouseEvent) => {
              if (e.button === 0) props.onBackgroundMouseDown?.();
            }
      }
      onClick={props.onDrawClick}
      onMouseMove={props.onDrawMouseMove}
    >
      {paintOrder.map(({ zone, region }) => {
        const effectivelyVisible = region.visible && zone.visible;
        if (!effectivelyVisible) return null;
        const geom =
          props.transform && props.transform.zoneId === zone.id
            ? geometryFromTransform(props.transform, imageWidth, imageHeight)
            : (JSON.parse(zone.geometry) as RectGeom | CircleGeom | PolygonGeom);
        const clickable = interactive && !zone.locked && !region.locked;
        return (
          <g
            key={zone.id}
            style={{ pointerEvents: clickable ? "auto" : "none", cursor: clickable ? "move" : "default" }}
            onMouseDown={clickable ? (e) => props.onZoneMouseDown?.(zone, e) : undefined}
          >
            <ZoneShapeScaled zone={zone} geom={geom} strokeScale={strokeScale} />
          </g>
        );
      })}

      {interactive && props.selectedZoneId && renderHandles(props, zones, regionById, handleImgSize, imageWidth, imageHeight)}

      {props.drawTool && props.draft && renderDraft(props.draft)}
    </svg>
  );
}

function ZoneShapeScaled({ zone, geom, strokeScale }: { zone: ZoneData; geom: RectGeom | CircleGeom | PolygonGeom; strokeScale: number }) {
  const common = {
    fill: zone.fillColor,
    fillOpacity: zone.fillOpacity,
    stroke: zone.strokeColor,
    strokeOpacity: zone.strokeOpacity,
    strokeWidth: zone.strokeWidth * strokeScale,
  };
  if ("width" in geom) return <rect x={geom.x} y={geom.y} width={geom.width} height={geom.height} {...common} />;
  if ("radius" in geom) return <circle cx={geom.x} cy={geom.y} r={geom.radius} {...common} />;
  return <polygon points={polygonPointsAttr(geom.points)} {...common} />;
}

function geometryFromTransform(t: Transform, imageWidth: number, imageHeight: number): RectGeom | CircleGeom | PolygonGeom {
  if (t.kind === "move") return translateGeometry(t.original, t.deltaX, t.deltaY, { w: imageWidth, h: imageHeight });
  return t.current;
}

function renderHandles(
  props: SvgProps,
  zones: ZoneData[],
  regionById: Map<string, ZoneRegionData>,
  handleSize: number,
  imageWidth: number,
  imageHeight: number
) {
  const zone = zones.find((z) => z.id === props.selectedZoneId);
  if (!zone) return null;
  const region = regionById.get(zone.regionId);
  if (!region || zone.locked || region.locked) return null;

  const t = props.transform && props.transform.zoneId === zone.id ? props.transform : null;
  const geom = t ? geometryFromTransform(t, imageWidth, imageHeight) : (JSON.parse(zone.geometry) as RectGeom | CircleGeom | PolygonGeom);

  const half = handleSize / 2;
  if ("width" in geom) {
    const corners: Array<["nw" | "ne" | "se" | "sw", Pt]> = [
      ["nw", { x: geom.x, y: geom.y }],
      ["ne", { x: geom.x + geom.width, y: geom.y }],
      ["se", { x: geom.x + geom.width, y: geom.y + geom.height }],
      ["sw", { x: geom.x, y: geom.y + geom.height }],
    ];
    return (
      <g className="zone-handles">
        <rect
          x={geom.x}
          y={geom.y}
          width={geom.width}
          height={geom.height}
          fill="none"
          stroke="#fff"
          strokeDasharray={handleSize / 2}
          strokeWidth={handleSize * 0.15}
        />
        {corners.map(([corner, p]) => (
          <rect
            key={corner}
            x={p.x - half}
            y={p.y - half}
            width={handleSize}
            height={handleSize}
            fill="#fff"
            stroke="#111"
            strokeWidth={handleSize * 0.1}
            style={{ cursor: corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize" }}
            onMouseDown={(e) => props.onRectHandleMouseDown?.(zone, corner, e)}
          />
        ))}
      </g>
    );
  }

  if ("radius" in geom) {
    const handlePt = { x: geom.x + geom.radius, y: geom.y };
    return (
      <g className="zone-handles">
        <circle cx={geom.x} cy={geom.y} r={geom.radius} fill="none" stroke="#fff" strokeDasharray={handleSize / 2} strokeWidth={handleSize * 0.15} />
        <rect
          x={handlePt.x - half}
          y={handlePt.y - half}
          width={handleSize}
          height={handleSize}
          fill="#fff"
          stroke="#111"
          strokeWidth={handleSize * 0.1}
          style={{ cursor: "ew-resize" }}
          onMouseDown={(e) => props.onCircleHandleMouseDown?.(zone, e)}
        />
      </g>
    );
  }

  const pts = geom.points;
  return (
    <g className="zone-handles">
      <polygon points={polygonPointsAttr(pts)} fill="none" stroke="#fff" strokeDasharray={handleSize / 2} strokeWidth={handleSize * 0.15} />
      {pts.map((p, i) => {
        const next = pts[(i + 1) % pts.length];
        const mid = { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 };
        return (
          <g key={i}>
            <rect
              x={mid.x - half * 0.7}
              y={mid.y - half * 0.7}
              width={handleSize * 0.7}
              height={handleSize * 0.7}
              fill="#fff"
              fillOpacity={0.6}
              stroke="#111"
              strokeWidth={handleSize * 0.08}
              style={{ cursor: "copy" }}
              onMouseDown={(e) => props.onMidpointMouseDown?.(zone, i, mid, e)}
            />
            <rect
              x={p.x - half}
              y={p.y - half}
              width={handleSize}
              height={handleSize}
              fill="#fff"
              stroke="#111"
              strokeWidth={handleSize * 0.1}
              style={{ cursor: "move" }}
              onMouseEnter={() => props.onVertexHover?.(i)}
              onMouseLeave={() => props.onVertexHover?.(null)}
              onMouseDown={(e) => props.onVertexMouseDown?.(zone, i, e)}
            />
          </g>
        );
      })}
    </g>
  );
}

function renderDraft(draft: Draft) {
  const style = { fill: "#22C55E", fillOpacity: 0.2, stroke: "#22C55E", strokeOpacity: 0.9, strokeWidth: 2, strokeDasharray: "6 4" };
  if (draft.kind === "rectangle") {
    const x = Math.min(draft.start.x, draft.current.x);
    const y = Math.min(draft.start.y, draft.current.y);
    const width = Math.abs(draft.current.x - draft.start.x);
    const height = Math.abs(draft.current.y - draft.start.y);
    return <rect x={x} y={y} width={width} height={height} {...style} />;
  }
  if (draft.kind === "circle") {
    const radius = Math.hypot(draft.current.x - draft.center.x, draft.current.y - draft.center.y);
    return <circle cx={draft.center.x} cy={draft.center.y} r={radius} {...style} />;
  }
  const pts = draft.points;
  return (
    <g>
      {pts.length >= 2 && <polyline points={polygonPointsAttr(pts)} fill="none" stroke={style.stroke} strokeWidth={2} strokeDasharray="6 4" />}
      {pts.length >= 1 && draft.hover && (
        <line x1={pts[pts.length - 1].x} y1={pts[pts.length - 1].y} x2={draft.hover.x} y2={draft.hover.y} stroke={style.stroke} strokeWidth={2} strokeDasharray="4 4" />
      )}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill={i === 0 ? "#FACC15" : style.stroke} />
      ))}
    </g>
  );
}
