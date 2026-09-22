"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin, ZoomIn, ZoomOut, Home, Maximize } from "lucide-react";
import type OpenSeadragonType from "openseadragon";
import MarkerLayer, { type Marker } from "./MarkerLayer";
import MarkerPanel, { type MarkerSection } from "./MarkerPanel";
import MarkerSectionStrip from "./MarkerSectionStrip";
import GridLayer, { type MapGrid } from "./GridLayer";
import GridPanel from "./GridPanel";
import ZoneLayer, { type ZoneData, type ZoneRegionData, type ZoneTool } from "./ZoneLayer";
import ZonesPanel from "./ZonesPanel";
import MarkerIconFilterPanel from "./MarkerIconFilterPanel";
import { useToggleSet } from "./useToggleSet";
import { patchOverlayPositioning } from "./osd-overlay-position-fix";
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

export default function MapWorkspace({
  mapId,
  assetId,
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
  assetId: string;
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
  const [zoneUndo, setZoneUndo] = useState<{ zone: ZoneData; timer: ReturnType<typeof setTimeout> } | null>(null);
  const zonePatchTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const iconFilter = useToggleSet(ICON_UNIVERSE);
  const lastChoiceRef = useRef({
    iconKey: DEFAULT_ICON_KEY,
    color: DEFAULT_COLOR,
    backgroundColor: DEFAULT_BACKGROUND_COLOR,
    outlineColor: DEFAULT_OUTLINE_COLOR,
    backgroundShape: DEFAULT_BACKGROUND_SHAPE as string,
  });
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
        tileSources: `/api/tiles/${assetId}/manifest.dzi`,
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
    });

    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
      setViewer(null);
    };
  }, [assetId]);

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
    viewerElRef.current.style.cursor = addingMarker
      ? "crosshair"
      : zonesPanelOpen && activeZoneTool !== "select"
        ? ZONE_DRAW_CURSOR
        : "";
  }, [addingMarker, zonesPanelOpen, activeZoneTool]);

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

  function placeMarker(u: number, v: number) {
    setAddingMarker(false);
    fetch(`/api/maps/${mapId}/markers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New marker", u, v, ...lastChoiceRef.current }),
    })
      .then((r) => json<{ marker: Marker }>(r))
      .then((d) => {
        closeToolPanels();
        setMarkers((prev) => [...prev, d.marker]);
        setSelectedMarkerId(d.marker.id);
        setAutoFocusName(true);
        setStartInEdit(true);
        ensureIconVisible(d.marker.iconKey);
      });
  }

  function moveMarker(markerId: string, u: number, v: number) {
    setMarkers((prev) => prev.map((m) => (m.id === markerId ? { ...m, u, v } : m)));
    fetch(`/api/markers/${markerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ u, v }),
    });
  }

  function updateMarker(markerId: string, patch: Partial<Marker>) {
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
        setSelectedMarkerId(d.marker.id);
      });
  }

  function deleteMarker(markerId: string) {
    const marker = markers.find((m) => m.id === markerId);
    if (!marker) return;
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
  if (zonesPanelOpen && !activeZoneRegionId && zoneRegions.length > 0) {
    setActiveZoneRegionId([...zoneRegions].sort((a, b) => a.sortOrder - b.sortOrder)[0].id);
  }

  // Only one lateral tool is ever open at a time — the reverse direction of
  // closeToolPanels() above: opening Grid/Zones/Filter deselects any open
  // marker instead of showing both side by side.
  const anyToolPanelOpen = gridPanelOpen || zonesPanelOpen || iconFilterPanelOpen;
  const [lastAnyToolPanelOpen, setLastAnyToolPanelOpen] = useState(anyToolPanelOpen);
  if (anyToolPanelOpen !== lastAnyToolPanelOpen) {
    setLastAnyToolPanelOpen(anyToolPanelOpen);
    if (anyToolPanelOpen) setSelectedMarkerId(null);
  }

  function createZoneRegion(name: string) {
    fetch(`/api/maps/${mapId}/zone-regions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
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

  function createZone(regionId: string, shapeType: ZoneTool, geometry: object) {
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
        setSelectedZoneId(d.zone.id);
        setActiveZoneTool("select");
      });
  }

  function updateZone(id: string, patch: Partial<ZoneData>) {
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, ...patch } : z)));
    const timers = zonePatchTimersRef.current;
    clearTimeout(timers.get(id));
    // Color-wheel drags and opacity/width sliders fire on every pointer
    // move; debounce the network write the same way grid slider edits are
    // debounced, while geometry commits (one call per completed gesture)
    // go straight through.
    const send = () => {
      const body: Record<string, unknown> = { ...patch };
      if ("geometry" in patch) {
        body.imageWidth = imageWidth;
        body.imageHeight = imageHeight;
      }
      fetch(`/api/zones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    };
    if ("geometry" in patch) send();
    else timers.set(id, setTimeout(send, 250));
  }

  function deleteZone(id: string) {
    const zone = zones.find((z) => z.id === id);
    if (!zone) return;
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

  const selectedMarker = markers.find((m) => m.id === selectedMarkerId) ?? null;
  // Filtering only ever changes what's rendered on the map — selection,
  // editing, and every other marker feature keep using the full `markers`
  // array untouched.
  const visibleMarkers = iconFilter.allOn ? markers : markers.filter((m) => iconFilter.selected.has(m.iconKey));

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
          style={{ left: 12 + (selectedMarker || gridPanelOpen || zonesPanelOpen || iconFilterPanelOpen ? 320 : 0) }}
        >
          <button
            className={addingMarker ? "btn active" : "btn"}
            onClick={() => setAddingMarker((a) => !a)}
          >
            <MapPin size={15} strokeWidth={2.25} />
            {addingMarker ? "Click the map…" : "Add marker"}
          </button>

          <div className="viewer-nav-controls">
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
              onClick={() => viewer && viewer.setFullPage(!viewer.isFullPage())}
              aria-label="Toggle fullscreen"
              title="Toggle fullscreen"
            >
              <Maximize size={16} strokeWidth={2.25} />
            </button>
          </div>
        </div>

        <GridLayer viewer={viewer} osd={osd} grid={grid} />

        <ZoneLayer
          viewer={viewer}
          osd={osd}
          authoring={zonesPanelOpen}
          regions={zoneRegions}
          zones={zones}
          activeTool={activeZoneTool}
          activeRegionId={activeZoneRegionId}
          selectedZoneId={selectedZoneId}
          onSelectZone={setSelectedZoneId}
          onCreateZone={createZone}
          onUpdateZoneGeometry={(zoneId, geometry) => updateZone(zoneId, { geometry: JSON.stringify(geometry) })}
        />

        <MarkerLayer
          viewer={viewer}
          osd={osd}
          markers={visibleMarkers}
          addingMarker={addingMarker}
          onPlaceMarker={placeMarker}
          onSelectMarker={(id) => selectMarker(id)}
          onEditMarker={(id) => selectMarker(id, { startInEdit: true })}
          onOverlapChoice={(ids, point) => setOverlapChoices({ ids, x: point.x, y: point.y })}
          onMoveMarker={moveMarker}
          selectedMarkerId={selectedMarkerId}
          interactive={!(zonesPanelOpen && (activeZoneTool !== "select" || selectedZoneId !== null))}
        />

        {gridPanelOpen && grid && (
          <GridPanel
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
            regions={zoneRegions}
            zones={zones}
            activeRegionId={activeZoneRegionId}
            selectedZoneId={selectedZoneId}
            activeTool={activeZoneTool}
            onSetActiveRegion={setActiveZoneRegionId}
            onSetActiveTool={setActiveZoneTool}
            onSelectZone={setSelectedZoneId}
            onCreateRegion={createZoneRegion}
            onUpdateRegion={updateZoneRegion}
            onDeleteRegion={deleteZoneRegion}
            onUpdateZone={updateZone}
            onDeleteZone={deleteZone}
            onClose={onCloseZonesPanel}
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
