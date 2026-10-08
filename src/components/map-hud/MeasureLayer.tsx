"use client";

import { useEffect, useRef, useState } from "react";
import type OpenSeadragonType from "openseadragon";
import { clientToImagePoint, type Pt } from "@/components/osd-coords";
import { formatDistance, formatNumber, scaleUnitLabel, SCALE_UNITS, type ScaleConfig, type ScaleUnit } from "@/server/scale/scale-config";
import { useViewportTick } from "./MapScaleBar";
import { useT } from "@/i18n/useT";

export type MeasureMode = "measure" | "calibrate" | "travel";

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

/** `p` moved onto the nearest 45° direction from `from` (Shift while measuring). */
function snap45(from: Pt, p: Pt): Pt {
  const d = dist(from, p);
  const angle = Math.round(Math.atan2(p.y - from.y, p.x - from.x) / (Math.PI / 4)) * (Math.PI / 4);
  return { x: from.x + d * Math.cos(angle), y: from.y + d * Math.sin(angle) };
}

/** A frame-pixel point on screen, relative to the viewer's container. */
function toScreen(viewer: OpenSeadragonType.Viewer, p: Pt): Pt {
  const tiledImage = viewer.world.getItemAt(0);
  const px = viewer.viewport.pixelFromPoint(tiledImage.imageToViewportCoordinates(p.x, p.y), true);
  return { x: px.x, y: px.y };
}

/**
 * The ruler and the scale calibration, drawn over the map window:
 * - measure: each click adds a point (Shift keeps the segment on 45°
 *   angles); every segment and the total read in the calibrated unit.
 *   Backspace removes the last point, Esc or right-click clears.
 * - calibrate: click two points a known distance apart, then type that
 *   distance; `onCalibrate` gets the frame pixels per unit.
 * - travel: a route drawn like the ruler; `onPathChange` reports its
 *   length (frame pixels) and `summary` labels its end (e.g. the trip time).
 * Clicks come from OpenSeadragon's quick-click event, so dragging still pans.
 */
