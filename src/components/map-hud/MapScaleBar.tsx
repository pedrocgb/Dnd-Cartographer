"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type OpenSeadragonType from "openseadragon";
import { screenPxPerImagePx } from "@/components/osd-coords";
import { scaleBarLayout, unitSuffix, type ScaleBarLayout, type ScaleConfig } from "@/server/scale/scale-config";
import { useHudDrag } from "./use-hud-drag";
import { useT } from "@/i18n/useT";

/** Longest the bar may get, as a share of the map window's width. */
const MAX_WIDTH_SHARE = 0.45;
const BAR_H = 8;
/** `.map-scale`'s left/right padding (globals.css), part of the widget's width. */
const SCALE_PAD_X = 6;

const TONES = {
  light: { fg: "#F4F4F5", bg: "#18181B", plate: "rgb(20 21 24 / 0.78)" },
  dark: { fg: "#18181B", bg: "#FAFAFA", plate: "rgb(250 250 250 / 0.82)" },
} as const;

/**
 * A number that changes on every pan/zoom frame (and resize), so screen
 * positions computed from the viewport during render stay current.
 */
export function useViewportTick(viewer: OpenSeadragonType.Viewer | null): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!viewer) return;
    let frame = 0;
    const bump = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setTick((t) => t + 1));
    };
    // OSD raises these inside its own frame, right after drawing the map:
    // re-rendering synchronously paints the overlay in that same frame. A
    // deferred render lands a frame late, so the overlay trails the map
    // while it pans (visible as a wobble).
    const sync = () => {
      cancelAnimationFrame(frame);
      flushSync(() => setTick((t) => t + 1));
    };
    const deferred = ["open", "resize"] as const;
    const inFrame = ["animation", "animation-finish"] as const;
    for (const e of deferred) viewer.addHandler(e, bump);
    for (const e of inFrame) viewer.addHandler(e, sync);
    bump();
    return () => {
      cancelAnimationFrame(frame);
      for (const e of deferred) viewer.removeHandler(e, bump);
      for (const e of inFrame) viewer.removeHandler(e, sync);
    };
  }, [viewer]);
  return tick;
}

/** The bar's segments, subdivisions and ticks, `x0` being where "0" sits. */
function Bar({ layout, config, x0, y, fg, bg }: { layout: ScaleBarLayout; config: ScaleConfig; x0: number; y: number; fg: string; bg: string }) {
  const { stepPx, steps } = layout;
  const parts: React.ReactNode[] = [];
  // Every drawn cell: the first step split into `subdivideFirst` cells when asked.
  const cells: { x: number; w: number; i: number }[] = [];
  for (let s = 0; s < steps; s++) {
    const sub = s === 0 && config.subdivideFirst > 0 ? config.subdivideFirst : 1;
    for (let k = 0; k < sub; k++) cells.push({ x: x0 + s * stepPx + (k * stepPx) / sub, w: stepPx / sub, i: cells.length });
  }
  const total = layout.totalPx;

  if (config.style === "ticks") {
    parts.push(<line key="base" x1={x0} x2={x0 + total} y1={y + BAR_H} y2={y + BAR_H} stroke={fg} strokeWidth={2} />);
    cells.forEach((c) => parts.push(<line key={`t${c.i}`} x1={c.x} x2={c.x} y1={y + BAR_H / 2} y2={y + BAR_H} stroke={fg} strokeWidth={1.5} />));
    for (let s = 0; s <= steps; s++) parts.push(<line key={`s${s}`} x1={x0 + s * stepPx} x2={x0 + s * stepPx} y1={y} y2={y + BAR_H} stroke={fg} strokeWidth={2} />);
    return <>{parts}</>;
  }
  if (config.style === "double") {
    const half = BAR_H / 2;
    cells.forEach((c) => {
      parts.push(<rect key={`a${c.i}`} x={c.x} y={y} width={c.w} height={half} fill={c.i % 2 ? bg : fg} />);
      parts.push(<rect key={`b${c.i}`} x={c.x} y={y + half} width={c.w} height={half} fill={c.i % 2 ? fg : bg} />);
    });
  } else if (config.style === "hollow") {
    cells.forEach((c) => c.i % 2 === 0 && parts.push(<rect key={`h${c.i}`} x={c.x} y={y + BAR_H / 3} width={c.w} height={BAR_H / 3} fill={fg} />));
  } else {
    cells.forEach((c) => parts.push(<rect key={`c${c.i}`} x={c.x} y={y} width={c.w} height={BAR_H} fill={c.i % 2 ? bg : fg} />));
  }
  parts.push(<rect key="outline" x={x0} y={y} width={total} height={BAR_H} fill="none" stroke={fg} strokeWidth={1} />);
  return <>{parts}</>;
}

