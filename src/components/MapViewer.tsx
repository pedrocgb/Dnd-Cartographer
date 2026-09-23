"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ImageUp, RefreshCw } from "lucide-react";
import MapWorkspace from "./MapWorkspace";
import MapSidebar from "./MapSidebar";
import MapSettingsModal from "./MapSettingsModal";
import MarkersListModal from "./MarkersListModal";
import type { Marker } from "./MarkerLayer";
import type { MapGrid } from "./GridLayer";
import type { ZoneData, ZoneRegionData } from "./ZoneLayer";
import type { MapTextData } from "./TextLayer";
import type { MapLineData } from "./LineLayer";
import { useMapLayers } from "./use-map-layers";

interface MapAsset {
  id: string;
  state: "uploading" | "queued" | "processing" | "ready" | "failed" | "cancelled";
  width: number | null;
  height: number | null;
  manifestKey: string | null;
}

interface Category {
  id: string;
  label: string;
}

interface ChildMap {
  id: string;
  name: string;
}

interface Breadcrumb {
  id: string;
  name: string;
}

interface MapStatus {
  map: {
    id: string;
    name: string;
    parentId: string | null;
    categoryId: string | null;
    descriptionDocumentId: string | null;
    frameWidth: number | null;
    frameHeight: number | null;
  };
  category: Category | null;
  asset: MapAsset | null;
  job: { lastError: string | null; attempts: number } | null;
  breadcrumbs: Breadcrumb[];
  children: ChildMap[];
}

