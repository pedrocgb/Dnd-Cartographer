"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin, ZoomIn, ZoomOut, Home, Maximize, Minimize, Undo2, Redo2 } from "lucide-react";
import type OpenSeadragonType from "openseadragon";
import MarkerLayer, { type Marker } from "./MarkerLayer";
import MarkerPanel, { type MarkerSection } from "./MarkerPanel";
import MarkerSectionStrip from "./MarkerSectionStrip";
import GridLayer, { type MapGrid } from "./GridLayer";
import GridPanel from "./GridPanel";
import ZoneLayer, { DEFAULT_BRUSH_SIZE, isPaintTool, zonePaintOrder, type PaintedZone, type ZoneData, type ZoneRegionData, type ZoneTool } from "./ZoneLayer";
import ZonesPanel from "./ZonesPanel";
import MarkerIconFilterPanel from "./MarkerIconFilterPanel";
import LayersPanel from "./LayersPanel";
import TextLayer, { type MapTextData } from "./TextLayer";
import TextPanel, { type TextDraft, type TextPatch } from "./TextPanel";
import { defaultTextStyle } from "@/server/texts/text-config";
import LineLayer, { type MapLineData } from "./LineLayer";
import LinePanel, { type LinePatch } from "./LinePanel";
import { defaultLineStyle, translatePoints, type LineKind, type LineStyle, type PenPt } from "@/server/lines/line-config";
import { drawnLayerIds, isOnLayer, itemsInLayers, useLayerImages, withHomeLayer } from "./layer-images";
import ScenePanel, { type SceneKind } from "./ScenePanel";
import { focusRect, lineBounds, textBounds, zoneBounds, type Rect } from "./scene-bounds";
import type { MapLayersApi } from "./use-map-layers";
import { useToggleSet } from "./useToggleSet";
import { useEditHistory } from "./use-edit-history";
import { patchOverlayPositioning } from "./osd-overlay-position-fix";
import { clientToImagePoint, screenPxPerImagePx } from "./osd-coords";
import { centerAt, translateZoneGeometry } from "./paste-geometry";
import { hitTest, type Hit, type HitScene } from "./hit-test";
import { toMultiPolygon } from "./zone-paint";
import SelectionLayer from "./SelectionLayer";
import {
  ICONS,
  DEFAULT_ICON_KEY,
  DEFAULT_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_OUTLINE_COLOR,
  DEFAULT_BACKGROUND_SHAPE,
} from "@/server/markers/icon-registry";

const ICON_UNIVERSE = ICONS.map((i) => i.key);

// Lucide's "square-dashed-mouse-pointer" glyph, inlined as a cursor — matches
// the icon's own path data (node_modules/lucide-react .../square-dashed-mouse-pointer.mjs)
// rather than loading it at runtime, so it survives offline/local use.
const ZONE_DRAW_CURSOR_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>" +
  "<path d='M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z'/>" +
  "<path d='M5 3a2 2 0 0 0-2 2'/><path d='M19 3a2 2 0 0 1 2 2'/><path d='M5 21a2 2 0 0 1-2-2'/>" +
  "<path d='M9 3h1'/><path d='M9 21h2'/><path d='M14 3h1'/><path d='M3 9v1'/><path d='M21 9v2'/><path d='M3 14v1'/>" +
  "</svg>";
const ZONE_DRAW_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(ZONE_DRAW_CURSOR_SVG)}") 4 4, crosshair`;

interface MapOption {
  id: string;
  name: string;
}

async function json<T>(res: Response): Promise<T> {
  return res.json();
}

const ZOOM_PER_CLICK = 1.5;
const NO_REGIONS: ZoneRegionData[] = [];
const NO_ZONES: ZoneData[] = [];

type MapItem = Marker | ZoneData | MapTextData | MapLineData;
const ITEM_API: Record<SceneKind, string> = { marker: "/api/markers", zone: "/api/zones", text: "/api/texts", line: "/api/lines" };
/** Marker fields undo covers: map edits, not its wiki content (name, description, politics). */
const MARKER_EDIT_KEYS = new Set(["u", "v", "iconKey", "color", "backgroundColor", "outlineColor", "backgroundShape", "layerId", "extraLayerIds"]);
/** Edits made in one gesture: never merged with the next one. */
const GESTURE_KEYS = new Set(["geometry", "points", "u", "v", "x", "y", "layerId", "extraLayerIds", "regionId"]);

function editLabel(kind: SceneKind, keys: string[]): string {
  if (keys.includes("geometry") || keys.includes("points")) return `Reshape ${kind}`;
  if (keys.some((k) => k === "u" || k === "v" || k === "x" || k === "y")) return `Move ${kind}`;
  if (keys.some((k) => k === "layerId" || k === "extraLayerIds" || k === "regionId")) return `Change ${kind} layer`;
  return `Edit ${kind}`;
}

const TEXT_INPUT_TYPES = new Set(["text", "search", "number", "email", "url", "password", "tel"]);