export default function MeasureLayer({
  viewer,
  osd,
  mode,
  config,
  onCalibrate,
  onCancelCalibration,
  onPathChange,
  onFinish,
  summary,
}: {
  viewer: OpenSeadragonType.Viewer | null;
  osd: typeof OpenSeadragonType | null;
  mode: MeasureMode;
  config: ScaleConfig;
  onCalibrate: (framePxPerUnit: number, unit: ScaleUnit) => void;
  onCancelCalibration: () => void;
  /** The drawn path's length in frame pixels, whenever its points change. */
  onPathChange?: (framePx: number) => void;
  /** Given: right-click or Enter finishes the path (2+ points) and hands it over, instead of clearing it. */
  onFinish?: (points: Pt[]) => void;
  /** Replaces the "Total …" label at the path's end. */
  summary?: (framePx: number) => string;
}) {
  const t = useT("maps");
  const tc = useT("common");
  useViewportTick(viewer);
  const [points, setPoints] = useState<Pt[]>([]);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [distance, setDistance] = useState("");
  const [unit, setUnit] = useState<ScaleUnit>(config.unit);
  const shiftRef = useRef(false);
  const calibrating = mode === "calibrate";
  const full = calibrating && points.length >= 2;

  // A new mode starts a new path (derived-state reset, not an effect).
  const [lastMode, setLastMode] = useState(mode);
  if (lastMode !== mode) {
    setLastMode(mode);
    setPoints([]);
    setDistance("");
  }

  const pointsRef = useRef(points);
  useEffect(() => {
    pointsRef.current = points;
  });
  const onPathChangeRef = useRef(onPathChange);
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onPathChangeRef.current = onPathChange;
    onFinishRef.current = onFinish;
  });
  useEffect(() => {
    onPathChangeRef.current?.(points.slice(1).reduce((sum, p, i) => sum + dist(points[i], p), 0));
  }, [points]);

  useEffect(() => {
    if (!viewer || !osd) return;
    const el = viewer.container;
    const at = (clientX: number, clientY: number, shift: boolean): Pt | null => {
      const p = clientToImagePoint(viewer, osd, clientX, clientY);
      const last = pointsRef.current[pointsRef.current.length - 1];
      return p && last && shift ? snap45(last, p) : p;
    };
    const onClick = (event: OpenSeadragonType.CanvasClickEvent) => {
      if (!event.quick) return;
      event.preventDefaultAction = true;
      const rect = el.getBoundingClientRect();
      const p = at(rect.left + event.position.x, rect.top + event.position.y, shiftRef.current);
      if (!p) return;
      setPoints((prev) => (calibrating && prev.length >= 2 ? [p] : [...prev, p]));
    };
    let frame = 0;
    const onMove = (e: MouseEvent) => {
      shiftRef.current = e.shiftKey;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setCursor(at(e.clientX, e.clientY, e.shiftKey)));
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      setCursor(null);
    };
    /** Hands a finished path over (when finishing is on); true when it did. */
    const finish = () => {
      const done = onFinishRef.current;
      if (!done || pointsRef.current.length < 2) return false;
      done(pointsRef.current);
      setPoints([]);
      return true;
    };
    const onContextMenu = (e: MouseEvent) => {
      if (!pointsRef.current.length) return;
      e.preventDefault();
      if (!finish() && !onFinishRef.current) setPoints([]);
    };
    // Capture phase, ahead of the map's own Esc handling (which would close the panel).
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (!pointsRef.current.length) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setPoints([]);
      } else if (e.key === "Enter" && onFinishRef.current) {
        e.preventDefault();
        finish();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        setPoints((prev) => prev.slice(0, -1));
      }
    };
    viewer.addHandler("canvas-click", onClick);
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    el.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      cancelAnimationFrame(frame);
      viewer.removeHandler("canvas-click", onClick);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      el.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [viewer, osd, calibrating]);

  if (!viewer || !viewer.world.getItemAt(0)) return null;

  const path = !full && cursor && points.length ? [...points, cursor] : points;
  const screen = path.map((p) => toScreen(viewer, p));
  const ppu = config.framePxPerUnit;
  const label = (framePx: number) => (ppu ? formatDistance(framePx / ppu, config) : `${formatNumber(framePx)} px`);
  let total = 0;
  const segments = path.slice(1).map((p, i) => {
    const d = dist(path[i], p);
    total += d;
    return { d, mid: { x: (screen[i].x + screen[i + 1].x) / 2, y: (screen[i].y + screen[i + 1].y) / 2 } };
  });
  const end = screen[screen.length - 1];
  const calibratedPx = full ? dist(points[0], points[1]) : 0;

  function submitCalibration(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(distance.replace(",", "."));
    if (!(value > 0) || !calibratedPx) return;
    onCalibrate(calibratedPx / value, unit);
    setPoints([]);
    setDistance("");
  }

  return (
    <div className="measure-layer">
      <svg className="measure-svg" aria-hidden>
        {screen.length > 1 && <polyline points={screen.map((p) => `${p.x},${p.y}`).join(" ")} className="measure-path" />}
        {screen.map((p, i) => (i < points.length ? <circle key={i} cx={p.x} cy={p.y} r={4} className="measure-point" /> : null))}
        {!calibrating &&
          segments.length > 1 &&
          segments.map((s, i) => (
            <text key={i} x={s.mid.x} y={s.mid.y - 8} className="measure-label measure-label-segment" textAnchor="middle">
              {label(s.d)}
            </text>
          ))}
        {end && segments.length > 0 && (
          <text x={end.x + 10} y={end.y - 10} className="measure-label">
            {calibrating ? label(total) : summary ? summary(total) : t("measure.total", { value: label(total) })}
          </text>
        )}
      </svg>
      <div className="measure-hint" role="status">
        {calibrating
          ? full
            ? t("measure.typeDistance")
            : points.length
              ? t("measure.secondPoint")
              : t("measure.firstPoint")
          : points.length
            ? onFinish
              ? t("measure.routeHint")
              : t("measure.pathHint")
            : mode === "travel"
              ? t("measure.travelStart")
            : ppu
              ? t("measure.start")
              : t("measure.uncalibrated")}
      </div>
      {full && end && (
        <form className="measure-calibrate rich-floating" style={{ left: end.x + 12, top: end.y + 12 }} onSubmit={submitCalibration}>
          <label className="field-label" htmlFor="measure-distance">
            {t("measure.realDistance")}
          </label>
          <div className="measure-calibrate-row">
            <input id="measure-distance" type="text" inputMode="decimal" autoFocus value={distance} placeholder={t("measure.distancePlaceholder")} onChange={(e) => setDistance(e.target.value)} />
            <select aria-label={t("scale.unit")} value={unit} onChange={(e) => setUnit(e.target.value as ScaleUnit)}>
              {SCALE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u === "custom" ? config.customLabel || scaleUnitLabel(u) : scaleUnitLabel(u)}
                </option>
              ))}
            </select>
          </div>
          <div className="marker-panel-actions">
            <button type="submit" className="btn btn-sm btn-primary" disabled={!(Number(distance.replace(",", ".")) > 0)}>
              {t("measure.setScale")}
            </button>
            <button type="button" className="btn btn-sm" onClick={onCancelCalibration}>
              {tc("cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
