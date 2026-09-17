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
import { patchOverlayPositioning } from "./osd-overlay-position-fix";
import {
  DEFAULT_ICON_KEY,
  DEFAULT_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_OUTLINE_COLOR,
  DEFAULT_BACKGROUND_SHAPE,
} from "@/server/markers/icon-registry";

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

  // Crosshair while armed to place a marker — imperative, since OpenSeadragon
  // sets its own inline cursor styling on this element that a plain CSS class
  // would have to fight for specificity.
  useEffect(() => {
    if (viewerElRef.current) viewerElRef.current.style.cursor = addingMarker ? "crosshair" : "";
  }, [addingMarker]);

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
  function selectMarker(markerId: string, opts?: { startInEdit?: boolean }) {
    setSelectedMarkerId(markerId);
    setMarkerSection("basic");
    setAutoFocusName(false);
    setStartInEdit(Boolean(opts?.startInEdit));
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
        setMarkers((prev) => [...prev, d.marker]);
        setSelectedMarkerId(d.marker.id);
        setAutoFocusName(true);
        setStartInEdit(true);
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

  const selectedMarker = markers.find((m) => m.id === selectedMarkerId) ?? null;

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

        <div className={selectedMarker ? "viewer-toolbar-left panel-open" : "viewer-toolbar-left"}>
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

        <MarkerLayer
          viewer={viewer}
          osd={osd}
          markers={markers}
          addingMarker={addingMarker}
          onPlaceMarker={placeMarker}
          onSelectMarker={(id) => selectMarker(id)}
          onEditMarker={(id) => selectMarker(id, { startInEdit: true })}
          onOverlapChoice={(ids, point) => setOverlapChoices({ ids, x: point.x, y: point.y })}
          onMoveMarker={moveMarker}
          selectedMarkerId={selectedMarkerId}
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