/** Keyboard shortcuts leave text editing alone (it has its own undo); sliders and checkboxes don't count. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  if (el.isContentEditable || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  return el.tagName === "INPUT" && TEXT_INPUT_TYPES.has((el as HTMLInputElement).type);
}

export default function MapWorkspace({
  mapId,
  layerApi,
  activeLayerId,
  onSetActiveLayer,
  layersPanelOpen,
  onCloseLayersPanel,
  onDeleteLayer,
  texts,
  setTexts,
  textPanelOpen,
  onCloseTextPanel,
  lines,
  setLines,
  linePanelOpen,
  onCloseLinePanel,
  scenePanelOpen,
  onCloseScenePanel,
  selectToolOn,
  onCloseSelectTool,
  addMarkerRequest,
  onMarkerToolChange,
  onOpenZonesPanel,
  onOpenTextPanel,
  onOpenLinePanel,
  markers,
  setMarkers,
  externalFocusMarkerId,
  onExternalFocusHandled,
  grid,
  gridPanelOpen,
  onCloseGridPanel,
  onUpdateGrid,
  onDeleteGrid,
  zoneRegions,
  setZoneRegions,
  zones,
  setZones,
  zonesPanelOpen,
  onCloseZonesPanel,
  iconFilterPanelOpen,
  onCloseIconFilterPanel,
  imageWidth,
  imageHeight,
}: {
  mapId: string;
  layerApi: MapLayersApi;
  activeLayerId: string;
  onSetActiveLayer: (id: string) => void;
  layersPanelOpen: boolean;
  onCloseLayersPanel: () => void;
  onDeleteLayer: (id: string) => void;
  texts: MapTextData[];
  setTexts: React.Dispatch<React.SetStateAction<MapTextData[]>>;
  textPanelOpen: boolean;
  onCloseTextPanel: () => void;
  lines: MapLineData[];
  setLines: React.Dispatch<React.SetStateAction<MapLineData[]>>;
  linePanelOpen: boolean;
  onCloseLinePanel: () => void;
  scenePanelOpen: boolean;
  onCloseScenePanel: () => void;
  /** Selection tool: hover outlines an item, a click opens its tool with it selected. */
  selectToolOn: boolean;
  onCloseSelectTool: () => void;
  /** Changes each time the sidebar's "Add marker" is picked: same toggle as the toolbar button. */
  addMarkerRequest: number;
  /** Tells the sidebar whether a marker is being placed or edited. */
  onMarkerToolChange: (active: boolean) => void;
  onOpenZonesPanel: () => void;
  onOpenTextPanel: () => void;
  onOpenLinePanel: () => void;
  markers: Marker[];
  setMarkers: React.Dispatch<React.SetStateAction<Marker[]>>;
  externalFocusMarkerId: string | null;
  onExternalFocusHandled: () => void;
  grid: MapGrid | null;
  gridPanelOpen: boolean;
  onCloseGridPanel: () => void;
  onUpdateGrid: (patch: Partial<MapGrid>) => void;
  onDeleteGrid: () => void;
  zoneRegions: ZoneRegionData[];
  setZoneRegions: React.Dispatch<React.SetStateAction<ZoneRegionData[]>>;
  zones: ZoneData[];
  setZones: React.Dispatch<React.SetStateAction<ZoneData[]>>;
  zonesPanelOpen: boolean;
  onCloseZonesPanel: () => void;
  iconFilterPanelOpen: boolean;
  onCloseIconFilterPanel: () => void;
  imageWidth: number;
  imageHeight: number;
}) {
  const viewerElRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<OpenSeadragonType.Viewer | null>(null);
  const [viewer, setViewer] = useState<OpenSeadragonType.Viewer | null>(null);
  const [osd, setOsd] = useState<typeof OpenSeadragonType | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [addingMarker, setAddingMarker] = useState(false);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [markerSection, setMarkerSection] = useState<MarkerSection>("basic");
  const [autoFocusName, setAutoFocusName] = useState(false);
  const [startInEdit, setStartInEdit] = useState(false);
  const [overlapChoices, setOverlapChoices] = useState<{ ids: string[]; x: number; y: number } | null>(null);
  const [undo, setUndo] = useState<{ marker: Marker; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [allMaps, setAllMaps] = useState<MapOption[]>([]);
  const [activeZoneRegionId, setActiveZoneRegionId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [activeZoneTool, setActiveZoneTool] = useState<ZoneTool>("select");
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [zoneUndo, setZoneUndo] = useState<{ zone: ZoneData; timer: ReturnType<typeof setTimeout> } | null>(null);
  const zonePatchTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingZonePatchesRef = useRef<Map<string, Partial<ZoneData>>>(new Map());
  const [saveError, setSaveError] = useState<{ message: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const iconFilter = useToggleSet(ICON_UNIVERSE);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [placingText, setPlacingText] = useState(false);
  const [textDraft, setTextDraft] = useState<TextDraft>(() => ({ ...defaultTextStyle(imageWidth, imageHeight), text: "New text" }));
  const [textUndo, setTextUndo] = useState<{ text: MapTextData; timer: ReturnType<typeof setTimeout> } | null>(null);
  const textPatchTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingTextPatchesRef = useRef<Map<string, TextPatch>>(new Map());
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [drawingLine, setDrawingLine] = useState(false);
  const [lineMode, setLineMode] = useState<LineKind>("free");
  const [lineDraft, setLineDraft] = useState<LineStyle>(() => defaultLineStyle(imageWidth, imageHeight));
  const [lineUndo, setLineUndo] = useState<{ line: MapLineData; timer: ReturnType<typeof setTimeout> } | null>(null);
  const linePatchTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingLinePatchesRef = useRef<Map<string, LinePatch>>(new Map());
  /** The item just picked in the Scene panel, briefly pulsed on the map. */
  const [pulseId, setPulseId] = useState<string | null>(null);
  /** Selection tool: the item under the pointer. */
  const [hovered, setHovered] = useState<Hit | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastChoiceRef = useRef({
    iconKey: DEFAULT_ICON_KEY,
    color: DEFAULT_COLOR,
    backgroundColor: DEFAULT_BACKGROUND_COLOR,
    outlineColor: DEFAULT_OUTLINE_COLOR,
    backgroundShape: DEFAULT_BACKGROUND_SHAPE as string,
  });
  const history = useEditHistory();
  /** Latest items and update functions, for undo/redo entries recorded in an earlier render. */
  const latestRef = useRef<{
    markers: Marker[];
    zones: ZoneData[];
    texts: MapTextData[];
    lines: MapLineData[];
    apply: (kind: SceneKind, id: string, patch: Record<string, unknown>) => void;
    moveLine: (id: string, dx: number, dy: number) => void;
  } | null>(null);
  /** Ctrl+C copy: a snapshot of the item (and a zone's region name, for pasting onto a layer without regions). */
  const clipboardRef = useRef<{ kind: SceneKind; item: MapItem; regionName?: string } | null>(null);
  /** Last pointer position over the map (client pixels), where Ctrl+V pastes. */
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const searchParams = useSearchParams();
  const deepLinkedMarkerId = searchParams.get("marker");
  const deepLinkAppliedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    import("openseadragon").then((mod) => {
      if (cancelled || !viewerElRef.current) return;
      const OSD = mod.default;
      patchOverlayPositioning(OSD);
      const v = OSD({
        element: viewerElRef.current,
        prefixUrl: "/osd-images/",
        // World item 0 is an invisible, never-loaded frame sized to the map's
        // coordinate frame: every overlay layer reads world.getItemAt(0) as
        // its reference, and layer images (see useLayerImages) come and go
        // above it without ever moving that reference.
        // Opacity is set on this item only: the viewer-level `opacity` option
        // would also fade OSD's whole drawing canvas, hiding every image.
        tileSources: [
          {
            tileSource: {
              width: imageWidth,
              height: imageHeight,
              tileSize: 512,
              tileOverlap: 0,
              getTileUrl: () => "",
            },
            opacity: 0,
          },
        ] as unknown as OpenSeadragonType.TileSource[],
        showNavigator: true,
        showNavigationControl: false, // replaced by our own themed zoom/home/fullscreen buttons
        maxZoomPixelRatio: 8,
        gestureSettingsMouse: { clickToZoom: false },
      });
      viewerRef.current = v;
      setOsd(() => OSD); // OSD is itself a function — pass a thunk so useState stores it as-is instead of calling it as an updater
      // Don't publish `viewer` until the tile source has actually opened —
      // MarkerLayer reads viewer.world.getItemAt(0) as soon as `viewer` is
      // set, and that's still empty for a moment after construction. If
      // markers load before the image attaches, the effect silently bails
      // and (since viewer/osd never change again) never retries, so no
      // markers ever render. Confirmed via a real, reproducible failure —
      // not a caching or theoretical concern.
      v.addHandler("open", () => {
        if (!cancelled) setViewer(v);
      });
      // While OSD animates, let the compositor scale the already-rasterized
      // full-map layers (see addFullMapOverlay); dropping the hint when the
      // motion settles makes them re-rasterize crisp at the final zoom.
      v.addHandler("animation-start", () => v.element.classList.add("osd-animating"));
      v.addHandler("animation-finish", () => v.element.classList.remove("osd-animating"));
    });

    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
      setViewer(null);
    };
  }, [mapId, imageWidth, imageHeight]);

  useLayerImages(viewer, layerApi.layers, activeLayerId);

  // Fullscreen uses the browser Fullscreen API on the whole map page (sidebar,
  // panels and toolbar included) instead of OSD's setFullPage, which moves
  // the viewer into <body> and hides everything else — including the button
  // to leave it. Esc exits natively; this only tracks the state for the icon.
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const el = viewerElRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => (pointerRef.current = { x: e.clientX, y: e.clientY });
    const onLeave = () => (pointerRef.current = null);
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    const target = viewerElRef.current?.closest<HTMLElement>(".map-page-body") ?? viewerElRef.current;
    void target?.requestFullscreen();
  }

  useEffect(() => {
    fetch("/api/maps")
      .then((r) => json<{ maps: MapOption[] }>(r))
      .then((d) => setAllMaps(d.maps.filter((m) => m.id !== mapId)));
  }, [mapId]);

  // Crosshair while armed to place a marker, or the dashed-selection cursor
  // while a zone draw tool is armed — imperative, since OpenSeadragon sets
  // its own inline cursor styling on this element that a plain CSS class
  // would have to fight for specificity.
  useEffect(() => {
    if (!viewerElRef.current) return;
    viewerElRef.current.style.cursor = selectToolOn
      ? hovered
        ? "pointer"
        : ""
      : addingMarker || (textPanelOpen && placingText) || (linePanelOpen && drawingLine)
      ? "crosshair"
      : zonesPanelOpen && isPaintTool(activeZoneTool)
        ? "crosshair" // the brush-size ring drawn by ZoneLayer marks the exact spot
        : zonesPanelOpen && activeZoneTool !== "select"
          ? ZONE_DRAW_CURSOR
          : "";
  }, [addingMarker, zonesPanelOpen, activeZoneTool, textPanelOpen, placingText, linePanelOpen, drawingLine, selectToolOn, hovered]);

  // Middle-mouse-button drag also pans the map, same as OpenSeadragon's own
  // left-drag pan — implemented independently of OSD's built-in navigation
  // (viewport.panBy, not viewer.setMouseNavEnabled) so it keeps working even
  // while that's deliberately disabled during zone drawing/editing, giving
  // the user a way to pan without leaving the active tool.
  useEffect(() => {
    if (!viewer || !osd) return;
    const container = viewer.container;

    function onMouseDown(e: MouseEvent) {
      if (e.button !== 1) return;
      e.preventDefault();
      let last = { x: e.clientX, y: e.clientY };

      function onMove(moveEvent: MouseEvent) {
        const dx = moveEvent.clientX - last.x;
        const dy = moveEvent.clientY - last.y;
        last = { x: moveEvent.clientX, y: moveEvent.clientY };
        const delta = viewer!.viewport.deltaPointsFromPixels(new osd!.Point(-dx, -dy));
        viewer!.viewport.panBy(delta, true);
      }
      function onUp() {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    }

    // Chrome/Firefox show their own autoscroll UI on a middle-button press
    // unless it's prevented right on mousedown.
    container.addEventListener("mousedown", onMouseDown);
    return () => container.removeEventListener("mousedown", onMouseDown);
  }, [viewer, osd]);

  // Scroll-wheel zoom, implemented independently of OSD's own gated
  // scroll-to-zoom (viewport.zoomBy directly, not relying on
  // gestureSettingsMouse.scrollToZoom) so it keeps working even while
  // viewer.setMouseNavEnabled(false) is in effect during zone
  // drawing/editing — see osd-nav.ts for why that's a full nav switch
  // rather than a narrower per-gesture toggle. Only takes over when OSD's
  // own nav is currently disabled; otherwise OSD's own handler already
  // does this and firing both would double the zoom per scroll tick.
  useEffect(() => {
    if (!viewer || !osd) return;
    const container = viewer.container;
    const ZOOM_PER_SCROLL = 1.2; // matches OpenSeadragon's own default

    function onWheel(e: WheelEvent) {
      if (viewer!.isMouseNavEnabled()) return;
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const refPoint = viewer!.viewport.pointFromPixel(new osd!.Point(e.clientX - rect.left, e.clientY - rect.top), true);
      const factor = Math.pow(ZOOM_PER_SCROLL, e.deltaY < 0 ? 1 : -1);
      viewer!.viewport.zoomBy(factor, refPoint);
      viewer!.viewport.applyConstraints();
    }

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [viewer, osd]);

  // Deep link support: /maps/:id?marker=:markerId opens straight to that
  // marker, selected and centered, once the viewer and marker list are both
  // ready. Applied once per page load, not re-applied after e.g. a drag.
  useEffect(() => {
    if (!viewer || !osd || deepLinkAppliedRef.current || !deepLinkedMarkerId) return;
    const marker = markers.find((m) => m.id === deepLinkedMarkerId);
    if (!marker) return;
    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) return;

    deepLinkAppliedRef.current = true;
    if (marker.layerId && marker.layerId !== activeLayerId) onSetActiveLayer(marker.layerId);
    const size = tiledImage.getContentSize();
    const center = tiledImage.imageToViewportCoordinates(marker.u * size.x, marker.v * size.y);
    viewer.viewport.panTo(center, true);
    viewer.viewport.zoomTo(Math.max(viewer.viewport.getZoom(), 2), center, true);
    // Deferred: this effect's real job is the imperative OSD pan/zoom above;
    // selecting the marker is a side effect of that, not the reason the
    // effect ran, so it's queued rather than called synchronously in-body.
    queueMicrotask(() => selectMarker(marker.id));
  }, [viewer, osd, markers, deepLinkedMarkerId]);

  // Jump-to-marker requests from outside this component (the Markers List
  // modal, rendered by the parent) — same pan/zoom/select as the deep-link
  // effect above, but re-armable: the parent clears the id after each use, so
  // clicking the same list row twice in a row still re-triggers this.
  useEffect(() => {
    if (!viewer || !osd || !externalFocusMarkerId) return;
    const marker = markers.find((m) => m.id === externalFocusMarkerId);
    const tiledImage = viewer.world.getItemAt(0);
    if (!marker || !tiledImage) {
      onExternalFocusHandled();
      return;
    }
    if (marker.layerId && marker.layerId !== activeLayerId) onSetActiveLayer(marker.layerId);
    const size = tiledImage.getContentSize();
    const center = tiledImage.imageToViewportCoordinates(marker.u * size.x, marker.v * size.y);
    viewer.viewport.panTo(center, true);
    viewer.viewport.zoomTo(Math.max(viewer.viewport.getZoom(), 2), center, true);
    queueMicrotask(() => selectMarker(marker.id));
    onExternalFocusHandled();
  }, [viewer, osd, markers, externalFocusMarkerId, onExternalFocusHandled]);

  // Central place to change which marker is selected. Profile links inside
  // the Political References / Links sections open in a new tab (see
  // MarkerSectionStrip's consumers) rather than navigating this page away,
  // so there's no "restore after navigating back" state to manage here —
  // the map/marker/section simply never went anywhere.
  // Only one lateral tool is ever open at a time — selecting/placing a
  // marker closes whichever Grid/Zones/Filter panel was open, and (see the
  // render-time adjustment below) opening one of those panels deselects any
  // open marker the same way.
  function closeToolPanels() {
    onCloseGridPanel();
    onCloseZonesPanel();
    onCloseIconFilterPanel();
    onCloseLayersPanel();
    onCloseTextPanel();
    onCloseLinePanel();
    onCloseScenePanel();
    onCloseSelectTool();
  }

  function selectMarker(markerId: string, opts?: { startInEdit?: boolean }) {
    closeToolPanels();
    setSelectedMarkerId(markerId);
    setMarkerSection("basic");
    setAutoFocusName(false);
    setStartInEdit(Boolean(opts?.startInEdit));
  }

  // Placing a marker or switching its icon must never leave it silently
  // invisible because an unrelated filter choice happens to hide that icon.
  function ensureIconVisible(iconKey: string) {
    if (!iconFilter.allOn && !iconFilter.selected.has(iconKey)) iconFilter.toggle(iconKey);
  }

  // ---- Undo / redo: every map edit goes through the functions below, which record it. ----

  function findItem(kind: SceneKind, id: string): MapItem | undefined {
    const latest = latestRef.current;
    if (!latest) return undefined;
    const list: MapItem[] = kind === "marker" ? latest.markers : kind === "zone" ? latest.zones : kind === "text" ? latest.texts : latest.lines;
    return list.find((x) => x.id === id);
  }

  /** Takes an item off the map and soft-deletes it (undo of a create, redo of a delete). */
  function removeItem(kind: SceneKind, id: string) {
    const drop = <T extends { id: string }>(prev: T[]) => prev.filter((x) => x.id !== id);
    const unselect = (sel: string | null) => (sel === id ? null : sel);
    if (kind === "marker") {
      setMarkers(drop);
      setSelectedMarkerId(unselect);
    } else if (kind === "zone") {
      setZones(drop);
      setSelectedZoneId(unselect);
    } else if (kind === "text") {
      setTexts(drop);
      setSelectedTextId(unselect);
    } else {
      setLines(drop);
      setSelectedLineId(unselect);
    }
    return fetch(`${ITEM_API[kind]}/${id}`, { method: "DELETE" });
  }

  /** Brings a soft-deleted item back as it was. */
  function restoreItem(kind: SceneKind, item: MapItem) {
    return fetch(`${ITEM_API[kind]}/${item.id}/restore`, { method: "POST" }).then(() => {
      const add = <T extends { id: string }>(prev: T[]) => (prev.some((x) => x.id === item.id) ? prev : [...prev, item as unknown as T]);
      if (kind === "marker") setMarkers(add);
      else if (kind === "zone") setZones(add);
      else if (kind === "text") setTexts(add);
      else setLines(add);
    });
  }

  function recordCreate(kind: SceneKind, id: string, label = `Add ${kind}`) {
    let snapshot: MapItem | undefined;
    history.record({
      label,
      undo: () => {
        snapshot = findItem(kind, id);
        return removeItem(kind, id);
      },
      redo: () => (snapshot ? restoreItem(kind, snapshot) : undefined),
    });
  }

  function recordDelete(kind: SceneKind, item: MapItem) {
    let snapshot = item;
    history.record({
      label: `Delete ${kind}`,
      undo: () => restoreItem(kind, snapshot),
      redo: () => {
        snapshot = findItem(kind, item.id) ?? snapshot;
        return removeItem(kind, item.id);
      },
    });
  }

  /** Stores the patched fields' previous values; undo applies them through the same update function. */
  function recordUpdate(kind: SceneKind, id: string, patch: Record<string, unknown>) {
    const item = findItem(kind, id) as unknown as Record<string, unknown> | undefined;
    const keys = Object.keys(patch);
    if (!item || keys.length === 0 || keys.every((k) => Object.is(item[k], patch[k]))) return;
    const before = Object.fromEntries(keys.map((k) => [k, item[k]]));
    history.record({
      label: editLabel(kind, keys),
      key: keys.some((k) => GESTURE_KEYS.has(k)) ? undefined : `${kind}:${id}:${[...keys].sort().join(",")}`,
      undo: () => latestRef.current?.apply(kind, id, before),
      redo: () => latestRef.current?.apply(kind, id, patch),
    });
  }

  function applyPatch(kind: SceneKind, id: string, patch: Record<string, unknown>) {
    if (kind === "marker") updateMarker(id, patch as Partial<Marker>);
    else if (kind === "zone") updateZone(id, patch as Partial<ZoneData>);
    else if (kind === "text") updateText(id, patch as TextPatch);
    else updateLine(id, patch as LinePatch);
  }

  useEffect(() => {
    latestRef.current = { markers, zones, texts, lines, apply: applyPatch, moveLine };
  });

  function placeMarker(u: number, v: number) {
    setAddingMarker(false);
    fetch(`/api/maps/${mapId}/markers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New marker", u, v, layerId: activeLayerId, ...lastChoiceRef.current }),
    })
      .then((r) => json<{ marker: Marker }>(r))
      .then((d) => {
        closeToolPanels();
        setMarkers((prev) => [...prev, d.marker]);
        recordCreate("marker", d.marker.id);
        setSelectedMarkerId(d.marker.id);
        setAutoFocusName(true);
        setStartInEdit(true);
        ensureIconVisible(d.marker.iconKey);
      });
  }

  function moveMarker(markerId: string, u: number, v: number) {
    recordUpdate("marker", markerId, { u, v });
    setMarkers((prev) => prev.map((m) => (m.id === markerId ? { ...m, u, v } : m)));
    fetch(`/api/markers/${markerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ u, v }),
    });
  }

  function updateMarker(markerId: string, rawPatch: Partial<Marker>) {
    const patch = withHomeLayer(rawPatch, markers.find((m) => m.id === markerId)?.extraLayerIds);
    recordUpdate("marker", markerId, Object.fromEntries(Object.entries(patch).filter(([k]) => MARKER_EDIT_KEYS.has(k))));
    if (patch.iconKey || patch.color || patch.backgroundColor || patch.outlineColor || patch.backgroundShape) {
      lastChoiceRef.current = {
        iconKey: patch.iconKey ?? lastChoiceRef.current.iconKey,
        color: patch.color ?? lastChoiceRef.current.color,
        backgroundColor: patch.backgroundColor ?? lastChoiceRef.current.backgroundColor,
        outlineColor: patch.outlineColor ?? lastChoiceRef.current.outlineColor,
        backgroundShape: patch.backgroundShape ?? lastChoiceRef.current.backgroundShape,
      };
    }
    if (patch.iconKey) ensureIconVisible(patch.iconKey);
    // Moving it to another layer follows it there (unless it stays shown here), so it stays selected and visible.
    if (patch.layerId && !isOnLayer(patch.layerId, patch.extraLayerIds, activeLayerId)) onSetActiveLayer(patch.layerId);
    setMarkers((prev) => prev.map((m) => (m.id === markerId ? { ...m, ...patch } : m)));
    fetch(`/api/markers/${markerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  function duplicateMarker(markerId: string) {
    fetch(`/api/markers/${markerId}/duplicate`, { method: "POST" })
      .then((r) => json<{ marker: Marker }>(r))
      .then((d) => {
        setMarkers((prev) => [...prev, d.marker]);
        recordCreate("marker", d.marker.id, "Duplicate marker");
        setSelectedMarkerId(d.marker.id);
      });
  }

  function deleteMarker(markerId: string) {
    const marker = markers.find((m) => m.id === markerId);
    if (!marker) return;
    recordDelete("marker", marker);
    setMarkers((prev) => prev.filter((m) => m.id !== markerId));
    setSelectedMarkerId(null);
    fetch(`/api/markers/${markerId}`, { method: "DELETE" });

    setUndo((prevUndo) => {
      if (prevUndo) clearTimeout(prevUndo.timer);
      const timer = setTimeout(() => setUndo(null), 6000);
      return { marker, timer };
    });
  }

  function undoDelete() {
    if (!undo) return;
    clearTimeout(undo.timer);
    fetch(`/api/markers/${undo.marker.id}/restore`, { method: "POST" }).then(() => {
      setMarkers((prev) => [...prev, undo.marker]);
    });
    setUndo(null);
  }

  // Closing the panel stops authoring (deselect, drop back to Select) but
  // never touches saved/visible zones — those keep rendering regardless.
  // Done as a render-time adjustment (only on the actual open/close
  // transition) rather than an effect.
  const [lastZonesPanelOpen, setLastZonesPanelOpen] = useState(zonesPanelOpen);
  if (zonesPanelOpen !== lastZonesPanelOpen) {
    setLastZonesPanelOpen(zonesPanelOpen);
    if (!zonesPanelOpen) {
      setActiveZoneTool("select");
      setSelectedZoneId(null);
    }
  }
  // Zone authoring state belongs to one layer — drop it when the layer changes.
  const [lastActiveLayerId, setLastActiveLayerId] = useState(activeLayerId);
  if (activeLayerId !== lastActiveLayerId) {
    setLastActiveLayerId(activeLayerId);
    setSelectedZoneId(null);
    setActiveZoneRegionId(null);
    setActiveZoneTool("select");
    setAddingMarker(false);
    setSelectedTextId(null);
    setPlacingText(false);
    setSelectedLineId(null);
    setDrawingLine(false);
  }

  const [lastAddMarkerRequest, setLastAddMarkerRequest] = useState(addMarkerRequest);
  if (addMarkerRequest !== lastAddMarkerRequest) {
    setLastAddMarkerRequest(addMarkerRequest);
    setAddingMarker((a) => !a);
  }

  // Closing the Lines panel ends line authoring (lines keep rendering).
  const [lastLinePanelOpen, setLastLinePanelOpen] = useState(linePanelOpen);
  if (linePanelOpen !== lastLinePanelOpen) {
    setLastLinePanelOpen(linePanelOpen);
    if (!linePanelOpen) {
      setSelectedLineId(null);
      setDrawingLine(false);
    }
  }

  // Closing the Text panel ends text authoring (texts keep rendering).
  const [lastTextPanelOpen, setLastTextPanelOpen] = useState(textPanelOpen);
  if (textPanelOpen !== lastTextPanelOpen) {
    setLastTextPanelOpen(textPanelOpen);
    if (!textPanelOpen) {
      setSelectedTextId(null);
      setPlacingText(false);
    }
  }

  const layers = layerApi.layers;
  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? null;
  const layerVisible = activeLayer?.visible ?? true;
  const layerLabel = activeLayer ? `${activeLayer.name}${activeLayer.visible ? "" : " (hidden)"}` : "";
  // Memoized so the map layers get stable props and skip re-rendering their
  // overlays when nothing they draw changed.
  // Items on the active layer: their home layer, or "Also show on" it (shared
  // items are fully editable there too).
  const ownRegions = useMemo(() => zoneRegions.filter((r) => r.layerId === activeLayerId), [zoneRegions, activeLayerId]);
  const ownRegionIds = useMemo(() => new Set(ownRegions.map((r) => r.id)), [ownRegions]);
  const layerZones = useMemo(
    () => zones.filter((z) => ownRegionIds.has(z.regionId) || z.extraLayerIds?.includes(activeLayerId)),
    [zones, ownRegionIds, activeLayerId]
  );
  // Home regions of zones shared onto this layer come along (read-only groups in the panel).
  const sharedRegionIds = useMemo(
    () => new Set(layerZones.filter((z) => !ownRegionIds.has(z.regionId)).map((z) => z.regionId)),
    [layerZones, ownRegionIds]
  );
  const layerRegions = useMemo(
    () => (sharedRegionIds.size ? [...ownRegions, ...zoneRegions.filter((r) => sharedRegionIds.has(r.id))] : ownRegions),
    [ownRegions, zoneRegions, sharedRegionIds]
  );
  const layerMarkers = useMemo(() => markers.filter((m) => isOnLayer(m.layerId, m.extraLayerIds, activeLayerId)), [markers, activeLayerId]);
  const layerTexts = useMemo(() => texts.filter((t) => isOnLayer(t.layerId, t.extraLayerIds, activeLayerId)), [texts, activeLayerId]);
  const selectedText = layerTexts.find((t) => t.id === selectedTextId) ?? null;
  const layerLines = useMemo(() => lines.filter((l) => isOnLayer(l.layerId, l.extraLayerIds, activeLayerId)), [lines, activeLayerId]);
  const selectedLine = layerLines.find((l) => l.id === selectedLineId) ?? null;

  // "Always draw": other visible layers flagged per kind are drawn too
  // (display only), stacked by layer order like layer images.
  const zoneLayerIds = useMemo(() => drawnLayerIds(layers, activeLayerId, "zonesAlwaysVisible"), [layers, activeLayerId]);
  const markerLayerIds = useMemo(() => drawnLayerIds(layers, activeLayerId, "markersAlwaysVisible"), [layers, activeLayerId]);
  const textLayerIds = useMemo(() => drawnLayerIds(layers, activeLayerId, "textsAlwaysVisible"), [layers, activeLayerId]);
  const lineLayerIds = useMemo(() => drawnLayerIds(layers, activeLayerId, "linesAlwaysVisible"), [layers, activeLayerId]);
  const foreignZones = useMemo(() => {
    const under: PaintedZone[] = [];
    const over: PaintedZone[] = [];
    const activeIndex = zoneLayerIds.indexOf(activeLayerId);
    const onActive = new Set(layerZones.map((z) => z.id));
    zoneLayerIds.forEach((layerId, i) => {
      if (layerId === activeLayerId) return;
      const regions = zoneRegions.filter((r) => r.layerId === layerId);
      const ids = new Set(regions.map((r) => r.id));
      const painted = zonePaintOrder(regions, zones.filter((z) => ids.has(z.regionId) && !onActive.has(z.id)));
      (activeIndex === -1 || i < activeIndex ? under : over).push(...painted);
    });
    return { under, over };
  }, [zoneLayerIds, activeLayerId, zoneRegions, zones, layerZones]);
  const drawnMarkers = useMemo(
    () => itemsInLayers(markers, (m) => m.layerId, markerLayerIds, { extrasOf: (m) => m.extraLayerIds, activeLayerId }),
    [markers, markerLayerIds, activeLayerId]
  );
  const drawnTexts = useMemo(
    () => itemsInLayers(texts, (t) => t.layerId, textLayerIds, { extrasOf: (t) => t.extraLayerIds, activeLayerId }),
    [texts, textLayerIds, activeLayerId]
  );
  const drawnLines = useMemo(
    () => itemsInLayers(lines, (l) => l.layerId, lineLayerIds, { extrasOf: (l) => l.extraLayerIds, activeLayerId }),
    [lines, lineLayerIds, activeLayerId]
  );
  const editableMarkerIds = useMemo(() => new Set(layerVisible ? layerMarkers.map((m) => m.id) : []), [layerMarkers, layerVisible]);
  const editableTextIds = useMemo(() => new Set(layerTexts.map((t) => t.id)), [layerTexts]);
  const editableLineIds = useMemo(() => new Set(layerLines.map((l) => l.id)), [layerLines]);

  // The active region (where new zones go) is always one of the layer's own.
  if (zonesPanelOpen && !ownRegionIds.has(activeZoneRegionId ?? "") && ownRegions.length > 0) {
    setActiveZoneRegionId([...ownRegions].sort((a, b) => a.sortOrder - b.sortOrder)[0].id);
  }

  // Only one lateral tool is ever open at a time — the reverse direction of
  // closeToolPanels() above: opening Grid/Zones/Filter deselects any open
  // marker instead of showing both side by side.
  const sidePanelOpen = gridPanelOpen || zonesPanelOpen || iconFilterPanelOpen || layersPanelOpen || textPanelOpen || linePanelOpen || scenePanelOpen;
  // The Selection tool has no side panel, but is exclusive with them all the same.
  const anyToolPanelOpen = sidePanelOpen || selectToolOn;
  const [lastAnyToolPanelOpen, setLastAnyToolPanelOpen] = useState(anyToolPanelOpen);
  if (anyToolPanelOpen !== lastAnyToolPanelOpen) {
    setLastAnyToolPanelOpen(anyToolPanelOpen);
    if (anyToolPanelOpen) setSelectedMarkerId(null);
  }

  /**
   * Arming a shape tool (Add zone, rectangle/circle/polygon) starts a new
   * zone, so the previously edited zone stops being highlighted. Brush and
   * eraser keep the selection: they paint into the selected zone.
   */
  function setZoneTool(tool: ZoneTool) {
    if (tool === "rectangle" || tool === "circle" || tool === "polygon") setSelectedZoneId(null);
    setActiveZoneTool(tool);
  }

  function createZoneRegion(name: string) {
    fetch(`/api/maps/${mapId}/zone-regions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, layerId: activeLayerId }),
    })
      .then((r) => json<{ region: ZoneRegionData }>(r))
      .then((d) => {
        setZoneRegions((prev) => [...prev, d.region]);
        setActiveZoneRegionId(d.region.id);
      });
  }

  function updateZoneRegion(id: string, patch: Partial<ZoneRegionData>) {
    setZoneRegions((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    fetch(`/api/zone-regions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  function deleteZoneRegion(id: string, mode?: "cascade" | "move", targetRegionId?: string) {
    setZoneRegions((prev) => prev.filter((r) => r.id !== id));
    if (mode === "cascade") setZones((prev) => prev.filter((z) => z.regionId !== id));
    else if (mode === "move" && targetRegionId) setZones((prev) => prev.map((z) => (z.regionId === id ? { ...z, regionId: targetRegionId } : z)));
    if (activeZoneRegionId === id) setActiveZoneRegionId(null);
    const qs = mode ? `?mode=${mode}${targetRegionId ? `&targetRegionId=${targetRegionId}` : ""}` : "";
    fetch(`/api/zone-regions/${id}${qs}`, { method: "DELETE" });
  }

  function createZone(regionId: string, shapeType: ZoneData["shapeType"], geometry: object) {
    fetch(`/api/maps/${mapId}/zones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regionId, shapeType, geometry, imageWidth, imageHeight }),
    })
      .then((r) => json<{ zone?: ZoneData; error?: string }>(r))
      .then((d) => {
        if (!d.zone) {
          window.alert(d.error ?? "Could not create zone.");
          setActiveZoneTool("select");
          return;
        }
        setZones((prev) => [...prev, d.zone!]);
        recordCreate("zone", d.zone.id);
        setSelectedZoneId(d.zone.id);
        // A painted zone keeps the brush armed: the new zone is now selected,
        // so the next strokes keep adding to it.
        if (shapeType !== "area") setActiveZoneTool("select");
      });
  }

  /**
   * Edits are applied optimistically, so a save the server rejects must not
   * fail silently (it used to: every on-map shape edit was rejected and only
   * vanished on reload). Show why, and resync zones from the server so the
   * map shows what is actually saved.
   */
  function reportSaveFailure(what: string, detail: string) {
    setSaveError((prev) => {
      if (prev) clearTimeout(prev.timer);
      const timer = setTimeout(() => setSaveError(null), 8000);
      return { message: `Couldn't save ${what}: ${detail}`, timer };
    });
  }

  function resyncZones() {
    fetch(`/api/maps/${mapId}/zones`)
      .then((r) => json<{ zones?: ZoneData[] }>(r))
      .then((d) => d.zones && setZones(d.zones));
  }

  function updateZone(id: string, patch: Partial<ZoneData>) {
    recordUpdate("zone", id, patch);
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, ...patch } : z)));
    const timers = zonePatchTimersRef.current;
    const pending = pendingZonePatchesRef.current;
    // Color-wheel drags and opacity/width sliders fire on every pointer
    // move, so those writes are debounced — merged per zone, so a newer
    // edit never cancels an older unsent one. Geometry commits (one per
    // completed gesture) flush everything pending immediately.
    const merged = { ...(pending.get(id) ?? {}), ...patch };
    pending.set(id, merged);
    clearTimeout(timers.get(id));
    const send = () => {
      pending.delete(id);
      timers.delete(id);
      const body: Record<string, unknown> = { ...merged };
      if ("geometry" in merged) {
        // Local state keeps geometry as the stored JSON text; the API takes an object.
        body.geometry = typeof merged.geometry === "string" ? JSON.parse(merged.geometry) : merged.geometry;
        body.imageWidth = imageWidth;
        body.imageHeight = imageHeight;
      }
      fetch(`/api/zones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then(async (res) => {
          if (res.ok) return;
          const data: { error?: string } = await res.json().catch(() => ({}));
          reportSaveFailure("zone change", data.error ?? `server returned ${res.status}`);
          resyncZones();
        })
        .catch(() => reportSaveFailure("zone change", "the server is not reachable"));
    };
    if ("geometry" in patch) send();
    else timers.set(id, setTimeout(send, 250));
  }

  function deleteZone(id: string) {
    const zone = zones.find((z) => z.id === id);
    if (!zone) return;
    recordDelete("zone", zone);
    setZones((prev) => prev.filter((z) => z.id !== id));
    if (selectedZoneId === id) setSelectedZoneId(null);
    fetch(`/api/zones/${id}`, { method: "DELETE" });

    setZoneUndo((prevUndo) => {
      if (prevUndo) clearTimeout(prevUndo.timer);
      const timer = setTimeout(() => setZoneUndo(null), 6000);
      return { zone, timer };
    });
  }

  function undoZoneDelete() {
    if (!zoneUndo) return;
    clearTimeout(zoneUndo.timer);
    fetch(`/api/zones/${zoneUndo.zone.id}/restore`, { method: "POST" }).then(() => {
      setZones((prev) => [...prev, zoneUndo.zone]);
    });
    setZoneUndo(null);
  }

  // Only markers on the active layer can be selected; switching layers
  // implicitly closes the panel of a marker left behind on the old one.
  function placeText(x: number, y: number) {
    setPlacingText(false);
    fetch(`/api/maps/${mapId}/texts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...textDraft, x, y, layerId: activeLayerId }),
    })
      .then((r) => json<{ text?: MapTextData; error?: string }>(r))
      .then((d) => {
        if (!d.text) {
          window.alert(d.error ?? "Could not place text.");
          return;
        }
        setTexts((prev) => [...prev, d.text!]);
        recordCreate("text", d.text.id);
        setSelectedTextId(d.text.id);
      });
  }

  /** Optimistic; slider/typing edits are debounced, gesture commits and layer moves go straight through. */
  function updateText(id: string, rawPatch: TextPatch) {
    const patch = withHomeLayer(rawPatch, texts.find((t) => t.id === id)?.extraLayerIds);
    recordUpdate("text", id, patch);
    setTexts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    // Moving it to another layer follows it there (unless it stays shown here), so it stays selected and visible.
    if (patch.layerId && !isOnLayer(patch.layerId, patch.extraLayerIds, activeLayerId)) onSetActiveLayer(patch.layerId);
    const timers = textPatchTimersRef.current;
    const send = () =>
      fetch(`/api/texts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    const immediate = "layerId" in patch || "x" in patch || "y" in patch;
    if (immediate) {
      void send();
      return;
    }
    // Merge with a still-pending edit of the same text so no field is lost.
    const pending = pendingTextPatchesRef.current;
    const merged = { ...(pending.get(id) ?? {}), ...patch };
    pending.set(id, merged);
    clearTimeout(timers.get(id));
    timers.set(
      id,
      setTimeout(() => {
        pending.delete(id);
        void fetch(`/api/texts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(merged),
        });
      }, 250)
    );
  }

  function onTextPanelChange(patch: TextPatch) {
    if (selectedText) {
      updateText(selectedText.id, patch);
      return;
    }
    const { layerId: _layerId, ...style } = patch;
    void _layerId;
    setTextDraft((prev) => ({ ...prev, ...style }));
  }

  function deleteText(id: string) {
    const text = texts.find((t) => t.id === id);
    if (!text) return;
    recordDelete("text", text);
    setTexts((prev) => prev.filter((t) => t.id !== id));
    if (selectedTextId === id) setSelectedTextId(null);
    fetch(`/api/texts/${id}`, { method: "DELETE" });
    setTextUndo((prevUndo) => {
      if (prevUndo) clearTimeout(prevUndo.timer);
      const timer = setTimeout(() => setTextUndo(null), 6000);
      return { text, timer };
    });
  }

  function undoTextDelete() {
    if (!textUndo) return;
    clearTimeout(textUndo.timer);
    fetch(`/api/texts/${textUndo.text.id}/restore`, { method: "POST" }).then(() => {
      setTexts((prev) => [...prev, textUndo.text]);
    });
    setTextUndo(null);
  }

  function createLine(kind: LineKind, points: PenPt[]) {
    fetch(`/api/maps/${mapId}/lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...lineDraft, kind, points, layerId: activeLayerId }),
    })
      .then((r) => json<{ line?: MapLineData; error?: string }>(r))
      .then((d) => {
        if (!d.line) {
          window.alert(d.error ?? "Could not save the line.");
          return;
        }
        setLines((prev) => [...prev, d.line!]);
        recordCreate("line", d.line.id);
        // The line just drawn stays selected, so style changes right after apply to it.
        setSelectedLineId(d.line.id);
        setDrawingLine(false);
      });
  }

  /** Selecting a line (also while armed to draw) edits it, and seeds the next line's style. */
  function selectLine(id: string | null) {
    setSelectedLineId(id);
    if (!id) return;
    setDrawingLine(false);
    const line = lines.find((l) => l.id === id);
    if (line) {
      setLineDraft((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(prev) as (keyof LineStyle)[]) (next as Record<string, unknown>)[key] = line[key];
        return next;
      });
    }
  }

  /** Optimistic; style edits are debounced (merged per line), layer moves go straight through. */
  function updateLine(id: string, rawPatch: LinePatch) {
    const patch = withHomeLayer(rawPatch, lines.find((l) => l.id === id)?.extraLayerIds);
    recordUpdate("line", id, patch);
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    // Moving it to another layer follows it there (unless it stays shown here), so it stays selected and visible.
    if (patch.layerId && !isOnLayer(patch.layerId, patch.extraLayerIds, activeLayerId)) onSetActiveLayer(patch.layerId);
    const body = (b: LinePatch) => ({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
    if ("layerId" in patch) {
      void fetch(`/api/lines/${id}`, body(patch));
      return;
    }
    const pending = pendingLinePatchesRef.current;
    const merged = { ...(pending.get(id) ?? {}), ...patch };
    pending.set(id, merged);
    const timers = linePatchTimersRef.current;
    clearTimeout(timers.get(id));
    timers.set(
      id,
      setTimeout(() => {
        pending.delete(id);
        void fetch(`/api/lines/${id}`, body(merged));
      }, 250)
    );
  }

  /** The server applies the move (and its clamping); the response is the source of truth. */
  function moveLine(id: string, dx: number, dy: number) {
    history.record({
      label: "Move line",
      undo: () => latestRef.current?.moveLine(id, -dx, -dy),
      redo: () => latestRef.current?.moveLine(id, dx, dy),
    });
    setLines((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              points: l.points.map((p) => ({
                x: p.x + dx,
                y: p.y + dy,
                ...(p.cin ? { cin: { x: p.cin.x + dx, y: p.cin.y + dy } } : {}),
                ...(p.cout ? { cout: { x: p.cout.x + dx, y: p.cout.y + dy } } : {}),
              })),
            }
          : l
      )
    );
    fetch(`/api/lines/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dx, dy }) })
      .then((r) => json<{ line?: MapLineData }>(r))
      .then((d) => {
        if (d.line) setLines((prev) => prev.map((l) => (l.id === id ? { ...l, points: d.line!.points } : l)));
      });
  }

  function onLinePanelChange(patch: LinePatch) {
    if (selectedLine) {
      updateLine(selectedLine.id, patch);
      return;
    }
    const { layerId: _layerId, ...style } = patch;
    void _layerId;
    setLineDraft((prev) => ({ ...prev, ...style }));
  }

  function deleteLine(id: string) {
    const line = lines.find((l) => l.id === id);
    if (!line) return;
    recordDelete("line", line);
    setLines((prev) => prev.filter((l) => l.id !== id));
    if (selectedLineId === id) setSelectedLineId(null);
    fetch(`/api/lines/${id}`, { method: "DELETE" });
    setLineUndo((prevUndo) => {
      if (prevUndo) clearTimeout(prevUndo.timer);
      const timer = setTimeout(() => setLineUndo(null), 6000);
      return { line, timer };
    });
  }

  function undoLineDelete() {
    if (!lineUndo) return;
    clearTimeout(lineUndo.timer);
    fetch(`/api/lines/${lineUndo.line.id}/restore`, { method: "POST" }).then(() => {
      setLines((prev) => [...prev, lineUndo.line]);
    });
    setLineUndo(null);
  }

  /** Map-wide shortcuts: Ctrl/Cmd+Z undo, Ctrl+Y or Ctrl+Shift+Z redo, Ctrl+C / Ctrl+V copy and paste the selected item. */
  function handleShortcut(e: KeyboardEvent) {
    if (e.key === "Escape" && selectToolOn) {
      onCloseSelectTool();
      return;
    }
    if (!(e.ctrlKey || e.metaKey) || e.altKey || isTypingTarget(e.target)) return;
    const key = e.key.toLowerCase();
    if (key === "c" && !e.shiftKey) {
      // Selected page text keeps the browser's own copy.
      if (!window.getSelection()?.isCollapsed) return;
      if (copySelected()) e.preventDefault();
      return;
    }
    if (key === "v" && !e.shiftKey) {
      if (!clipboardRef.current) return;
      e.preventDefault();
      pasteClipboard();
      return;
    }
    const isUndo = key === "z" && !e.shiftKey;
    const isRedo = key === "y" || (key === "z" && e.shiftKey);
    if (!isUndo && !isRedo) return;
    // A line or polygon being drawn keeps its own gestures (Backspace/Esc).
    if ((linePanelOpen && drawingLine) || (zonesPanelOpen && activeZoneTool === "polygon")) return;
    e.preventDefault();
    if (isUndo) history.undo();
    else history.redo();
  }
  const shortcutRef = useRef(handleShortcut);
  useEffect(() => {
    shortcutRef.current = handleShortcut;
  });
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => shortcutRef.current(e);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ---- Copy / paste ----

  function copySelected(): boolean {
    const zone = zonesPanelOpen ? layerZones.find((z) => z.id === selectedZoneId) : undefined;
    const text = textPanelOpen ? selectedText : null;
    const line = linePanelOpen ? selectedLine : null;
    if (selectedMarker) clipboardRef.current = { kind: "marker", item: selectedMarker };
    else if (zone) clipboardRef.current = { kind: "zone", item: zone, regionName: zoneRegions.find((r) => r.id === zone.regionId)?.name };
    else if (text) clipboardRef.current = { kind: "text", item: text };
    else if (line) clipboardRef.current = { kind: "line", item: line };
    else return false;
    return true;
  }

  /** Where a paste lands: under the pointer, or the middle of the view when it isn't over the map. */
  function pastePoint(): { x: number; y: number } | null {
    const p = pointerRef.current;
    const hit = p ? clientToImagePoint(viewer, osd, p.x, p.y) : null;
    const inFrame = hit && hit.x >= 0 && hit.y >= 0 && hit.x <= imageWidth && hit.y <= imageHeight;
    if (inFrame) return hit;
    const tiledImage = viewer?.world.getItemAt(0);
    if (!viewer || !tiledImage) return null;
    const c = tiledImage.viewportToImageCoordinates(viewer.viewport.getCenter(true));
    return { x: Math.min(imageWidth, Math.max(0, c.x)), y: Math.min(imageHeight, Math.max(0, c.y)) };
  }

  /** Switches to the item's tool and selects it. */
  function openItem(kind: SceneKind, id: string, regionId?: string) {
    if (kind === "marker") {
      selectMarker(id);
    } else if (kind === "zone") {
      onOpenZonesPanel();
      if (regionId) setActiveZoneRegionId(regionId);
      setActiveZoneTool("select");
      setSelectedZoneId(id);
    } else if (kind === "text") {
      onOpenTextPanel();
      setPlacingText(false);
      setSelectedTextId(id);
    } else {
      onOpenLinePanel();
      setDrawingLine(false);
      setSelectedLineId(id);
    }
  }

  /** Pasted copies land on the active layer only, with every other setting of the source. */
  function pasteClipboard() {
    const clip = clipboardRef.current;
    const point = clip && pastePoint();
    if (!clip || !point) return;
    const frame = { width: imageWidth, height: imageHeight };
    const post = (url: string, body: object) =>
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const fail = (what: string) => (d: { error?: string }) => window.alert(d.error ?? `Could not paste the ${what}.`);

    if (clip.kind === "marker") {
      post(`/api/markers/${clip.item.id}/duplicate`, { exact: true, u: point.x / imageWidth, v: point.y / imageHeight, layerId: activeLayerId })
        .then((r) => json<{ marker?: Marker; error?: string }>(r))
        .then((d) => {
          if (!d.marker) return fail("marker")(d);
          setMarkers((prev) => [...prev, d.marker!]);
          recordCreate("marker", d.marker.id, "Paste marker");
          ensureIconVisible(d.marker.iconKey);
          openItem("marker", d.marker.id);
        });
    } else if (clip.kind === "zone") {
      void pasteZone(clip.item as ZoneData, clip.regionName, point);
    } else if (clip.kind === "text") {
      const { id: _id, layerId: _layer, extraLayerIds: _extra, ...fields } = clip.item as MapTextData;
      void [_id, _layer, _extra];
      post(`/api/maps/${mapId}/texts`, { ...fields, x: point.x, y: point.y, layerId: activeLayerId })
        .then((r) => json<{ text?: MapTextData; error?: string }>(r))
        .then((d) => {
          if (!d.text) return fail("text")(d);
          setTexts((prev) => [...prev, d.text!]);
          recordCreate("text", d.text.id, "Paste text");
          openItem("text", d.text.id);
        });
    } else {
      const { id: _id, layerId: _layer, extraLayerIds: _extra, points, ...fields } = clip.item as MapLineData;
      void [_id, _layer, _extra];
      const b = lineBounds(points);
      const { dx, dy } = b ? centerAt(b, point, frame) : { dx: 0, dy: 0 };
      post(`/api/maps/${mapId}/lines`, { ...fields, points: translatePoints(points, dx, dy, frame), layerId: activeLayerId })
        .then((r) => json<{ line?: MapLineData; error?: string }>(r))
        .then((d) => {
          if (!d.line) return fail("line")(d);
          setLines((prev) => [...prev, d.line!]);
          recordCreate("line", d.line.id, "Paste line");
          openItem("line", d.line.id);
        });
    }
  }

  /**
   * A zone goes into the active region of the current layer, else its first
   * region, else a new region named like the source's.
   */
  async function pasteZone(source: ZoneData, regionName: string | undefined, point: { x: number; y: number }) {
    const sorted = [...ownRegions].sort((a, b) => a.sortOrder - b.sortOrder);
    let regionId = ownRegionIds.has(activeZoneRegionId ?? "") ? activeZoneRegionId! : sorted[0]?.id;
    if (!regionId) {
      const res = await fetch(`/api/maps/${mapId}/zone-regions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: regionName ?? "Region 1", layerId: activeLayerId }),
      });
      const d = await json<{ region?: ZoneRegionData; error?: string }>(res);
      if (!d.region) return window.alert(d.error ?? "Could not create a region for the zone.");
      setZoneRegions((prev) => [...prev, d.region!]);
      regionId = d.region.id;
    }
    const geometry = JSON.parse(source.geometry);
    const b = zoneBounds(geometry);
    const { dx, dy } = b ? centerAt(b, point, { width: imageWidth, height: imageHeight }) : { dx: 0, dy: 0 };
    const res = await fetch(`/api/maps/${mapId}/zones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        regionId,
        shapeType: source.shapeType,
        geometry: translateZoneGeometry(geometry, dx, dy),
        imageWidth,
        imageHeight,
        name: source.name,
        fillColor: source.fillColor,
        fillOpacity: source.fillOpacity,
        strokeColor: source.strokeColor,
        strokeOpacity: source.strokeOpacity,
        strokeWidth: source.strokeWidth,
        territoryId: source.territoryId,
        visible: source.visible,
        locked: source.locked,
      }),
    });
    const d = await json<{ zone?: ZoneData; error?: string }>(res);
    if (!d.zone) return window.alert(d.error ?? "Could not paste the zone.");
    setZones((prev) => [...prev, d.zone!]);
    recordCreate("zone", d.zone.id, "Paste zone");
    openItem("zone", d.zone.id, regionId);
  }

  /** Zooms the viewer so the frame-pixel rect `b` is emphasized (see focusRect). */
  function fitToImageRect(b: Rect) {
    const tiledImage = viewer?.world.getItemAt(0);
    if (!viewer || !osd || !tiledImage) return;
    const r = focusRect(b, { width: imageWidth, height: imageHeight });
    viewer.viewport.fitBounds(tiledImage.imageToViewportRectangle(new osd.Rect(r.x, r.y, r.width, r.height)));
  }

  function pulse(id: string) {
    clearTimeout(pulseTimerRef.current);
    setPulseId(id);
    pulseTimerRef.current = setTimeout(() => setPulseId(null), 1200);
  }

  /** Scene panel / Selection tool pick: switch to the item's tool and select it, zooming to it unless `zoom` is false. */
  function focusSceneItem(kind: SceneKind, id: string, { zoom = true }: { zoom?: boolean } = {}) {
    let b: Rect | null = null;
    if (kind === "marker") {
      const m = layerMarkers.find((x) => x.id === id);
      if (!m) return;
      b = { x: m.u * imageWidth, y: m.v * imageHeight, width: 0, height: 0 };
      openItem(kind, id);
    } else if (kind === "zone") {
      const z = layerZones.find((x) => x.id === id);
      if (!z) return;
      b = zoneBounds(JSON.parse(z.geometry));
      openItem(kind, id, z.regionId);
    } else if (kind === "text") {
      const t = layerTexts.find((x) => x.id === id);
      if (!t) return;
      b = textBounds(t);
      openItem(kind, id);
    } else {
      const l = layerLines.find((x) => x.id === id);
      if (!l) return;
      b = lineBounds(l.points);
      onOpenLinePanel();
      selectLine(id);
    }
    if (b && zoom) fitToImageRect(b);
    pulse(id);
  }

  // ---- Selection tool ----

  // What can be picked: the active layer's items (shared ones included) as drawn.
  const hitScene = useMemo<HitScene | null>(() => {
    if (!selectToolOn || !layerVisible) return null;
    return {
      markers: layerMarkers
        .filter((m) => iconFilter.allOn || iconFilter.selected.has(m.iconKey))
        .map((m) => ({ id: m.id, x: m.u * imageWidth, y: m.v * imageHeight })),
      texts: layerTexts,
      lines: layerLines.map((l) => ({ id: l.id, points: l.points, width: l.width })),
      zones: zonePaintOrder(layerRegions, layerZones)
        .filter(({ zone, region }) => zone.visible && region.visible)
        .flatMap(({ zone }) => {
          const geometry = JSON.parse(zone.geometry);
          const bounds = zoneBounds(geometry);
          return bounds ? [{ id: zone.id, bounds, polygons: toMultiPolygon(geometry) }] : [];
        }),
    };
  }, [selectToolOn, layerVisible, layerMarkers, layerTexts, layerLines, layerRegions, layerZones, iconFilter, imageWidth, imageHeight]);

  const pickRef = useRef<(hit: Hit) => void>(() => {});
  useEffect(() => {
    pickRef.current = (hit) => focusSceneItem(hit.kind, hit.id, { zoom: false });
  });

  // Hover outlines the item under the pointer (once per frame); a click (not a pan) picks it.
  useEffect(() => {
    if (!viewer || !osd || !hitScene) return;
    const el = viewer.element;
    const hitAt = (clientX: number, clientY: number) => {
      const p = clientToImagePoint(viewer, osd, clientX, clientY);
      return p ? hitTest(hitScene, p, screenPxPerImagePx(viewer)) : null;
    };
    let frame = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const hit = hitAt(e.clientX, e.clientY);
        setHovered((prev) => (prev?.id === hit?.id ? prev : hit));
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      setHovered(null);
    };
    const onClick = (event: OpenSeadragonType.CanvasClickEvent) => {
      if (!event.quick) return;
      const rect = viewer.container.getBoundingClientRect();
      const hit = hitAt(rect.left + event.position.x, rect.top + event.position.y);
      if (hit) pickRef.current(hit);
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    viewer.addHandler("canvas-click", onClick);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      viewer.removeHandler("canvas-click", onClick);
    };
  }, [viewer, osd, hitScene]);

  // The hover box goes away with the tool.
  if (!selectToolOn && hovered) setHovered(null);

  const selectedMarker = layerMarkers.find((m) => m.id === selectedMarkerId) ?? null;
  const markerToolActive = addingMarker || selectedMarker !== null;
  useEffect(() => onMarkerToolChange(markerToolActive), [markerToolActive, onMarkerToolChange]);
  // Filtering only ever changes what's rendered on the map — selection,
  // editing, and every other marker feature keep using the full `markers`
  // array untouched. A hidden layer draws nothing.
  const visibleMarkers = useMemo(
    () => (iconFilter.allOn ? drawnMarkers : drawnMarkers.filter((m) => iconFilter.selected.has(m.iconKey))),
    [drawnMarkers, iconFilter.allOn, iconFilter.selected]
  );

  return (
    <div className="viewer-layout">
      <div className="viewer-canvas-area">
        <div ref={viewerElRef} className="spike-viewer" />

        {selectedMarker && (
          <>
            <MarkerSectionStrip section={markerSection} onChange={setMarkerSection} />
            <MarkerPanel
              key={selectedMarker.id}
              marker={selectedMarker}
              maps={allMaps}
              layers={layerApi.layers}
              section={markerSection}
              autoFocusName={autoFocusName}
              startInEdit={startInEdit}
              onUpdate={(patch) => updateMarker(selectedMarker.id, patch)}
              onDuplicate={() => duplicateMarker(selectedMarker.id)}
              onDelete={() => deleteMarker(selectedMarker.id)}
              onClose={() => setSelectedMarkerId(null)}
            />
          </>
        )}

        <div
          className={selectedMarker ? "viewer-toolbar-left panel-open" : "viewer-toolbar-left"}
          style={{
            // The zones panel widens to two columns (640px) while a zone is being edited.
            left: 12 + ((zonesPanelOpen && selectedZoneId) || textPanelOpen ? 640 : selectedMarker || sidePanelOpen ? 320 : 0),
          }}
        >
          <button
            className={addingMarker ? "btn active" : "btn"}
            onClick={() => setAddingMarker((a) => !a)}
          >
            <MapPin size={15} strokeWidth={2.25} />
            {addingMarker ? "Click the map…" : "Add marker"}
          </button>

          <select
            className="layer-select"
            value={activeLayerId}
            onChange={(e) => onSetActiveLayer(e.target.value)}
            aria-label="Active layer"
            title="Active layer — markers, zones, grid and image shown and edited"
          >
            {layerApi.layers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.visible ? "" : " (hidden)"}
              </option>
            ))}
          </select>

          <div className="viewer-nav-controls">
            <button
              className="btn btn-icon"
              disabled={!history.undoLabel}
              onClick={history.undo}
              aria-label={history.undoLabel ? `Undo: ${history.undoLabel}` : "Undo"}
              title={history.undoLabel ? `Undo: ${history.undoLabel} (Ctrl+Z)` : "Nothing to undo"}
            >
              <Undo2 size={16} strokeWidth={2.25} />
            </button>
            <button
              className="btn btn-icon"
              disabled={!history.redoLabel}
              onClick={history.redo}
              aria-label={history.redoLabel ? `Redo: ${history.redoLabel}` : "Redo"}
              title={history.redoLabel ? `Redo: ${history.redoLabel} (Ctrl+Y)` : "Nothing to redo"}
            >
              <Redo2 size={16} strokeWidth={2.25} />
            </button>
            <button
              className="btn btn-icon"
              disabled={!viewer}
              onClick={() => viewer?.viewport.zoomBy(ZOOM_PER_CLICK)}
              aria-label="Zoom in"
              title="Zoom in"
            >
              <ZoomIn size={16} strokeWidth={2.25} />
            </button>
            <button
              className="btn btn-icon"
              disabled={!viewer}
              onClick={() => viewer?.viewport.zoomBy(1 / ZOOM_PER_CLICK)}
              aria-label="Zoom out"
              title="Zoom out"
            >
              <ZoomOut size={16} strokeWidth={2.25} />
            </button>
            <button
              className="btn btn-icon"
              disabled={!viewer}
              onClick={() => viewer?.viewport.goHome()}
              aria-label="Reset view"
              title="Reset view"
            >
              <Home size={16} strokeWidth={2.25} />
            </button>
            <button
              className="btn btn-icon"
              disabled={!viewer}
              onClick={toggleFullscreen}
              aria-label="Toggle fullscreen"
              title="Toggle fullscreen"
            >
              {isFullscreen ? <Minimize size={16} strokeWidth={2.25} /> : <Maximize size={16} strokeWidth={2.25} />}
            </button>
          </div>
        </div>

        <GridLayer viewer={viewer} osd={osd} grid={layerVisible ? grid : null} />

        <ZoneLayer
          viewer={viewer}
          osd={osd}
          authoring={zonesPanelOpen && layerVisible}
          regions={layerVisible ? layerRegions : NO_REGIONS}
          zones={layerVisible ? layerZones : NO_ZONES}
          underZones={foreignZones.under}
          overZones={foreignZones.over}
          pulseId={pulseId}
          activeTool={activeZoneTool}
          activeRegionId={activeZoneRegionId}
          selectedZoneId={selectedZoneId}
          onSelectZone={setSelectedZoneId}
          onCreateZone={createZone}
          onUpdateZoneGeometry={(zoneId, geometry) => updateZone(zoneId, { geometry: JSON.stringify(geometry) })}
          onPaintZone={(zoneId, geometry) =>
            geometry ? updateZone(zoneId, { shapeType: "area", geometry: JSON.stringify(geometry) }) : deleteZone(zoneId)
          }
          brushSize={brushSize}
          onBrushSizeChange={setBrushSize}
        />

        <LineLayer
          viewer={viewer}
          osd={osd}
          authoring={linePanelOpen && layerVisible}
          drawing={drawingLine}
          mode={lineMode}
          draftStyle={lineDraft}
          lines={drawnLines}
          editableIds={editableLineIds}
          pulseId={pulseId}
          selectedLineId={selectedLineId}
          onCreate={createLine}
          onCancelDraw={() => setDrawingLine(false)}
          onSelect={selectLine}
          onMove={moveLine}
          onDelete={deleteLine}
        />

        <TextLayer
          viewer={viewer}
          osd={osd}
          authoring={textPanelOpen && layerVisible}
          placing={placingText}
          texts={drawnTexts}
          editableIds={editableTextIds}
          pulseId={pulseId}
          selectedTextId={selectedTextId}
          onPlace={placeText}
          onCancelPlace={() => setPlacingText(false)}
          onSelect={setSelectedTextId}
          onUpdate={updateText}
          onDelete={deleteText}
        />

        <MarkerLayer
          viewer={viewer}
          osd={osd}
          markers={visibleMarkers}
          editableIds={editableMarkerIds}
          pulseId={pulseId}
          addingMarker={addingMarker}
          onPlaceMarker={placeMarker}
          onSelectMarker={(id) => selectMarker(id)}
          onEditMarker={(id) => selectMarker(id, { startInEdit: true })}
          onOverlapChoice={(ids, point) => setOverlapChoices({ ids, x: point.x, y: point.y })}
          onMoveMarker={moveMarker}
          selectedMarkerId={selectedMarkerId}
          interactive={
            !selectToolOn &&
            !(zonesPanelOpen && (activeZoneTool !== "select" || selectedZoneId !== null)) &&
            !(textPanelOpen && (placingText || selectedTextId !== null)) &&
            !(linePanelOpen && (drawingLine || selectedLineId !== null))
          }
        />

        {selectToolOn && (
          <SelectionLayer
            viewer={viewer}
            box={hovered?.bounds ?? null}
            pad={4 / screenPxPerImagePx(viewer)}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
          />
        )}

        {gridPanelOpen && grid && (
          <GridPanel
            layerName={layerLabel}
            grid={grid}
            onUpdate={onUpdateGrid}
            onDelete={onDeleteGrid}
            onClose={onCloseGridPanel}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
          />
        )}

        {zonesPanelOpen && (
          <ZonesPanel
            layerName={layerLabel}
            regions={layerRegions}
            zones={layerZones}
            activeRegionId={activeZoneRegionId}
            selectedZoneId={selectedZoneId}
            activeTool={activeZoneTool}
            onSetActiveRegion={setActiveZoneRegionId}
            onSetActiveTool={setZoneTool}
            brushSize={brushSize}
            onBrushSizeChange={setBrushSize}
            onSelectZone={setSelectedZoneId}
            onCreateRegion={createZoneRegion}
            onUpdateRegion={updateZoneRegion}
            onDeleteRegion={deleteZoneRegion}
            onUpdateZone={updateZone}
            onDeleteZone={deleteZone}
            onClose={onCloseZonesPanel}
            layers={layers}
            sharedRegionIds={sharedRegionIds}
          />
        )}

        {layersPanelOpen && (
          <LayersPanel
            layers={layerApi.layers}
            activeLayerId={activeLayerId}
            onSetActive={onSetActiveLayer}
            onCreate={() => void layerApi.createLayer()}
            onUpdate={layerApi.updateLayer}
            onReorder={layerApi.reorderLayers}
            onDelete={onDeleteLayer}
            onUpload={layerApi.uploadLayerImage}
            onRemoveImage={(id) => void layerApi.removeLayerImage(id)}
            onRetry={(assetId) => void layerApi.retryLayerImage(assetId)}
            onClose={onCloseLayersPanel}
          />
        )}

        {textPanelOpen && (
          <TextPanel
            layerName={layerLabel}
            selected={selectedText}
            draft={textDraft}
            layers={layerApi.layers}
            placing={placingText}
            maxFontSize={Math.max(64, Math.round(Math.max(imageWidth, imageHeight) / 6))}
            onTogglePlacing={() => {
              setAddingMarker(false);
              setSelectedTextId(null);
              setPlacingText((p) => !p);
            }}
            onChange={onTextPanelChange}
            onDelete={() => selectedText && deleteText(selectedText.id)}
            onDone={() => setSelectedTextId(null)}
            onClose={onCloseTextPanel}
          />
        )}

        {linePanelOpen && (
          <LinePanel
            layerName={layerLabel}
            selected={selectedLine}
            draft={lineDraft}
            layers={layerApi.layers}
            mode={lineMode}
            drawing={drawingLine}
            maxWidth={Math.max(8, Math.round(Math.max(imageWidth, imageHeight) / 50))}
            onSetMode={setLineMode}
            onToggleDrawing={() => {
              setAddingMarker(false);
              setSelectedLineId(null);
              setDrawingLine((d) => !d);
            }}
            onChange={onLinePanelChange}
            onDelete={() => selectedLine && deleteLine(selectedLine.id)}
            onDone={() => setSelectedLineId(null)}
            onClose={onCloseLinePanel}
          />
        )}

        {scenePanelOpen && (
          <ScenePanel
            layerName={layerLabel}
            markers={layerMarkers}
            regions={layerRegions}
            zones={layerZones}
            texts={layerTexts}
            lines={layerLines}
            onPick={focusSceneItem}
            onClose={onCloseScenePanel}
          />
        )}

        {iconFilterPanelOpen && (
          <MarkerIconFilterPanel
            selected={iconFilter.selected}
            allOn={iconFilter.allOn}
            onToggle={iconFilter.toggle}
            onSelectAll={iconFilter.selectAll}
            onClearAll={iconFilter.clearAll}
            onClose={onCloseIconFilterPanel}
          />
        )}

        {saveError && (
          <div className="undo-toast save-error-toast" role="alert">
            <span>{saveError.message}</span>
            <button
              onClick={() => {
                clearTimeout(saveError.timer);
                setSaveError(null);
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {lineUndo && (
          <div className="undo-toast">
            <span>Deleted line</span>
            <button onClick={undoLineDelete}>Undo</button>
          </div>
        )}

        {textUndo && (
          <div className="undo-toast">
            <span>Deleted &ldquo;{textUndo.text.text.split("\n")[0]}&rdquo;</span>
            <button onClick={undoTextDelete}>Undo</button>
          </div>
        )}

        {zoneUndo && (
          <div className="undo-toast">
            <span>Deleted &ldquo;{zoneUndo.zone.name}&rdquo;</span>
            <button onClick={undoZoneDelete}>Undo</button>
          </div>
        )}

        {overlapChoices && (
          <div
            className="overlap-chooser"
            style={{ left: overlapChoices.x + 20, top: overlapChoices.y - 10 }}
          >
            {overlapChoices.ids.map((id) => {
              const m = markers.find((mm) => mm.id === id);
              if (!m) return null;
              return (
                <button
                  key={id}
                  onClick={() => {
                    selectMarker(id);
                    setOverlapChoices(null);
                  }}
                >
                  {m.name}
                </button>
              );
            })}
            <button onClick={() => setOverlapChoices(null)}>Cancel</button>
          </div>
        )}

        {undo && (
          <div className="undo-toast">
            <span>Deleted &ldquo;{undo.marker.name}&rdquo;</span>
            <button onClick={undoDelete}>Undo</button>
          </div>
        )}
      </div>
    </div>
  );
}
