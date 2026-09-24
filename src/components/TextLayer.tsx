"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type OpenSeadragonType from "openseadragon";
import { setOsdNavEnabled } from "./osd-nav";
import { OVERLAY_Z, addFullMapOverlay, removeFullMapOverlay } from "./osd-overlay-stack";
import { clientToImagePoint, frameSize, type Pt } from "./osd-coords";
import { arcPaths, isCurved, lineBaselines, rotationFromDrag, scaleFromDrag, shadowOffset } from "./text-geometry";
import { mapFontFamily } from "@/server/texts/fonts";
import type { TextFields } from "@/server/texts/text-config";

export interface MapTextData extends TextFields {
  id: string;
  mapId: string;
  layerId: string | null;
  /** Other layers it is also shown (and editable) on. */
  extraLayerIds: string[];
  /** Hidden items stay in the Scene list but aren't drawn or pickable. */
  visible: boolean;
}

/** Geometry the user is dragging, previewed until mouseup commits it. */
type Preview = { id: string } & Partial<Pick<MapTextData, "x" | "y" | "rotation" | "fontSize">>;

const CLICK_THRESHOLD_PX = 5;

interface Props {
  viewer: OpenSeadragonType.Viewer | null;
  osd: typeof OpenSeadragonType | null;
  /** Text panel open (and the active layer visible): texts can be selected/edited. */
  authoring: boolean;
  /** Armed to place a new text with the next click. */
  placing: boolean;
  texts: MapTextData[];
  /** Texts that can be selected/edited; the rest (other layers' "always draw") are display only. Omitted = all. */
  editableIds?: Set<string>;
  /** Text briefly pulsed after being picked in the Scene panel. */
  pulseId?: string | null;
  selectedTextId: string | null;
  onPlace: (x: number, y: number) => void;
  onCancelPlace: () => void;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<Pick<MapTextData, "x" | "y" | "rotation" | "fontSize">>) => void;
  onDelete: (id: string) => void;
}

