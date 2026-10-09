"use client";

import { Clock, Footprints, MoreHorizontal, MousePointer2, Route, Ruler, Spline, Trash2 } from "lucide-react";
import { formatNumber, type ScaleConfig } from "@/server/scale/scale-config";
import { formatDuration, type TravelPlan, type TravelSettings } from "@/server/travel/travel";
import type { MapRouteData, RouteStyle, RouteStyleKind } from "@/server/travel/route-config";
import { formatInteger } from "@/server/settings/number-format";
import { useT } from "@/i18n/useT";
import LayerChecklist from "../LayerChecklist";
import { FolderSelect, LayerSelect, useNoun, type MapFolderData } from "../LayerFolders";
import { editLayers, mixedKeys, sharedLayers } from "../multi-select";
import ToolSection from "../ToolSection";
import type { MapLayerData } from "../layer-images";
import type { RouteControls, RoutePatch } from "../map-hud/use-map-routes";
import { Journey, RouteColorField, RouteLineField, RouteWidthField, TravelSettingsFields, modeLabel, type TravelDraft } from "../map-hud/travel-fields";
import { DoneButton, FolderTargetPopover, MultiSelectionGroup, NameField, SelectedCount, Swatch, ToolBar, ToolBarButton, ToolBarDivider, ToolBarPopover } from "./ToolBar";

const NO_MIXED: ReadonlySet<string> = new Set();

/** The dash pattern of each route style, drawn on its button. */
const STYLE_DASH: Record<RouteStyleKind, string | undefined> = { solid: undefined, dotted: "0.5 3.5", dashed: "5 3" };

function StyleSample({ style }: { style: RouteStyleKind }) {
  return (
    <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden>
      <line x1="2" y1="4" x2="20" y2="4" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeDasharray={STYLE_DASH[style]} />
    </svg>
  );
}

/**
 * The Travel tool's bar: select, draw a route, and the folder new routes go
 * into. With routes selected (or while drawing: the next route) it grows the
 * trip, how it's travelled, its look and "More" (name, folder and layers),
 * then Redraw, Delete and Done.
 */
