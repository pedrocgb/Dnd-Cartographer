"use client";

import { useEffect, useRef, useState } from "react";
import type { HudPosition } from "@/server/legends/legend-config";

const MARGIN = 8;
const KEY_STEP = 0.01;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(min, v), Math.max(min, max));

/** Follows an element's size (0×0 until it mounts). */
function useSize(el: HTMLElement | null) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!el) return;
    const observer = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }));
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return size;
}

/**
 * Places a screen-pinned map widget (legend, scale bar) inside the map
 * window: its stored top-left is a fraction of the window, so it keeps its
 * place when the window resizes, and it's always pushed back fully into
 * view (and right of an open side panel, `inset`).
 *
 * While `editable`, `handleProps` makes an element drag the widget
 * (pointer; arrow keys nudge it, Shift for bigger steps). The position
 * shows live and `onCommit` gets the final one on release.
 *
 * `width`: the widget's width this render, when the caller knows it. A
 * widget that grows every frame (the scale bar while zooming) would
 * otherwise be clamped with the size measured a frame late and stick out
 * of the window for a moment.
 */
export function useHudDrag({
  area,
  widget,
  position,
  inset,
  editable,
  onCommit,
  width,
}: {
  area: HTMLElement | null;
  widget: HTMLElement | null;
  position: HudPosition;
  inset: number;
  editable: boolean;
  onCommit: (position: HudPosition) => void;
  width?: number;
}) {
  const areaSize = useSize(area);
  const measured = useSize(widget);
  const widgetSize = width === undefined ? measured : { w: width, h: measured.h };
  const [dragPos, setDragPos] = useState<HudPosition | null>(null);
  const start = useRef<{ x: number; y: number; pos: HudPosition } | null>(null);

  const shown = dragPos ?? position;
  const left = clamp(shown.x * areaSize.w, inset + MARGIN, areaSize.w - widgetSize.w - MARGIN);
  const top = clamp(shown.y * areaSize.h, MARGIN, areaSize.h - widgetSize.h - MARGIN);

  /** The fraction position of a pixel top-left, clamped like the shown one. */
  const toFraction = (px: number, py: number): HudPosition => ({
    x: areaSize.w ? clamp(px, inset + MARGIN, areaSize.w - widgetSize.w - MARGIN) / areaSize.w : 0,
    y: areaSize.h ? clamp(py, MARGIN, areaSize.h - widgetSize.h - MARGIN) / areaSize.h : 0,
  });

  const handleProps = editable
    ? {
        tabIndex: 0,
        role: "button" as const,
        "aria-roledescription": "draggable",
        onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          start.current = { x: e.clientX, y: e.clientY, pos: { x: left / (areaSize.w || 1), y: top / (areaSize.h || 1) } };
        },
        onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
          const s = start.current;
          if (!s) return;
          setDragPos(toFraction(s.pos.x * areaSize.w + e.clientX - s.x, s.pos.y * areaSize.h + e.clientY - s.y));
        },
        onPointerUp: () => {
          start.current = null;
          if (dragPos) onCommit(dragPos);
          setDragPos(null);
        },
        onPointerCancel: () => {
          start.current = null;
          setDragPos(null);
        },
        onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
          const step = (e.shiftKey ? 5 : 1) * KEY_STEP;
          const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
          const move = moves[e.key];
          if (!move) return;
          e.preventDefault();
          e.stopPropagation();
          onCommit(toFraction(left + move[0] * areaSize.w, top + move[1] * areaSize.h));
        },
      }
    : {};

  return { style: { left, top, visibility: areaSize.w ? ("visible" as const) : ("hidden" as const) }, handleProps, dragging: dragPos !== null };
}