export default function TextLayer({
  viewer,
  osd,
  authoring,
  placing,
  texts,
  editableIds,
  pulseId = null,
  selectedTextId,
  onPlace,
  onCancelPlace,
  onSelect,
  onUpdate,
  onDelete,
}: Props) {
  const overlayRef = useRef<{ el: HTMLDivElement; root: Root } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  // Same reason as ZoneLayer: OSD nav has to be off *before* the mousedown
  // that starts a gesture, or OSD starts panning on that same event.
  useEffect(() => {
    if (!viewer || !authoring || !(placing || selectedTextId)) return;
    setOsdNavEnabled(viewer, false);
    return () => setOsdNavEnabled(viewer, true);
  }, [viewer, authoring, placing, selectedTextId]);

  useEffect(() => {
    if (!authoring) return;
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (e.key === "Escape") {
        if (placing) onCancelPlace();
        else if (selectedTextId) onSelect(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedTextId) {
        e.preventDefault();
        onDelete(selectedTextId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [authoring, placing, selectedTextId, onCancelPlace, onSelect, onDelete]);

  useEffect(() => {
    if (!viewer || !osd) return;
    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) return;
    const bounds = tiledImage.getBounds(true);
    if (!overlayRef.current) {
      const el = document.createElement("div");
      el.className = "text-layer-overlay";
      overlayRef.current = { el, root: createRoot(el) };
      addFullMapOverlay(viewer, el, OVERLAY_Z.texts);
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

  const toImagePoint = (clientX: number, clientY: number) => clientToImagePoint(viewer, osd, clientX, clientY);
  const draggingRef = useRef(false);
  // Parent callbacks are usually inline closures (new every render); read
  // them through a ref so the overlay only re-renders when its data changes.
  const callbacksRef = useRef({ onPlace, onSelect, onUpdate });
  useEffect(() => {
    callbacksRef.current = { onPlace, onSelect, onUpdate };
  });

  // An unselected text can be grabbed while OSD nav is still on (nothing
  // selected yet), so nav goes off as soon as the pointer is over a text —
  // before the mousedown — and back on when it leaves, unless a gesture or
  // selection still needs it off.
  function onTextHover(hovering: boolean) {
    if (hovering) setOsdNavEnabled(viewer, false);
    else if (!draggingRef.current && !placing && !selectedTextId) setOsdNavEnabled(viewer, true);
  }

  /**
   * Shared window-listener drag (same pattern as ZoneLayer's gestures): a
   * press that never moves past the threshold counts as a click.
   */
  function drag(e: React.MouseEvent, onDrag: (cur: Pt, ev: MouseEvent) => void, onEnd: (dragged: boolean, cur: Pt | null, ev: MouseEvent) => void) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setOsdNavEnabled(viewer, false);
    const startClient = { x: e.clientX, y: e.clientY };
    let dragged = false;
    draggingRef.current = true;
    function onMove(ev: MouseEvent) {
      if (!dragged && Math.hypot(ev.clientX - startClient.x, ev.clientY - startClient.y) < CLICK_THRESHOLD_PX) return;
      dragged = true;
      const cur = toImagePoint(ev.clientX, ev.clientY);
      if (cur) onDrag(cur, ev);
    }
    function onUp(ev: MouseEvent) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      draggingRef.current = false;
      onEnd(dragged, toImagePoint(ev.clientX, ev.clientY), ev);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function beginMove(e: React.MouseEvent, text: MapTextData) {
    const start = toImagePoint(e.clientX, e.clientY);
    const size = frameSize(viewer);
    if (!start || !size) return;
    // Committed from these locals, not from preview state (see ZoneLayer's
    // beginMove for why a setState updater is avoided here).
    let latest = { x: text.x, y: text.y };
    drag(
      e,
      (cur) => {
        latest = {
          x: Math.min(size.w, Math.max(0, text.x + cur.x - start.x)),
          y: Math.min(size.h, Math.max(0, text.y + cur.y - start.y)),
        };
        setPreview({ id: text.id, ...latest });
      },
      (dragged) => {
        setPreview(null);
        if (dragged) callbacksRef.current.onUpdate(text.id, latest);
        if (selectedTextId !== text.id) callbacksRef.current.onSelect(text.id);
      }
    );
  }

  function beginScale(e: React.MouseEvent, text: MapTextData) {
    const start = toImagePoint(e.clientX, e.clientY);
    const size = frameSize(viewer);
    if (!start || !size) return;
    const center = { x: text.x, y: text.y };
    let fontSize = text.fontSize;
    drag(
      e,
      (cur) => {
        fontSize = scaleFromDrag(center, start, cur, text.fontSize, 1, Math.max(size.w, size.h));
        setPreview({ id: text.id, fontSize });
      },
      (dragged) => {
        setPreview(null);
        if (dragged) callbacksRef.current.onUpdate(text.id, { fontSize: Math.round(fontSize * 10) / 10 });
      }
    );
  }

  function beginRotate(e: React.MouseEvent, text: MapTextData) {
    const center = { x: text.x, y: text.y };
    let rotation = text.rotation;
    drag(
      e,
      (cur, ev) => {
        rotation = rotationFromDrag(center, cur, ev.shiftKey);
        setPreview({ id: text.id, rotation });
      },
      (dragged) => {
        setPreview(null);
        if (dragged) callbacksRef.current.onUpdate(text.id, { rotation: Math.round(rotation * 10) / 10 });
      }
    );
  }

  function onBackgroundMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    if (placing) {
      const pt = toImagePoint(e.clientX, e.clientY);
      if (pt) callbacksRef.current.onPlace(pt.x, pt.y);
    } else if (selectedTextId) {
      callbacksRef.current.onSelect(null);
    }
  }

  useEffect(() => {
    const entry = overlayRef.current;
    if (!entry || !viewer) return;
    const size = frameSize(viewer);
    if (!size) return;
    entry.root.render(
      <TextSvg
        imageWidth={size.w}
        imageHeight={size.h}
        texts={texts}
        editableIds={editableIds}
        pulseId={pulseId}
        preview={preview}
        authoring={authoring}
        placing={placing}
        selectedTextId={selectedTextId}
        onBackgroundMouseDown={onBackgroundMouseDown}
        onTextMouseDown={beginMove}
        onTextHover={onTextHover}
        onScaleMouseDown={beginScale}
        onRotateMouseDown={beginRotate}
      />
    );
    // Handlers are recreated each render but only read the deps below (and
    // callbacksRef), so re-rendering on these alone is complete.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, texts, editableIds, pulseId, preview, authoring, placing, selectedTextId]);

  return null;
}

interface SvgProps {
  imageWidth: number;
  imageHeight: number;
  texts: MapTextData[];
  editableIds?: Set<string>;
  pulseId?: string | null;
  preview: Preview | null;
  authoring: boolean;
  placing: boolean;
  selectedTextId: string | null;
  onBackgroundMouseDown: (e: React.MouseEvent) => void;
  onTextMouseDown: (e: React.MouseEvent, text: MapTextData) => void;
  onTextHover: (hovering: boolean) => void;
  onScaleMouseDown: (e: React.MouseEvent, text: MapTextData) => void;
  onRotateMouseDown: (e: React.MouseEvent, text: MapTextData) => void;
}

function TextSvg(props: SvgProps) {
  const { imageWidth, imageHeight, texts, preview, authoring, placing, selectedTextId } = props;
  // Re-measure every label once web fonts finish loading (widths change).
  const [fontEpoch, setFontEpoch] = useState(0);
  useEffect(() => {
    const fonts = document.fonts;
    const bump = () => setFontEpoch((n) => n + 1);
    fonts.addEventListener("loadingdone", bump);
    return () => fonts.removeEventListener("loadingdone", bump);
  }, []);

  const catchBackground = authoring && (placing || Boolean(selectedTextId));
  const handleSize = Math.max(imageWidth, imageHeight) * 0.006;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      preserveAspectRatio="none"
      style={{ display: "block", overflow: "visible", pointerEvents: "none" }}
    >
      {catchBackground && (
        <rect
          x={0}
          y={0}
          width={imageWidth}
          height={imageHeight}
          fill="transparent"
          style={{ pointerEvents: "all", cursor: placing ? "crosshair" : "default" }}
          onMouseDown={props.onBackgroundMouseDown}
        />
      )}
      {texts.map((t) => {
        const p = preview?.id === t.id ? preview : null;
        const text = p ? { ...t, ...p } : t;
        return (
          <TextItem
            key={t.id}
            text={text}
            fontEpoch={fontEpoch}
            pulsing={t.id === props.pulseId}
            interactive={authoring && !placing && (!props.editableIds || props.editableIds.has(t.id))}
            selected={authoring && t.id === selectedTextId}
            handleSize={handleSize}
            onMouseDown={(e) => props.onTextMouseDown(e, t)}
            onHover={props.onTextHover}
            onScaleMouseDown={(e) => props.onScaleMouseDown(e, t)}
            onRotateMouseDown={(e) => props.onRotateMouseDown(e, t)}
          />
        );
      })}
    </svg>
  );
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function sameBox(a: Box | null, b: Box | null) {
  return a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height);
}

function TextItem({
  text,
  fontEpoch,
  pulsing,
  interactive,
  selected,
  handleSize,
  onMouseDown,
  onHover,
  onScaleMouseDown,
  onRotateMouseDown,
}: {
  text: MapTextData;
  fontEpoch: number;
  pulsing: boolean;
  interactive: boolean;
  selected: boolean;
  handleSize: number;
  onMouseDown: (e: React.MouseEvent) => void;
  onHover: (hovering: boolean) => void;
  onScaleMouseDown: (e: React.MouseEvent) => void;
  onRotateMouseDown: (e: React.MouseEvent) => void;
}) {
  const lines = text.text.split("\n");
  const measureRefs = useRef<(SVGTextElement | null)[]>([]);
  const contentRef = useRef<SVGGElement | null>(null);
  const [widths, setWidths] = useState<number[]>([]);
  const [box, setBox] = useState<Box | null>(null);
  const [measuredKey, setMeasuredKey] = useState<string | null>(null);

  const fontFamily = mapFontFamily(text.fontKey);
  const fontWeight = text.bold ? 700 : 400;
  const style = { fontFamily, fontWeight, letterSpacing: `${text.letterSpacing}em`, whiteSpace: "pre" as const };
  const baselines = lineBaselines(lines.length, text.fontSize);
  const maxWidth = Math.max(0, ...widths);
  const curved = isCurved(text.curve);

  // Measure each line's straight length (needed for arcs and alignment) with
  // hidden straight copies that only exist until measured, then the drawn
  // content's box (for handles), guarded against no-op updates.
  const measureKey = [text.text, text.fontSize, text.fontKey, text.bold, text.letterSpacing, text.curve, text.align, fontEpoch].join("|");
  const needsMeasure = measuredKey !== measureKey;
  useLayoutEffect(() => {
    if (needsMeasure) {
      const next = measureRefs.current.slice(0, lines.length).map((el) => el?.getComputedTextLength() ?? 0);
      if (next.length !== widths.length || next.some((w, i) => Math.abs(w - widths[i]) > 0.01)) setWidths(next);
      setMeasuredKey(measureKey);
      return;
    }
    const b = contentRef.current?.getBBox();
    const nextBox = b ? { x: b.x, y: b.y, width: b.width, height: b.height } : null;
    if (!sameBox(box, nextBox)) setBox(nextBox);
    // measureKey covers everything that changes glyph metrics (incl. a web font finishing loading).
  }, [measureKey, needsMeasure, lines.length, widths, box]);

  const anchor = text.align === "left" ? "start" : text.align === "right" ? "end" : "middle";
  const anchorX = text.align === "left" ? -maxWidth / 2 : text.align === "right" ? maxWidth / 2 : 0;
  const startOffset = text.align === "left" ? "0%" : text.align === "right" ? "100%" : "50%";
  const paths = curved ? arcPaths(text.curve, maxWidth, baselines) : [];
  const arcId = (i: number) => `map-text-arc-${text.id}-${i}`;
  const shadow = shadowOffset(text.shadowAngle, text.shadowDistance, text.fontSize, text.rotation);

  const paint = {
    fill: text.color,
    stroke: text.outlineEnabled ? text.outlineColor : "none",
    strokeOpacity: text.outlineOpacity,
    // paint-order puts the stroke under the fill, hiding its inner half.
    strokeWidth: text.outlineEnabled ? text.outlineWidth * text.fontSize * 2 : 0,
    strokeLinejoin: "round" as const,
    paintOrder: "stroke" as const,
  };

  const contentProps = { lines, curved, fontSize: text.fontSize, style, anchor, anchorX, startOffset, baselines, arcId } as const;

  const pad = text.fontSize * 0.15;
  const frame = box ? { x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2 } : null;

  return (
    <g
      transform={`translate(${text.x} ${text.y}) rotate(${text.rotation})`}
      className={pulsing ? "scene-focus-pulse" : undefined}
      style={{ pointerEvents: "none" }}
    >
      <defs>
        {paths.map((d, i) => (
          <path key={i} id={arcId(i)} d={d} />
        ))}
      </defs>

      {/* Hidden straight copies, only while measuring line lengths. */}
      {needsMeasure && (
        <g visibility="hidden" aria-hidden>
          {lines.map((line, i) => (
            <text
              key={i}
              ref={(el) => {
                measureRefs.current[i] = el;
              }}
              fontSize={text.fontSize}
              style={style}
            >
              {line || " "}
            </text>
          ))}
        </g>
      )}

      {/* The shadow is a sharp offset copy (no blur), so a second paint in the
          shadow color replaces an SVG filter: no offscreen filter pass. */}
      {text.shadowEnabled && (
        <g transform={`translate(${shadow.x} ${shadow.y})`} opacity={text.shadowOpacity} aria-hidden>
          <TextContent
            {...contentProps}
            paint={{ ...paint, fill: text.shadowColor, stroke: text.outlineEnabled ? text.shadowColor : "none", strokeOpacity: 1 }}
          />
        </g>
      )}

      <g ref={contentRef}>
        <TextContent {...contentProps} paint={paint} />
      </g>

      {frame && interactive && (
        <rect
          {...frame}
          fill="transparent"
          style={{ pointerEvents: "all", cursor: selected ? "move" : "pointer" }}
          onMouseDown={onMouseDown}
          onMouseEnter={() => onHover(true)}
          onMouseLeave={() => onHover(false)}
        />
      )}

      {frame && selected && (
        <TextHandles frame={frame} handleSize={handleSize} onScaleMouseDown={onScaleMouseDown} onRotateMouseDown={onRotateMouseDown} />
      )}
    </g>
  );
}

type Paint = { fill: string; stroke: string; strokeOpacity: number; strokeWidth: number; strokeLinejoin: "round"; paintOrder: "stroke" };

function TextContent({
  lines,
  curved,
  fontSize,
  style,
  anchor,
  anchorX,
  startOffset,
  baselines,
  arcId,
  paint,
}: {
  lines: string[];
  curved: boolean;
  fontSize: number;
  style: React.CSSProperties;
  anchor: "start" | "middle" | "end";
  anchorX: number;
  startOffset: string;
  baselines: number[];
  arcId: (i: number) => string;
  paint: Paint;
}) {
  return curved ? (
    <>
      {lines.map((line, i) => (
        <text key={i} fontSize={fontSize} style={style} {...paint}>
          <textPath href={`#${arcId(i)}`} startOffset={startOffset} textAnchor={anchor}>
            {line || " "}
          </textPath>
        </text>
      ))}
    </>
  ) : (
    <text fontSize={fontSize} style={style} textAnchor={anchor} {...paint}>
      {lines.map((line, i) => (
        <tspan key={i} x={anchorX} y={baselines[i]}>
          {line || " "}
        </tspan>
      ))}
    </text>
  );
}

function TextHandles({
  frame,
  handleSize,
  onScaleMouseDown,
  onRotateMouseDown,
}: {
  frame: Box;
  handleSize: number;
  onScaleMouseDown: (e: React.MouseEvent) => void;
  onRotateMouseDown: (e: React.MouseEvent) => void;
}) {
  const hs = handleSize;
  const corners = [
    { x: frame.x, y: frame.y, cursor: "nwse-resize" },
    { x: frame.x + frame.width, y: frame.y, cursor: "nesw-resize" },
    { x: frame.x + frame.width, y: frame.y + frame.height, cursor: "nwse-resize" },
    { x: frame.x, y: frame.y + frame.height, cursor: "nesw-resize" },
  ];
  const topCenter = { x: frame.x + frame.width / 2, y: frame.y };
  const rotateAt = { x: topCenter.x, y: topCenter.y - hs * 4 };
  const outline = { fill: "none", stroke: "#fff", strokeWidth: 1.5, vectorEffect: "non-scaling-stroke" as const };

  return (
    <g>
      <rect {...frame} {...outline} strokeDasharray="6 4" />
      <line x1={topCenter.x} y1={topCenter.y} x2={rotateAt.x} y2={rotateAt.y} {...outline} />
      <circle
        cx={rotateAt.x}
        cy={rotateAt.y}
        r={hs * 0.9}
        fill="#fff"
        stroke="#0D0E10"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        style={{ pointerEvents: "all", cursor: "grab" }}
        onMouseDown={onRotateMouseDown}
      >
        <title>Drag to rotate (Shift snaps to 15°)</title>
      </circle>
      {corners.map((c, i) => (
        <rect
          key={i}
          x={c.x - hs / 2}
          y={c.y - hs / 2}
          width={hs}
          height={hs}
          fill="#fff"
          stroke="#0D0E10"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: "all", cursor: c.cursor }}
          onMouseDown={onScaleMouseDown}
        />
      ))}
    </g>
  );
}