export default function TravelToolBar({
  inset,
  config,
  layers,
  activeLayerId,
  routes: controls,
  drawing,
  onToggleDrawing,
  redrawingId,
  onRedraw,
  draft,
  onDraftChange,
  planOf,
  livePlan,
  labelOf,
  onOpenScale,
}: {
  /** Where the map's free part starts (right of the side panel). */
  inset: number;
  config: ScaleConfig;
  layers: MapLayerData[];
  activeLayerId: string;
  routes: RouteControls;
  /** A route (new or redrawn) is being drawn. */
  drawing: boolean;
  onToggleDrawing: () => void;
  redrawingId: string | null;
  onRedraw: (id: string | null) => void;
  draft: TravelDraft;
  onDraftChange: (patch: { style?: Partial<RouteStyle>; settings?: Partial<TravelSettings> }) => void;
  planOf: (route: MapRouteData) => TravelPlan | null;
  /** The trip of the route being drawn (null until it has two points). */
  livePlan: TravelPlan | null;
  /** A route's label (its name, or its place in its folder). */
  labelOf: (route: MapRouteData) => string;
  onOpenScale: () => void;
}) {
  const t = useT("maps");
  const { one, many } = useNoun("route");
  const { routes, groups, sel, update, remove, updateMany, deleteMany, isLocked } = controls;
  const calibrated = config.framePxPerUnit !== null;
  const ownGroups = groups.filter((g) => g.layerId === activeLayerId).sort((a, b) => a.sortOrder - b.sortOrder);
  const target = ownGroups.find((g) => g.id === controls.activeGroupId) ?? null;
  const drawBlocked = !calibrated || Boolean(target && (target.locked || !target.visible));

  const selected = routes.find((r) => r.id === sel.single) ?? null;
  const picked = new Set(sel.ids);
  const multi = sel.ids.length > 1 ? routes.filter((r) => picked.has(r.id)) : [];
  const lockedCount = multi.filter(isLocked).length;
  const selectedLocked = selected ? isLocked(selected) : false;
  const newRoute = drawing && !redrawingId;

  // What the trip, travel and look buttons edit: the selection, or the next route while drawing one.
  type Editing = { style: RouteStyle; settings: TravelSettings; mixed: ReadonlySet<string>; setStyle: (patch: Partial<RouteStyle>) => void; setSettings: (patch: Partial<TravelSettings>) => void; disabled: boolean };
  const editing: Editing | null =
    multi.length > 1
      ? {
          style: multi[0],
          settings: multi[0].settings,
          mixed: mixedKeys(multi),
          setStyle: (patch) => updateMany(sel.ids, () => patch),
          setSettings: (patch) => updateMany(sel.ids, (r) => ({ settings: { ...r.settings, ...patch } })),
          disabled: lockedCount === multi.length,
        }
      : selected
        ? { style: selected, settings: selected.settings, mixed: NO_MIXED, setStyle: (patch) => update(selected.id, patch), setSettings: (settings) => update(selected.id, { settings }), disabled: selectedLocked }
        : newRoute
          ? { style: draft.style, settings: draft.settings, mixed: NO_MIXED, setStyle: (style) => onDraftChange({ style }), setSettings: (settings) => onDraftChange({ settings }), disabled: false }
          : null;
  // A folder with its own look gives it to new routes.
  const lookEditable = editing && !(newRoute && target?.defaultStyle);

  const caption = captionFor();
  function captionFor(): string | undefined {
    if (!calibrated) return t("travel.calibrateTitle");
    // While drawing, the drawing layer's own hint shows above the bar.
    if (drawing) return undefined;
    if (multi.length > 1) {
      if (lockedCount) return t("layerFolders.lockedWontChange", { count: lockedCount, n: formatInteger(lockedCount), noun: one, nouns: many });
      return editing?.mixed.has("settings") ? t("travel.mixedSettings") : undefined;
    }
    if (selected) return selectedLocked ? (selected.groupId && groups.find((g) => g.id === selected.groupId)?.locked ? t("travel.lockedByFolder") : t("travel.locked")) : t("travel.editHint");
    return undefined;
  }

  // The trip: one route's, the one being drawn, or several back to back.
  const plans = multi.map(planOf);
  const allPlanned = plans.every((plan): plan is TravelPlan => plan !== null);
  const totalDays = allPlanned ? plans.reduce((sum, plan) => sum + plan.daysOnRoad, 0) : 0;
  const totalHours = allPlanned ? plans.reduce((sum, plan) => sum + plan.totalHours, 0) : null;
  const plan = multi.length > 1 ? null : selected ? planOf(selected) : newRoute ? livePlan : null;
  const tripFace = multi.length > 1 ? (totalHours !== null ? t("travel.daysOnRoadTotal", { count: totalDays, n: formatNumber(totalDays) }) : "–") : plan ? formatDuration(plan.fullDays, plan.extraHours) : "–";

  return (
    <ToolBar label={t("travelBar.label")} inset={inset} caption={caption}>
      <ToolBarButton Icon={MousePointer2} label={t("travelBar.select")} hint={t("travelBar.selectHint")} pressed={!drawing} onClick={() => drawing && onToggleDrawing()} />
      <ToolBarButton
        Icon={Route}
        label={t("travel.start")}
        hint={!calibrated ? t("travel.calibrateTitle") : drawBlocked ? t("panel.folderBlocked") : t("travelBar.drawHint")}
        pressed={newRoute}
        disabled={drawBlocked && !newRoute}
        onClick={() => {
          // Drawing (or redrawing) stops; otherwise a new route starts, with nothing selected.
          if (!drawing) sel.select(null);
          onToggleDrawing();
        }}
      />
      {!calibrated && (
        <ToolBarButton Icon={Ruler} label={t("travel.openScale")} onClick={onOpenScale}>
          <span>{t("travel.openScale")}</span>
        </ToolBarButton>
      )}
      <ToolBarDivider />
      <FolderTargetPopover
        label={t("travel.target", { folder: target?.name ?? t("panel.ungrouped") })}
        hint={t("travelBar.folderHint")}
        folders={ownGroups}
        activeId={controls.activeGroupId}
        placeholder={t("panel.ungrouped")}
        noneLabel={t("panel.ungrouped")}
        emptyText={t("panel.ungrouped")}
        onPick={controls.setActiveGroupId}
      />

      {editing && <ToolBarDivider />}
      {selected && (
        <span className="tool-bar-label">
          <Spline size={14} strokeWidth={2.25} style={{ color: selected.color }} aria-hidden />
          <span className="tool-bar-text">{labelOf(selected)}</span>
        </span>
      )}
      {multi.length > 1 && <SelectedCount noun="route" count={multi.length} />}
      {newRoute && <span className="tool-bar-label">{t("travel.beingDrawn")}</span>}

      {editing && (
        <>
          <ToolBarPopover
            label={t("travel.time")}
            hint={t("travelBar.tripHint")}
            wide
            face={
              <>
                <Clock size={16} strokeWidth={2.25} aria-hidden />
                <span className="tool-bar-value tool-bar-readout">{tripFace}</span>
              </>
            }
          >
            <div className="tool-bar-pop-fields">
              {multi.length > 1 ? (
                totalHours !== null ? (
                  <div className="travel-hero">
                    <span className="field-label">{t("travel.backToBack")}</span>
                    <strong>{t("travel.daysOnRoadTotal", { count: totalDays, n: formatNumber(totalDays) })}</strong>
                    <span className="field-label">{t("travel.hoursTotal", { n: formatNumber(totalHours) })}</span>
                  </div>
                ) : (
                  <p className="field-label">{t("travel.noMove")}</p>
                )
              ) : (
                <Journey plan={plan} settings={editing.settings} config={config} />
              )}
            </div>
          </ToolBarPopover>
          <ToolBarPopover
            label={multi.length > 1 ? t("travel.howTravelledMany") : t("travel.howTravelled")}
            hint={t("travelBar.howHint")}
            wide
            disabled={editing.disabled}
            face={
              <>
                <Footprints size={16} strokeWidth={2.25} aria-hidden />
                <span className="tool-bar-text">{editing.mixed.has("settings") ? t("layerFolders.mixed") : modeLabel(editing.settings.mode)}</span>
              </>
            }
          >
            <div className="tool-bar-pop-fields">
              {editing.mixed.has("settings") && <p className="field-label zone-tool-hint">{t("travel.mixedSettings")}</p>}
              <TravelSettingsFields settings={editing.settings} config={config} idPrefix={selected ? `route-${selected.id}` : multi.length > 1 ? "routes" : "draft"} onChange={editing.setSettings} />
            </div>
          </ToolBarPopover>
          {lookEditable && (
            <>
              <ToolBarPopover label={t("travel.color")} disabled={editing.disabled} face={<Swatch color={editing.style.color} mixed={editing.mixed.has("color")} />}>
                <div className="tool-bar-pop-fields">
                  <RouteColorField v={editing.style} mixed={editing.mixed} onChange={editing.setStyle} />
                </div>
              </ToolBarPopover>
              <ToolBarPopover
                label={t("travel.width")}
                disabled={editing.disabled}
                face={editing.mixed.has("width") ? <span className="mixed-tag">{t("layerFolders.mixed")}</span> : <span className="tool-bar-value">{t("toolBar.px", { n: formatNumber(editing.style.width) })}</span>}
              >
                <div className="tool-bar-pop-fields">
                  <RouteWidthField v={editing.style} mixed={editing.mixed} onChange={editing.setStyle} />
                </div>
              </ToolBarPopover>
              <ToolBarPopover label={t("travel.lineStyle")} disabled={editing.disabled} face={editing.mixed.has("style") ? <span className="mixed-tag">{t("layerFolders.mixed")}</span> : <StyleSample style={editing.style.style} />}>
                <div className="tool-bar-pop-fields">
                  <RouteLineField v={editing.style} mixed={editing.mixed} onChange={editing.setStyle} />
                </div>
              </ToolBarPopover>
            </>
          )}
          {newRoute && target?.defaultStyle && <span className="tool-bar-label field-label">{t("travel.folderLook", { name: target.name })}</span>}
          {(selected || multi.length > 1) && (
            <ToolBarPopover label={t("toolBar.more")} hint={t("travelBar.moreHint")} wide disabled={editing.disabled} face={<MoreHorizontal size={16} strokeWidth={2.25} aria-hidden />}>
              <div className="tool-bar-pop-fields">
                {selected && <NameField sourceKey={selected.id} value={selected.name} placeholder={selected.name ? undefined : labelOf(selected)} allowEmpty onRename={(name) => update(selected.id, { name })} />}
                <RoutePlacement routes={multi.length > 1 ? multi : [selected!]} layers={layers} groups={groups} onUpdate={(patchOf) => (multi.length > 1 ? updateMany(sel.ids, patchOf) : update(selected!.id, patchOf(selected!)))} />
              </div>
            </ToolBarPopover>
          )}
        </>
      )}

      {selected && (
        <>
          <ToolBarButton
            Icon={Route}
            label={redrawingId === selected.id ? t("travel.cancelRedraw") : t("travel.redraw")}
            hint={t("travelBar.redrawHint")}
            pressed={redrawingId === selected.id}
            disabled={selectedLocked}
            onClick={() => onRedraw(redrawingId === selected.id ? null : selected.id)}
          />
          <ToolBarButton Icon={Trash2} danger label={t("travel.delete")} disabled={selectedLocked} onClick={() => remove(selected.id)} />
          <DoneButton onClick={() => sel.select(null)} />
        </>
      )}
      {multi.length > 1 && (
        <MultiSelectionGroup
          noun="route"
          count={multi.length}
          lockedCount={lockedCount}
          allVisible={multi.every((r) => r.visible)}
          allLocked={multi.every((r) => r.locked)}
          onToggleVisible={() => updateMany(sel.ids, () => ({ visible: !multi.every((r) => r.visible) }), { includeLocked: true })}
          onToggleLocked={() => updateMany(sel.ids, () => ({ locked: !multi.every((r) => r.locked) }), { includeLocked: true })}
          onDelete={() => deleteMany(sel.ids)}
          onDone={() => sel.select(null)}
        />
      )}
    </ToolBar>
  );
}

