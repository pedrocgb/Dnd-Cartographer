"use client";

import { useEffect, useState } from "react";
import type OpenSeadragonType from "openseadragon";
import type { MapLayerData } from "@/components/layer-images";
import type { ClientLegend } from "@/server/legends/legend-config";
import MapLegend from "./MapLegend";
import MapScaleBar from "./MapScaleBar";
import MeasureLayer, { type MeasureMode } from "./MeasureLayer";
import LegendPanel from "./LegendPanel";
import ScalePanel from "./ScalePanel";
import TravelPanel, { routeLabel, useTravelDraft } from "./TravelPanel";
import RouteLayer from "./RouteLayer";
import type { RouteControls } from "./use-map-routes";
import { isModalOpen } from "@/components/Modal";
import { isTypingTarget } from "@/components/keyboard";
import { formatDuration, planTravel, unitToMiles, type TravelSettings } from "@/server/travel/travel";
import { DEFAULT_ROUTE_STYLE, sanitizeRouteStyle, type MapRouteData, type RoutePt, type RouteStyle } from "@/server/travel/route-config";
import { LandPlot, LayoutList, Route, Ruler } from "lucide-react";
import AreaLayer, { type AreaTool, type MeasuredShape } from "./AreaLayer";
import AreaPanel from "./AreaPanel";
import { PanelSkeleton } from "../Skeleton";
import { useMapLegends } from "./use-map-legends";
import type { MapScaleBarApi } from "./use-map-scale-bar";

/** The legend shown on `layerId`: its own, else one set to also show there (visible ones only). */
export function legendForLayer(legends: ClientLegend[], layerId: string): ClientLegend | null {
  const visible = legends.filter((l) => l.visible);
  return visible.find((l) => l.layerId === layerId) ?? visible.find((l) => l.extraLayerIds.includes(layerId)) ?? null;
}

const pathLength = (pts: readonly RoutePt[]) => pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);

/**
 * Everything pinned over the map window rather than drawn on the map: the
 * active layer's legend, the scale bar, saved travel routes, the
 * measure/calibrate/route-drawing overlay, and the Legend, Scale and Travel
 * tool panels that edit them.
 */