async function fetchStatus(mapId: string): Promise<MapStatus> {
  const res = await fetch(`/api/maps/${mapId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load map status.");
  return res.json();
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="loading-screen">
      <div className="loading-progress-track">
        <div className="loading-progress-bar" />
      </div>
      <p className="loading-message">{message}</p>
    </div>
  );
}

function assetLoadingMessage(asset: MapAsset, job: MapStatus["job"]): string {
  switch (asset.state) {
    case "uploading":
      return "Uploading image…";
    case "queued":
      return `Queued for processing${job ? ` (attempt ${job.attempts})` : ""}…`;
    case "processing":
      return "Preparing your map…";
    default:
      return "Loading…";
  }
}

function Breadcrumbs({ trail }: { trail: Breadcrumb[] }) {
  return (
    <nav className="map-breadcrumbs">
      <Link href="/maps">Maps</Link>
      {trail.map((entry, i) => (
        <span key={entry.id}>
          {" / "}
          {i === trail.length - 1 ? entry.name : <Link href={`/maps/${entry.id}`}>{entry.name}</Link>}
        </span>
      ))}
    </nav>
  );
}

export default function MapViewer({ mapId }: { mapId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<MapStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [markersListOpen, setMarkersListOpen] = useState(false);
  const [externalFocusMarkerId, setExternalFocusMarkerId] = useState<string | null>(null);
  const [grids, setGrids] = useState<MapGrid[]>([]);
  const [gridPanelOpen, setGridPanelOpen] = useState(false);
  const gridPatchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [zoneRegions, setZoneRegions] = useState<ZoneRegionData[]>([]);
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [zonesPanelOpen, setZonesPanelOpen] = useState(false);
  const [iconFilterPanelOpen, setIconFilterPanelOpen] = useState(false);
  const [layersPanelOpen, setLayersPanelOpen] = useState(false);
  const [textPanelOpen, setTextPanelOpen] = useState(false);
  const [texts, setTexts] = useState<MapTextData[]>([]);
  const [linePanelOpen, setLinePanelOpen] = useState(false);
  const [scenePanelOpen, setScenePanelOpen] = useState(false);
  const [selectToolOn, setSelectToolOn] = useState(false);
  /** Bumped by the sidebar's "Add marker"; MapWorkspace toggles placing like its own button. */
  const [addMarkerRequest, setAddMarkerRequest] = useState(0);
  /** Placing or editing a marker in MapWorkspace (highlights the sidebar's Markers). */
  const [markerToolActive, setMarkerToolActive] = useState(false);
  const [lines, setLines] = useState<MapLineData[]>([]);
  const layerApi = useMapLayers(mapId);
  const { activeLayerId, refresh: refreshLayers } = layerApi;
  const grid = grids.find((g) => g.layerId === activeLayerId) ?? null;

  // A ref, not a plain closure variable: `uploadImage`/`retry` need to
  // (re)start this same polling loop after the asset lifecycle restarts
  // (e.g. replacing an already-ready image), not just do a single one-off
  // fetch — a one-off fetch was the actual bug (see schedulePoll below).
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pollCancelledRef = useRef(false);

  function schedulePoll(delayMs: number) {
    clearTimeout(pollTimerRef.current);
    pollTimerRef.current = setTimeout(async () => {
      try {
        const next = await fetchStatus(mapId);
        if (pollCancelledRef.current) return;
        setStatus(next);
        setError(null);
        const state = next.asset?.state;
        if (state !== "ready" && state !== "failed" && state !== "cancelled") {
          schedulePoll(1200);
        }
      } catch (err) {
        if (!pollCancelledRef.current) setError(err instanceof Error ? err.message : String(err));
      }
    }, delayMs);
  }

  useEffect(() => {
    pollCancelledRef.current = false;
    schedulePoll(0);
    return () => {
      pollCancelledRef.current = true;
      clearTimeout(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- schedulePoll intentionally omitted: it's re-created each render but always closes over the current mapId, and only mapId changing should restart the loop.
  }, [mapId]);

  useEffect(() => {
    fetch(`/api/maps/${mapId}/markers`)
      .then((r) => r.json())
      .then((d) => setMarkers(d.markers));
    fetch(`/api/maps/${mapId}/grids`)
      .then((r) => r.json())
      .then((d) => setGrids(d.grids));
    fetch(`/api/maps/${mapId}/zone-regions`)
      .then((r) => r.json())
      .then((d) => setZoneRegions(d.regions));
    fetch(`/api/maps/${mapId}/zones`)
      .then((r) => r.json())
      .then((d) => setZones(d.zones));
    fetch(`/api/maps/${mapId}/texts`)
      .then((r) => r.json())
      .then((d) => setTexts(d.texts));
    fetch(`/api/maps/${mapId}/lines`)
      .then((r) => r.json())
      .then((d) => setLines(d.lines));
  }, [mapId]);

  async function retry() {
    if (!status?.asset) return;
    await fetch(`/api/assets/${status.asset.id}/retry`, { method: "POST" });
    schedulePoll(0);
  }

  async function refresh() {
    setStatus(await fetchStatus(mapId));
  }

  // The first image upload (empty-map prompt) fixes the frame and becomes
  // the top layer's image — reload layers once that lands.
  const hasFrame = Boolean(status?.map.frameWidth && status?.map.frameHeight);
  useEffect(() => {
    if (hasFrame) void refreshLayers();
  }, [hasFrame, refreshLayers]);

  /** First image of an empty map; later images are managed per layer in the Layers panel. */
  async function uploadImage(file: File) {
    setUploading(true);
    const res = await fetch(`/api/maps/${mapId}/assets`, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    setUploading(false);
    if (res.ok) schedulePoll(0);
    else window.alert((await res.json()).error ?? "Upload failed.");
  }

  async function removeMap(strategy?: "cascade" | "orphan") {
    if (!status) return;
    setDeleteError(null);
    const res = await fetch(`/api/maps/${mapId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(strategy ? { strategy } : {}),
    });
    if (res.status === 409) {
      const data = await res.json();
      const choice = window.confirm(
        `"${status.map.name}" has ${data.childCount} child map(s). OK to move them to the root (Cancel to delete the whole subtree instead).`
      );
      await removeMap(choice ? "orphan" : "cascade");
      return;
    }
    if (!res.ok) {
      setDeleteError("Failed to delete map.");
      return;
    }
    router.push("/maps");
  }

  function onDeleteMap() {
    if (window.confirm("Delete this map? This can be undone from the Trash page.")) removeMap();
  }

  function closeToolPanels() {
    setGridPanelOpen(false);
    setZonesPanelOpen(false);
    setIconFilterPanelOpen(false);
    setLayersPanelOpen(false);
    setTextPanelOpen(false);
    setLinePanelOpen(false);
    setScenePanelOpen(false);
    setSelectToolOn(false);
  }

  async function onOpenGrid() {
    closeToolPanels();
    if (!grid && activeLayerId) {
      const res = await fetch(`/api/layers/${activeLayerId}/grid`, { method: "POST" });
      const data: { grid?: MapGrid } = await res.json();
      if (data.grid) setGrids((prev) => [...prev.filter((g) => g.layerId !== activeLayerId), data.grid!]);
    }
    setGridPanelOpen(true);
  }

  function onOpenZones() {
    closeToolPanels();
    setZonesPanelOpen(true);
  }

  function onOpenIconFilter() {
    closeToolPanels();
    setIconFilterPanelOpen(true);
  }

  function onOpenLayers() {
    closeToolPanels();
    setLayersPanelOpen(true);
  }

  function onOpenText() {
    closeToolPanels();
    setTextPanelOpen(true);
  }

  function onOpenLines() {
    closeToolPanels();
    setLinePanelOpen(true);
  }

  function onOpenScene() {
    closeToolPanels();
    setScenePanelOpen(true);
  }

  /** The Selection tool has no side panel; it is exclusive with the tool panels all the same. */
  function onToggleSelectTool() {
    const next = !selectToolOn;
    closeToolPanels();
    setSelectToolOn(next);
  }

  // Switching layers swaps the grid (and zones), so a grid panel left open
  // would edit the wrong layer's grid — close it.
  function setActiveLayer(id: string) {
    if (id !== activeLayerId) setGridPanelOpen(false);
    layerApi.setActiveLayerId(id);
  }

  function updateGrid(patch: Partial<MapGrid>) {
    const layerId = activeLayerId;
    if (!layerId) return;
    setGrids((prev) => prev.map((g) => (g.layerId === layerId ? { ...g, ...patch } : g)));
    // Sliders fire on every drag tick — updating local state immediately
    // keeps the on-map preview instant, but debounce the actual save so
    // dragging a slider doesn't fire a PATCH per pixel of movement.
    clearTimeout(gridPatchTimerRef.current);
    gridPatchTimerRef.current = setTimeout(() => {
      fetch(`/api/layers/${layerId}/grid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    }, 250);
  }

  function deleteGrid() {
    const layerId = activeLayerId;
    if (!layerId) return;
    setGrids((prev) => prev.filter((g) => g.layerId !== layerId));
    setGridPanelOpen(false);
    clearTimeout(gridPatchTimerRef.current);
    fetch(`/api/layers/${layerId}/grid`, { method: "DELETE" });
  }

  async function deleteLayer(id: string) {
    const layer = layerApi.layers.find((l) => l.id === id);
    if (!layer || !window.confirm(`Delete layer "${layer.name}"?`)) return;
    let res = await layerApi.deleteLayer(id, false);
    if (res.status === 409) {
      const data: { markerCount?: number; regionCount?: number; textCount?: number; lineCount?: number; hasGrid?: boolean; error?: string } = await res.json();
      if (data.markerCount === undefined) {
        window.alert(data.error ?? "This layer can't be deleted.");
        return;
      }
      const parts = [
        data.markerCount ? `${data.markerCount} marker(s)` : null,
        data.regionCount ? `${data.regionCount} zone region(s)` : null,
        data.textCount ? `${data.textCount} text(s)` : null,
        data.lineCount ? `${data.lineCount} line(s)` : null,
        data.hasGrid ? "a grid" : null,
      ].filter(Boolean);
      if (!window.confirm(`"${layer.name}" still has ${parts.join(", ")}. Delete the layer and all of it?`)) return;
      res = await layerApi.deleteLayer(id, true);
    }
    if (!res.ok) {
      window.alert("Failed to delete layer.");
      return;
    }
    const regionIds = new Set(zoneRegions.filter((r) => r.layerId === id).map((r) => r.id));
    setMarkers((prev) => prev.filter((m) => m.layerId !== id));
    setZones((prev) => prev.filter((z) => !regionIds.has(z.regionId)));
    setZoneRegions((prev) => prev.filter((r) => r.layerId !== id));
    setGrids((prev) => prev.filter((g) => g.layerId !== id));
    setTexts((prev) => prev.filter((t) => t.layerId !== id));
    setLines((prev) => prev.filter((l) => l.layerId !== id));
  }

  if (error) return <div className="map-status">Error: {error}</div>;
  if (!status) return <LoadingScreen message="Loading map…" />;

  const { asset, job } = status;

  return (
    <div className="map-page-root">
      <Breadcrumbs trail={status.breadcrumbs} />
      {deleteError && <p className="form-error">{deleteError}</p>}

      {status.children.length > 0 && (
        <div className="map-children-panel">
          {status.children.map((child) => (
            <Link key={child.id} href={`/maps/${child.id}`} className="map-child-card">
              {child.name}
            </Link>
          ))}
        </div>
      )}

      <div className="map-page-body">
        <MapSidebar
          layersDisabled={!hasFrame}
          textDisabled={!hasFrame}
          linesDisabled={!hasFrame}
          sceneDisabled={!hasFrame}
          markersDisabled={!hasFrame}
          gridDisabled={!hasFrame}
          zonesDisabled={!hasFrame}
          iconFilterDisabled={!hasFrame}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenMarkers={() => setMarkersListOpen(true)}
          onOpenGrid={onOpenGrid}
          onOpenZones={onOpenZones}
          onOpenIconFilter={onOpenIconFilter}
          onOpenLayers={onOpenLayers}
          onOpenText={onOpenText}
          onOpenLines={onOpenLines}
          onOpenScene={onOpenScene}
          selectToolOn={selectToolOn}
          activeTool={
            selectToolOn
              ? "select"
              : scenePanelOpen
                ? "scene"
                : layersPanelOpen
                  ? "layers"
                  : zonesPanelOpen
                    ? "zones"
                    : linePanelOpen
                      ? "lines"
                      : textPanelOpen
                        ? "text"
                        : gridPanelOpen
                          ? "grid"
                          : settingsOpen
                            ? "settings"
                            : iconFilterPanelOpen || markersListOpen || markerToolActive
                              ? "markers"
                              : null
          }
          onToggleSelectTool={onToggleSelectTool}
          onOpenMarkersMenu={closeToolPanels}
          onAddMarker={() => setAddMarkerRequest((n) => n + 1)}
          onDeleteMap={onDeleteMap}
        />

        {!asset && !hasFrame && (
          <div className="map-status">
            <p>No image uploaded yet for &ldquo;{status.map.name}&rdquo;.</p>
            <label className="btn btn-primary" style={{ cursor: uploading ? "default" : "pointer" }}>
              <ImageUp size={15} strokeWidth={2.25} />
              {uploading ? "Uploading…" : "Upload image"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: "none" }}
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void uploadImage(file);
                }}
              />
            </label>
          </div>
        )}

        {hasFrame && activeLayerId && (
          <div className="spike-root">
            <MapWorkspace
              mapId={mapId}
              layerApi={layerApi}
              activeLayerId={activeLayerId}
              onSetActiveLayer={setActiveLayer}
              layersPanelOpen={layersPanelOpen}
              onCloseLayersPanel={() => setLayersPanelOpen(false)}
              onDeleteLayer={deleteLayer}
              texts={texts}
              setTexts={setTexts}
              textPanelOpen={textPanelOpen}
              onCloseTextPanel={() => setTextPanelOpen(false)}
              lines={lines}
              setLines={setLines}
              linePanelOpen={linePanelOpen}
              onCloseLinePanel={() => setLinePanelOpen(false)}
              scenePanelOpen={scenePanelOpen}
              onCloseScenePanel={() => setScenePanelOpen(false)}
              selectToolOn={selectToolOn}
              onCloseSelectTool={() => setSelectToolOn(false)}
              addMarkerRequest={addMarkerRequest}
              onMarkerToolChange={setMarkerToolActive}
              onOpenZonesPanel={onOpenZones}
              onOpenTextPanel={onOpenText}
              onOpenLinePanel={onOpenLines}
              markers={markers}
              setMarkers={setMarkers}
              externalFocusMarkerId={externalFocusMarkerId}
              onExternalFocusHandled={() => setExternalFocusMarkerId(null)}
              grid={grid}
              gridPanelOpen={gridPanelOpen}
              onCloseGridPanel={() => setGridPanelOpen(false)}
              onUpdateGrid={updateGrid}
              onDeleteGrid={deleteGrid}
              zoneRegions={zoneRegions}
              setZoneRegions={setZoneRegions}
              zones={zones}
              setZones={setZones}
              zonesPanelOpen={zonesPanelOpen}
              onCloseZonesPanel={() => setZonesPanelOpen(false)}
              iconFilterPanelOpen={iconFilterPanelOpen}
              onCloseIconFilterPanel={() => setIconFilterPanelOpen(false)}
              imageWidth={status.map.frameWidth ?? 1}
              imageHeight={status.map.frameHeight ?? 1}
            />
          </div>
        )}

        {!hasFrame && asset && asset.state === "failed" && (
          <div className="map-status">
            <p>Processing failed{job?.lastError ? `: ${job.lastError}` : "."}</p>
            <button className="btn btn-primary" onClick={retry}>
              <RefreshCw size={15} strokeWidth={2.25} />
              Retry
            </button>
          </div>
        )}

        {!hasFrame && asset && !["ready", "failed"].includes(asset.state) && (
          <LoadingScreen message={assetLoadingMessage(asset, job)} />
        )}
      </div>

      <MapSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        status={status}
        mapId={mapId}
        onChanged={refresh}
      />
      <MarkersListModal
        open={markersListOpen}
        onClose={() => setMarkersListOpen(false)}
        markers={markers}
        layers={layerApi.layers}
        onSelect={(id) => {
          const layerId = markers.find((m) => m.id === id)?.layerId;
          if (layerId) setActiveLayer(layerId);
          setExternalFocusMarkerId(id);
        }}
      />
    </div>
  );
}