/** The selected routes' folder, home layer and the other layers they show on. */
function RoutePlacement({ routes, layers, groups, onUpdate }: { routes: MapRouteData[]; layers: MapLayerData[]; groups: MapFolderData[]; onUpdate: (patchOf: (route: MapRouteData) => RoutePatch) => void }) {
  const t = useT("maps");
  const [first] = routes;
  const multi = routes.length > 1;
  const mixed = multi ? mixedKeys(routes) : NO_MIXED;
  const oneLayer = !mixed.has("layerId");
  const folderOf = (r: MapRouteData) => (r.groupId && groups.some((g) => g.id === r.groupId) ? r.groupId : null);
  const folders = new Set(routes.map(folderOf));
  const folderOptions = oneLayer ? groups.filter((g) => g.layerId === first.layerId).sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const group = !multi && first.groupId ? groups.find((g) => g.id === first.groupId) : undefined;
  const layersOf = sharedLayers(routes.map((r) => r.extraLayerIds));
  const setAll = (patch: RoutePatch) => onUpdate(() => patch);
  return (
    <ToolSection id="travel-layers" title={t("panel.folderLayers")}>
      <FolderSelect
        value={folderOf(first)}
        mixed={folders.size > 1}
        folders={folderOptions}
        noneLabel={t("panel.ungrouped")}
        disabled={!oneLayer}
        hint={oneLayer ? undefined : t("panel.differentLayers")}
        onChange={(groupId) => setAll({ groupId })}
      />
      <LayerSelect value={first.layerId} mixed={!oneLayer} layers={layers} onChange={(layerId) => onUpdate((r) => ({ layerId, extraLayerIds: r.extraLayerIds.filter((id) => id !== layerId) }))} />
      {multi ? (
        <LayerChecklist
          layers={layers}
          homeLayerId={oneLayer ? first.layerId : null}
          value={layersOf.all}
          mixedIds={layersOf.some}
          alwaysDrawFlag="routesAlwaysVisible"
          onChange={() => undefined}
          onEdit={(add, removed) => onUpdate((r) => ({ extraLayerIds: editLayers(r.extraLayerIds, add, removed).filter((id) => id !== r.layerId) }))}
        />
      ) : (
        <LayerChecklist
          layers={layers}
          homeLayerId={first.layerId}
          value={first.extraLayerIds}
          alwaysDrawFlag="routesAlwaysVisible"
          inherited={group ? { ids: group.extraLayerIds, from: group.name } : undefined}
          onChange={(extraLayerIds) => setAll({ extraLayerIds })}
        />
      )}
    </ToolSection>
  );
}