export default function MapHud({
  mapId,
  viewer,
  osd,
  layers,
  activeLayerId,
  layerName,
  area,
  inset,
  legendPanelOpen,
  onCloseLegendPanel,
  scalePanelOpen,
  onCloseScalePanel,
  areaPanelOpen,
  onCloseAreaPanel,
  scale,
  travelPanelOpen,
  onCloseTravelPanel,
  onOpenScalePanel,
  routes,
  pulseId,
  onRouteDrawingChange,
}: {
  mapId: string;
  viewer: OpenSeadragonType.Viewer | null;
  osd: typeof OpenSeadragonType | null;
  layers: MapLayerData[];
  activeLayerId: string;
  layerName: string;
  area: HTMLElement | null;
  inset: number;
  legendPanelOpen: boolean;
  onCloseLegendPanel: () => void;
  scalePanelOpen: boolean;
  onCloseScalePanel: () => void;
  areaPanelOpen: boolean;
  onCloseAreaPanel: () => void;
  /** The map's scale bar (MapWorkspace owns it: the Zones panel reads zone areas through it too). */
  scale: MapScaleBarApi;
  travelPanelOpen: boolean;
  onCloseTravelPanel: () => void;
  onOpenScalePanel: () => void;
  routes: RouteControls;
  /** The item just picked in the Scene panel, briefly pulsed. */
  pulseId: string | null;
  /** Tells the workspace whether a route is being drawn (it keeps Ctrl+Z out of the way then). */
  onRouteDrawingChange: (drawing: boolean) => void;
}) {
  const legendApi = useMapLegends(mapId);
  const { scaleBar, loaded: scaleLoaded, update: updateScale, error: scaleError } = scale;
  // The Area tool: shapes measured while its panel is open (never saved).
  const [areaTool, setAreaTool] = useState<AreaTool>("polygon");
  const [areaShapes, setAreaShapes] = useState<MeasuredShape[]>([]);
  const [areaSelectedId, setAreaSelectedId] = useState<string | null>(null);
  if (!areaPanelOpen && areaShapes.length > 0) {
    setAreaShapes([]);
    setAreaSelectedId(null);
  }
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [measureMode, setMeasureMode] = useState<MeasureMode | null>(null);
  // The ruler belongs to the Scale panel: closing it ends measuring.
  if (!scalePanelOpen && measureMode) setMeasureMode(null);
  const layerVisible = layers.find((l) => l.id === activeLayerId)?.visible ?? true;
  const [draft, setDraft] = useTravelDraft();
  const [drawingRoute, setDrawingRoute] = useState(false);
  const [redrawingId, setRedrawingId] = useState<string | null>(null);
  const [livePx, setLivePx] = useState(0);
  // Drawing belongs to the Travel panel: closing it stops.
  if (!travelPanelOpen && (drawingRoute || redrawingId)) {
    setDrawingRoute(false);
    setRedrawingId(null);
  }
  const ppu = scaleBar.config.framePxPerUnit;
  const milesOf = (framePx: number, settings: TravelSettings) => (ppu ? (framePx / ppu) * unitToMiles(scaleBar.config.unit, settings) : 0);
  const planOf = (route: MapRouteData) => planTravel(milesOf(pathLength(route.points), route.settings), route.settings);
  const layerRoutes = routes.routes;
  const selectedRouteId = routes.sel.single;
  // Redrawing belongs to the selected route: picking another one (or none) stops it.
  if (redrawingId && redrawingId !== selectedRouteId) setRedrawingId(null);
  const drawnRoutes = routes.drawn.filter((r) => r.id !== redrawingId);
  const activeGroup = routes.groups.find((g) => g.id === routes.activeGroupId);
  const drawGroupId = activeGroup?.id ?? null;
  const drawingDraft = drawingRoute || redrawingId !== null;
  const drawSettings = (redrawingId && layerRoutes.find((r) => r.id === redrawingId)?.settings) || draft.settings;
  useEffect(() => {
    onRouteDrawingChange(drawingDraft);
  }, [drawingDraft, onRouteDrawingChange]);
  // Esc with no point placed yet stops drawing (with points, the drawing layer clears them first).
  useEffect(() => {
    if (!drawingDraft) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || isModalOpen() || isTypingTarget(e.target)) return;
      e.preventDefault();
      setDrawingRoute(false);
      setRedrawingId(null);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [drawingDraft]);
  const layerRouteIds = new Set(layerRoutes.map((r) => r.id));
  const selectableIds = travelPanelOpen && !drawingDraft ? layerRouteIds : new Set<string>();
  const selectedRoute = selectedRouteId ? layerRoutes.find((r) => r.id === selectedRouteId) : undefined;
  const editableId = travelPanelOpen && !drawingDraft && selectedRoute && !routes.isLocked(selectedRoute) ? selectedRoute.id : null;

  async function finishRoute(points: RoutePt[]) {
    if (redrawingId) {
      routes.update(redrawingId, { points });
      routes.sel.select(redrawingId);
      setRedrawingId(null);
      return;
    }
    const folderDefault = activeGroup?.defaultStyle ?? null;
    const style: RouteStyle = { ...DEFAULT_ROUTE_STYLE, ...draft.style, ...(folderDefault ? sanitizeRouteStyle(folderDefault) : {}) };
    const settings = folderDefault?.settings && typeof folderDefault.settings === "object" ? { ...draft.settings, ...(folderDefault.settings as Partial<TravelSettings>) } : draft.settings;
    const created = await routes.create({ layerId: activeLayerId, groupId: drawGroupId, points, name: "", style, settings });
    setDrawingRoute(false);
    if (created) routes.sel.select(created.id);
  }

  const ownLegend = legendApi.legends.find((l) => l.layerId === activeLayerId) ?? null;
  // While editing, the layer's own legend shows even when hidden (dimmed), so it can be arranged.
  const legend = legendPanelOpen ? ownLegend : layerVisible ? legendForLayer(legendApi.legends, activeLayerId) : null;
  const scaleShown = scaleBar.config.framePxPerUnit !== null && (scaleBar.visible || scalePanelOpen);

  return (
    <>
      <RouteLayer
        viewer={viewer}
        osd={osd}
        routes={drawnRoutes}
        selectedIds={travelPanelOpen ? routes.sel.ids : []}
        selectableIds={selectableIds}
        editableId={editableId}
        pulseId={pulseId}
        labelOf={(route) => {
          if (!travelPanelOpen || !layerRouteIds.has(route.id)) return null;
          const plan = planOf(route);
          const index = layerRoutes.filter((r) => r.layerId === route.layerId && r.groupId === route.groupId).findIndex((r) => r.id === route.id);
          return `${routeLabel(route, Math.max(0, index))}${plan ? ` · ${formatDuration(plan.fullDays, plan.extraHours)}` : ""}`;
        }}
        onPick={(id, mods) => routes.sel.click(id, mods.toggle ? { toggle: true, range: false } : { toggle: false, range: false }, [])}
        onReshape={(id, points) => routes.update(id, { points })}
      />
      {legend && (
        <div className={legend.visible ? "map-hud-slot" : "map-hud-slot map-hud-hidden"}>
          <MapLegend
            legend={legend}
            area={area}
            inset={inset}
            editable={legendPanelOpen}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            onUpdateConfig={(config) => legendApi.update(legend.layerId, { config })}
          />
        </div>
      )}
      {scaleShown && (
        <div className={scaleBar.visible ? "map-hud-slot" : "map-hud-slot map-hud-hidden"}>
          <MapScaleBar viewer={viewer} config={scaleBar.config} area={area} inset={inset} editable={scalePanelOpen} onUpdateConfig={(config) => updateScale({ config })} />
        </div>
      )}
      {travelPanelOpen && ppu !== null && drawingDraft && (
        <MeasureLayer
          key={redrawingId ?? "new"}
          viewer={viewer}
          osd={osd}
          mode="travel"
          config={scaleBar.config}
          onCancelCalibration={() => undefined}
          onCalibrate={() => undefined}
          onPathChange={setLivePx}
          onFinish={(points) => void finishRoute(points)}
          summary={(framePx) => {
            const plan = planTravel(milesOf(framePx, drawSettings), drawSettings);
            return plan ? formatDuration(plan.fullDays, plan.extraHours) : "-";
          }}
        />
      )}
      {measureMode && (
        <MeasureLayer
          viewer={viewer}
          osd={osd}
          mode={measureMode}
          config={scaleBar.config}
          onCancelCalibration={() => setMeasureMode(null)}
          onCalibrate={(framePxPerUnit, unit) => {
            const first = scaleBar.config.framePxPerUnit === null;
            updateScale({ config: { framePxPerUnit, unit }, ...(first ? { visible: true } : {}) });
            setMeasureMode(null);
          }}
        />
      )}
      {legendPanelOpen && !legendApi.loaded && <PanelSkeleton className="zones-panel legend-panel" mainClassName="zones-panel-main" title="Legend" Icon={LayoutList} onClose={onCloseLegendPanel} rows={4} />}
      {legendPanelOpen && legendApi.loaded && (
        <LegendPanel
          layerName={layerName}
          layerId={activeLayerId}
          layers={layers}
          legend={ownLegend}
          error={legendApi.error}
          selectedItemId={selectedItemId}
          onSelectItem={setSelectedItemId}
          onCreate={() => void legendApi.create(activeLayerId)}
          onUpdate={(patch) => legendApi.update(activeLayerId, patch)}
          onDelete={() => void legendApi.remove(activeLayerId)}
          onClose={onCloseLegendPanel}
        />
      )}
      {travelPanelOpen && !(routes.loaded && scaleLoaded) && <PanelSkeleton className="zones-panel travel-panel" mainClassName="zones-panel-main" title="Travel" Icon={Route} onClose={onCloseTravelPanel} />}
      {travelPanelOpen && routes.loaded && scaleLoaded && (
        <TravelPanel
          config={scaleBar.config}
          layers={layers}
          activeLayerId={activeLayerId}
          layerName={layerName}
          routes={routes}
          drawing={drawingDraft}
          onToggleDrawing={() => {
            if (drawingDraft) {
              setDrawingRoute(false);
              setRedrawingId(null);
            } else {
              setDrawingRoute(true);
            }
            setLivePx(0);
          }}
          redrawingId={redrawingId}
          onRedraw={(id) => {
            setRedrawingId(id);
            setDrawingRoute(false);
            setLivePx(0);
          }}
          draft={draft}
          onDraftChange={setDraft}
          planOf={planOf}
          livePlan={livePx > 0 ? planTravel(milesOf(livePx, drawSettings), drawSettings) : null}
          onOpenScale={onOpenScalePanel}
          onClose={onCloseTravelPanel}
        />
      )}
      {areaPanelOpen && scaleLoaded && (
        <AreaLayer
          viewer={viewer}
          osd={osd}
          tool={areaTool}
          shapes={areaShapes}
          selectedId={areaSelectedId}
          config={scaleBar.config}
          onAdd={(shape) => setAreaShapes((prev) => [...prev, { id: crypto.randomUUID(), shape }])}
        />
      )}
      {areaPanelOpen && !scaleLoaded && <PanelSkeleton className="grid-panel area-panel" title="Area" Icon={LandPlot} onClose={onCloseAreaPanel} rows={4} />}
      {areaPanelOpen && scaleLoaded && (
        <AreaPanel
          tool={areaTool}
          onSetTool={setAreaTool}
          shapes={areaShapes}
          selectedId={areaSelectedId}
          onSelect={setAreaSelectedId}
          onRemove={(id) => {
            setAreaShapes((prev) => prev.filter((s) => s.id !== id));
            if (areaSelectedId === id) setAreaSelectedId(null);
          }}
          onClear={() => {
            setAreaShapes([]);
            setAreaSelectedId(null);
          }}
          config={scaleBar.config}
          onOpenScale={onOpenScalePanel}
          onClose={onCloseAreaPanel}
        />
      )}
      {scalePanelOpen && !scaleLoaded && <PanelSkeleton className="grid-panel scale-panel" title="Scale & measure" Icon={Ruler} onClose={onCloseScalePanel} rows={4} />}
      {scalePanelOpen && scaleLoaded && (
        <ScalePanel scaleBar={scaleBar} error={scaleError} measureMode={measureMode} onSetMeasureMode={setMeasureMode} onUpdate={updateScale} onClose={onCloseScalePanel} />
      )}
    </>
  );
}