/**
 * The scale bar over the map window: it stays put while the map pans and
 * zooms, and its length follows the zoom so each step always spans its
 * distance on the map (with autoStep, the step itself gets rounder values
 * when the bar would grow too short or too long). Draggable while editing.
 */
export default function MapScaleBar({
  viewer,
  config,
  area,
  inset,
  editable,
  onUpdateConfig,
}: {
  viewer: OpenSeadragonType.Viewer | null;
  config: ScaleConfig;
  area: HTMLElement | null;
  inset: number;
  editable: boolean;
  onUpdateConfig: (patch: Partial<ScaleConfig>) => void;
}) {
  const t = useT("maps");
  const [widget, setWidget] = useState<HTMLDivElement | null>(null);
  useViewportTick(viewer);
  const screenPerFrame = screenPxPerImagePx(viewer);
  const maxPx = Math.max(120, (area?.clientWidth ?? 800) * MAX_WIDTH_SHARE);
  const layout = config.framePxPerUnit ? scaleBarLayout(config.framePxPerUnit * screenPerFrame, config, maxPx) : null;
  const fontSize = config.labelSize;
  const suffix = unitSuffix(config);
  const padL = layout ? Math.ceil(fontSize * 0.4 * layout.labels[0].length) + 6 : 0;
  const lastLabelHalf = layout ? fontSize * 0.3 * layout.labels[layout.labels.length - 1].length : 0;
  const suffixW = Math.ceil(fontSize * 0.62 * suffix.length);
  const width = layout ? Math.ceil(padL + layout.totalPx + Math.max(lastLabelHalf, 0) + 6 + suffixW + 6) : 0;
  const { style, handleProps, dragging } = useHudDrag({
    area,
    widget,
    position: config.position,
    inset,
    editable,
    onCommit: (position) => onUpdateConfig({ position }),
    // The bar's width this frame (plus .map-scale's side padding): it's clamped into the window at its new size.
    width: width + 2 * SCALE_PAD_X,
  });
  if (!layout) return null;

  const tone = TONES[config.tone];
  const labelY = fontSize + 2;
  const barY = labelY + 4;
  const height = barY + BAR_H + 6;

  return (
    <div
      ref={setWidget}
      className={["map-scale", editable && "editing", dragging && "dragging"].filter(Boolean).join(" ")}
      style={{ ...style, background: config.plate ? tone.plate : "transparent" }}
      {...handleProps}
      aria-label={editable ? t("scale.barLabelEdit") : t("scale.barLabel", { value: layout.labels[1], unit: suffix })}
      data-tooltip={editable ? t("scale.barDragHint") : undefined}
    >
      <svg width={width} height={height} aria-hidden style={{ display: "block" }}>
        <g fontSize={fontSize} fill={tone.fg} fontFamily="inherit" style={{ paintOrder: "stroke" }} stroke={config.plate ? "none" : tone.bg} strokeWidth={config.plate ? 0 : 3} strokeLinejoin="round">
          {layout.labels.map((label, i) => (
            <text key={i} x={padL + i * layout.stepPx} y={labelY} textAnchor="middle">
              {label}
            </text>
          ))}
          <text x={padL + layout.totalPx + Math.max(lastLabelHalf, 0) + 6} y={labelY}>
            {suffix}
          </text>
        </g>
        <Bar layout={layout} config={config} x0={padL} y={barY} fg={tone.fg} bg={tone.bg} />
      </svg>
    </div>
  );
}
