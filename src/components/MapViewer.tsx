"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ImageUp, RefreshCw } from "lucide-react";
import MapWorkspace from "./MapWorkspace";
import MapSidebar from "./MapSidebar";
import MapSettingsModal from "./MapSettingsModal";
import DeleteMapDialog from "./maps/DeleteMapDialog";
import MapHeader from "./maps/MapHeader";
import type { Marker } from "./MarkerLayer";
import type { MapGrid } from "./GridLayer";
import type { ZoneData, ZoneRegionData } from "./ZoneLayer";
import type { MapTextData } from "./TextLayer";
import type { LineGroupData, MapLineData } from "./LineLayer";
import type { MapFolderData } from "./LayerFolders";
import { useMapLayers } from "./use-map-layers";
import { MapPageSkeleton, Skeleton, SkeletonRegion } from "./Skeleton";

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

export default function MapViewer({ mapId }: { mapId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<MapStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  // The map whose markers, zones, texts, lines and grids have arrived (the tool panels show skeletons until then).
  const [itemsLoadedFor, setItemsLoadedFor] = useState<string | null>(null);
  const itemsLoaded = itemsLoadedFor === mapId;
  const [uploading, setUploading] = useState(false);
  const [deletingMap, setDeletingMap] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [externalFocusMarkerId, setExternalFocusMarkerId] = useState<string | null>(null);
  const [grids, setGrids] = useState<MapGrid[]>([]);
  const [gridPanelOpen, setGridPanelOpen] = useState(false);
  const gridPatchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [zoneRegions, setZoneRegions] = useState<ZoneRegionData[]>([]);
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [zonesPanelOpen, setZonesPanelOpen] = useState(false);
  const [markersPanelOpen, setMarkersPanelOpen] = useState(false);
  const [layersPanelOpen, setLayersPanelOpen] = useState(false);
  const [textPanelOpen, setTextPanelOpen] = useState(false);
  const [texts, setTexts] = useState<MapTextData[]>([]);
  const [linePanelOpen, setLinePanelOpen] = useState(false);
  const [scenePanelOpen, setScenePanelOpen] = useState(false);
  const [legendPanelOpen, setLegendPanelOpen] = useState(false);
  const [scalePanelOpen, setScalePanelOpen] = useState(false);
  const [areaPanelOpen, setAreaPanelOpen] = useState(false);
  const [travelPanelOpen, setTravelPanelOpen] = useState(false);
  const [selectToolOn, setSelectToolOn] = useState(false);
  /** Placing or editing a marker in MapWorkspace (highlights the sidebar's Markers). */
  const [markerToolActive, setMarkerToolActive] = useState(false);
  const [lines, setLines] = useState<MapLineData[]>([]);
  const [lineGroups, setLineGroups] = useState<LineGroupData[]>([]);
  const [textGroups, setTextGroups] = useState<MapFolderData[]>([]);
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

  /** Everything placed on the map (reloaded after the frame grows, which rewrites their coordinates). */
  function loadItems() {
    return Promise.all([
      fetch(`/api/maps/${mapId}/markers`)
        .then((r) => r.json())
        .then((d) => setMarkers(d.markers)),
      fetch(`/api/maps/${mapId}/grids`)
        .then((r) => r.json())
        .then((d) => setGrids(d.grids)),
      fetch(`/api/maps/${mapId}/zone-regions`)
        .then((r) => r.json())
        .then((d) => setZoneRegions(d.regions)),
      fetch(`/api/maps/${mapId}/zones`)
        .then((r) => r.json())
        .then((d) => setZones(d.zones)),
      fetch(`/api/maps/${mapId}/texts`)
        .then((r) => r.json())
        .then((d) => setTexts(d.texts)),
      fetch(`/api/maps/${mapId}/lines`)
        .then((r) => r.json())
        .then((d) => setLines(d.lines)),
      fetch(`/api/maps/${mapId}/line-groups`)
        .then((r) => r.json())
        .then((d) => setLineGroups(d.groups)),
      fetch(`/api/maps/${mapId}/text-groups`)
        .then((r) => r.json())
        .then((d) => setTextGroups(d.groups)),
    ]);
  }

  useEffect(() => {
    void loadItems()
      .catch(() => {}) // a failed list just stays empty, as before
      .then(() => setItemsLoadedFor(mapId));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadItems is re-created each render but always closes over the current mapId.
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

  /**
   * The frame (where the grid and every item can go) grows to cover every
   * layer image; the server shifts all stored coordinates with it, so the
   * map reloads them when it did.
   */
  async function fitFrame() {
    await layerApi.flushPatches();
    const res = await fetch(`/api/maps/${mapId}/fit-frame`, { method: "POST" });
    if (!res.ok) return;
    const data: { frame: { width: number; height: number } | null } = await res.json();
    if (!data.frame) return;
    await Promise.all([refresh(), refreshLayers()]);
    loadItems();
  }

  // On open and whenever a layer's image changes (a new upload starts at the
  // frame's width, so a taller one reaches below it).
  const fitFrameRef = useRef(fitFrame);
  useEffect(() => {
    fitFrameRef.current = fitFrame;
  });
  const layerAssetKey = layerApi.layers.map((l) => l.asset?.id ?? "").join(",");
  useEffect(() => {
    if (hasFrame && layerAssetKey.replaceAll(",", "")) void fitFrameRef.current();
  }, [hasFrame, layerAssetKey]);

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

  function closeToolPanels() {
    setGridPanelOpen(false);
    setZonesPanelOpen(false);
    setMarkersPanelOpen(false);
    setLayersPanelOpen(false);
    setTextPanelOpen(false);
    setLinePanelOpen(false);
    setScenePanelOpen(false);
    setLegendPanelOpen(false);
    setScalePanelOpen(false);
    setAreaPanelOpen(false);
    setTravelPanelOpen(false);
    setSelectToolOn(false);
  }

  async function onOpenGrid() {
    closeToolPanels();
    // Open at once (a skeleton until the layer's grid exists); the request returns the grid if it already does.
    setGridPanelOpen(true);
    if (!grid && activeLayerId) {
      const res = await fetch(`/api/layers/${activeLayerId}/grid`, { method: "POST" });
      const data: { grid?: MapGrid } = await res.json();
      if (data.grid) setGrids((prev) => [...prev.filter((g) => g.layerId !== activeLayerId), data.grid!]);
    }
  }

  function onOpenZones() {
    closeToolPanels();
    setZonesPanelOpen(true);
  }

  function onOpenMarkers() {
    closeToolPanels();
    setMarkersPanelOpen(true);
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

  function onOpenLegend() {
    closeToolPanels();
    setLegendPanelOpen(true);
  }

  function onOpenScale() {
    closeToolPanels();
    setScalePanelOpen(true);
  }

  function onOpenArea() {
    closeToolPanels();
    setAreaPanelOpen(true);
  }

  function onOpenTravel() {
    closeToolPanels();
    setTravelPanelOpen(true);
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

  function onOpenSelectTool() {
    closeToolPanels();
    setSelectToolOn(true);
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
      const data: { markerCount?: number; regionCount?: number; textCount?: number; lineCount?: number; hasGrid?: boolean; hasLegend?: boolean; routeCount?: number; error?: string } = await res.json();
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
        data.hasLegend ? "a legend" : null,
        data.routeCount ? `${data.routeCount} route${data.routeCount === 1 ? "" : "s"}` : null,
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
    setLineGroups((prev) => prev.filter((g) => g.layerId !== id));
    setTextGroups((prev) => prev.filter((g) => g.layerId !== id));
  }

  if (error) return <div className="map-status">Error: {error}</div>;
  if (!status) return <MapPageSkeleton />;

  const { asset, job } = status;

  return (
    <div className="map-page-root">
      <MapHeader trail={status.breadcrumbs} category={status.category?.label ?? null} childMaps={status.children} />

      <div className="map-page-body">
        <MapSidebar
          layersDisabled={!hasFrame}
          textDisabled={!hasFrame}
          linesDisabled={!hasFrame}
          sceneDisabled={!hasFrame}
          markersDisabled={!hasFrame}
          gridDisabled={!hasFrame}
          zonesDisabled={!hasFrame}
          legendDisabled={!hasFrame}
          scaleDisabled={!hasFrame}
          onOpenLegend={onOpenLegend}
          onOpenScale={onOpenScale}
          areaDisabled={!hasFrame}
          onOpenArea={onOpenArea}
          travelDisabled={!hasFrame}
          onOpenTravel={onOpenTravel}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenMarkers={onOpenMarkers}
          onOpenGrid={onOpenGrid}
          onOpenZones={onOpenZones}
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
                          : legendPanelOpen
                            ? "legend"
                            : scalePanelOpen
                              ? "scale"
                              : areaPanelOpen
                                ? "area"
                              : travelPanelOpen
                                ? "travel"
                          : settingsOpen
                            ? "settings"
                            : markersPanelOpen || markerToolActive
                              ? "markers"
                              : null
          }
          onToggleSelectTool={onToggleSelectTool}
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

        {hasFrame && !activeLayerId && (
          <SkeletonRegion label="Loading the map…" className="map-skeleton-canvas-region">
            <Skeleton className="map-skeleton-canvas" height="auto" radius={0} />
          </SkeletonRegion>
        )}

        {hasFrame && activeLayerId && (
          <div className="spike-root">
            <MapWorkspace
              // A grown frame rewrote every stored coordinate: start over (undo history included).
              key={`${status.map.frameWidth}x${status.map.frameHeight}`}
              mapId={mapId}
              itemsLoaded={itemsLoaded}
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
              lineGroups={lineGroups}
              setLineGroups={setLineGroups}
              textGroups={textGroups}
              setTextGroups={setTextGroups}
              linePanelOpen={linePanelOpen}
              onCloseLinePanel={() => setLinePanelOpen(false)}
              scenePanelOpen={scenePanelOpen}
              onCloseScenePanel={() => setScenePanelOpen(false)}
              selectToolOn={selectToolOn}
              onOpenSelectTool={onOpenSelectTool}
              onCloseSelectTool={() => setSelectToolOn(false)}
              onMarkerToolChange={setMarkerToolActive}
              onOpenZonesPanel={onOpenZones}
              onOpenTextPanel={onOpenText}
              onOpenLinePanel={onOpenLines}
              markers={markers}
              setMarkers={setMarkers}
              externalFocusMarkerId={externalFocusMarkerId}
              onExternalFocusHandled={() => setExternalFocusMarkerId(null)}
              onFocusMarker={(id) => {
                const layerId = markers.find((m) => m.id === id)?.layerId;
                if (layerId) setActiveLayer(layerId);
                setExternalFocusMarkerId(id);
              }}
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
              markersPanelOpen={markersPanelOpen}
              onCloseMarkersPanel={() => setMarkersPanelOpen(false)}
              legendPanelOpen={legendPanelOpen}
              onCloseLegendPanel={() => setLegendPanelOpen(false)}
              scalePanelOpen={scalePanelOpen}
              onCloseScalePanel={() => setScalePanelOpen(false)}
              areaPanelOpen={areaPanelOpen}
              onCloseAreaPanel={() => setAreaPanelOpen(false)}
              travelPanelOpen={travelPanelOpen}
              onCloseTravelPanel={() => setTravelPanelOpen(false)}
              onOpenTravelPanel={onOpenTravel}
              onOpenScalePanel={onOpenScale}
              onFitFrame={() => void fitFrame()}
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

      {deletingMap && (
        <DeleteMapDialog
          map={{ id: mapId, name: status.map.name }}
          childCount={status.children.length}
          onCancel={() => setDeletingMap(false)}
          onDeleted={() => router.push("/maps")}
        />
      )}
      <MapSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        status={status}
        mapId={mapId}
        onChanged={refresh}
        onDelete={() => {
          setSettingsOpen(false);
          setDeletingMap(true);
        }}
      />
    </div>
  );
}
