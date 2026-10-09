"use client";

import { useEffect, useRef, useState } from "react";
import { Brush, Circle, Eraser, Hexagon, MousePointer2, MoreHorizontal, Plus, Square, Trash2, type LucideIcon } from "lucide-react";
import { formatInteger } from "@/server/settings/number-format";
import type { ScaleConfig } from "@/server/scale/scale-config";
import { useT } from "@/i18n/useT";
import LayerChecklist from "../LayerChecklist";
import { FolderSelect, useNoun } from "../LayerFolders";
import { editLayers, mixedKeys, sharedLayers } from "../multi-select";
import ToolSection from "../ToolSection";
import type { MapLayerData } from "../layer-images";
import { BRUSH_SIZE_MAX, BRUSH_SIZE_MIN, isPaintTool, type ZoneData, type ZoneRegionData, type ZoneTool } from "../ZoneLayer";
import { SHAPE_ICON, ZoneArea, ZoneFillFields, ZoneOutlineFields, ZoneTerritoryLink } from "../zone-fields";
import { DoneButton, FolderTargetPopover, MultiSelectionGroup, SelectedCount, Swatch, ToolBar, ToolBarButton, ToolBarDivider, ToolBarPopover } from "./ToolBar";

type DrawTool = Exclude<ZoneTool, "select" | "eraser">;

/** The tools that add a zone, in the bar's order. */
const DRAW_TOOLS: { tool: DrawTool; Icon: LucideIcon; label: "zones.shape.rectangle" | "zones.shape.circle" | "zones.shape.polygon" | "zones.tool.brush"; hint: "zones.tool.rectangleHint" | "zones.tool.circleHint" | "zones.tool.polygonHint" | "zones.tool.brushHint" }[] = [
  { tool: "rectangle", Icon: Square, label: "zones.shape.rectangle", hint: "zones.tool.rectangleHint" },
  { tool: "circle", Icon: Circle, label: "zones.shape.circle", hint: "zones.tool.circleHint" },
  { tool: "polygon", Icon: Hexagon, label: "zones.shape.polygon", hint: "zones.tool.polygonHint" },
  { tool: "brush", Icon: Brush, label: "zones.tool.brush", hint: "zones.tool.brushHint" },
];

const isDrawTool = (tool: ZoneTool): tool is DrawTool => tool !== "select" && tool !== "eraser";

/**
 * The Zones tool's bar: select or add zones (by shape or with the brush),
 * erase, the region new zones go into; with zones selected, their fill,
 * outline and the rest of their settings ("More").
 */
export default function ZoneToolBar({
  inset,
  regions,
  sharedRegionIds,
  zones,
  layers,
  scaleConfig,
  activeRegionId,
  onSetActiveRegion,
  activeTool,
  onSetActiveTool,
  brushSize,
  onBrushSizeChange,
  selectedIds,
  onSelectZone,
  onUpdateZone,
  onDeleteZone,
  onUpdateMany,
  onDeleteMany,
}: {
  /** Where the map's free part starts (right of the side panel). */
  inset: number;
  /** The layer's regions, and those shared onto it (`sharedRegionIds`: zones can't be drawn into these). */
  regions: ZoneRegionData[];
  sharedRegionIds: Set<string>;
  zones: ZoneData[];
  layers: MapLayerData[];
  /** The map's scale (null until it loads): zones show their area through it. */
  scaleConfig: ScaleConfig | null;
  activeRegionId: string | null;
  onSetActiveRegion: (id: string) => void;
  activeTool: ZoneTool;
  onSetActiveTool: (tool: ZoneTool) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  selectedIds: string[];
  onSelectZone: (id: string | null) => void;
  onUpdateZone: (id: string, patch: Partial<ZoneData>) => void;
  onDeleteZone: (id: string) => void;
  /** One edit of several zones (locked ones are skipped unless `includeLocked`). */
  onUpdateMany: (ids: string[], patchOf: (zone: ZoneData) => Partial<ZoneData>, opts?: { includeLocked?: boolean }) => void;
  onDeleteMany: (ids: string[]) => void;
}) {
  const t = useT("maps");
  const { one, many } = useNoun("zone");
  /** The shape "Add zone" draws: the last one picked. */
  const [lastDraw, setLastDraw] = useState<DrawTool>("rectangle");

  const regionOf = (z: ZoneData) => regions.find((r) => r.id === z.regionId);
  const zoneLocked = (z: ZoneData) => z.locked || Boolean(regionOf(z)?.locked);
  const ownRegions = regions.filter((r) => !sharedRegionIds.has(r.id)).sort((a, b) => a.sortOrder - b.sortOrder);
  const activeRegion = regions.find((r) => r.id === activeRegionId) ?? null;
  const drawingDisabled = !activeRegion || activeRegion.locked || !activeRegion.visible;

  const picked = new Set(selectedIds);
  const selected = zones.filter((z) => picked.has(z.id));
  const single = selected.length === 1 ? selected[0] : null;
  const paintable = Boolean(single && !zoneLocked(single));

  function arm(tool: ZoneTool) {
    if (isDrawTool(tool)) setLastDraw(tool);
    onSetActiveTool(tool);
  }

  const caption = captionFor();
  function captionFor(): string | undefined {
    if (activeTool === "eraser") {
      if (!single) return t("zones.brush.selectToErase");
      return t(paintable ? "zones.brush.erasingFrom" : "zones.brush.erasingFromLocked", { name: single.name });
    }
    if (activeTool === "brush" && single) return t(paintable ? "zones.brush.paintingInto" : "zones.brush.paintingIntoLocked", { name: single.name });
    if (activeTool === "select") {
      const locked = selected.filter(zoneLocked).length;
      return selected.length > 1 && locked ? t("layerFolders.lockedWontChange", { count: locked, n: formatInteger(locked), noun: one, nouns: many }) : undefined;
    }
    if (!activeRegion) return activeTool === "brush" ? t("zones.brush.needRegion") : t("zones.draw.needRegion");
    if (activeRegion.locked) return t("zones.draw.in", { name: activeRegion.name }) + t("zones.draw.locked");
    if (!activeRegion.visible) return t("zones.draw.in", { name: activeRegion.name }) + t("zones.draw.hidden");
    return activeTool === "brush" ? t("zones.brush.paintingNew", { name: activeRegion.name }) : t("zones.draw.in", { name: activeRegion.name });
  }

  return (
    <ToolBar label={t("zoneBar.label")} inset={inset} caption={caption}>
      <ToolBarButton Icon={MousePointer2} label={t("zones.tool.select")} hint={t("zoneBar.selectHint")} pressed={activeTool === "select"} onClick={() => arm("select")} />
      <ToolBarButton
        Icon={Plus}
        label={t("zoneBar.addZone")}
        hint={t("zoneBar.addZoneHint", { shape: t(DRAW_TOOLS.find((d) => d.tool === lastDraw)!.label) })}
        disabled={drawingDisabled}
        onClick={() => {
          onSelectZone(null);
          arm(isDrawTool(activeTool) ? activeTool : lastDraw);
        }}
      />
      <ToolBarDivider />
      {DRAW_TOOLS.map(({ tool, Icon, label, hint }) => (
        <ToolBarButton
          key={tool}
          Icon={Icon}
          label={t(label)}
          hint={t(hint)}
          pressed={activeTool === tool}
          // The brush also paints into the selected zone, without a region.
          disabled={drawingDisabled && !(tool === "brush" && paintable)}
          onClick={() => arm(tool)}
        />
      ))}
      <ToolBarButton Icon={Eraser} label={t("zones.tool.eraser")} hint={t("zones.tool.eraserHint")} pressed={activeTool === "eraser"} disabled={!paintable} onClick={() => arm("eraser")} />
      {isPaintTool(activeTool) && (
        <label className="tool-bar-slider" data-tooltip={t("zoneBar.brushSizeHint")}>
          <span className="tool-bar-value">{t("toolBar.px", { n: formatInteger(brushSize) })}</span>
          <input type="range" min={BRUSH_SIZE_MIN} max={BRUSH_SIZE_MAX} value={brushSize} aria-label={t("zones.brush.size", { n: formatInteger(brushSize) })} onChange={(e) => onBrushSizeChange(Number(e.target.value))} />
        </label>
      )}
      <ToolBarDivider />
      <FolderTargetPopover
        label={t("zoneBar.region", { name: activeRegion?.name ?? t("zoneBar.noRegion") })}
        hint={t("zoneBar.regionHint")}
        folders={ownRegions}
        activeId={activeRegionId}
        placeholder={t("zoneBar.noRegion")}
        emptyText={t("zoneBar.noRegions")}
        onPick={(id) => id && onSetActiveRegion(id)}
      />

      {selected.length > 0 && <ToolBarDivider />}
      {single && <SelectedZone zone={single} />}
      {selected.length > 1 && <SelectedCount noun="zone" count={selected.length} />}
      {selected.length > 0 && (
        <ZoneProperties
          zones={selected}
          layers={layers}
          ownRegions={ownRegions}
          scaleConfig={scaleConfig}
          regionOf={regionOf}
          endOf={(regionId) => Math.max(-1, ...zones.filter((z) => z.regionId === regionId).map((z) => z.sortOrder)) + 1}
          onUpdate={(patchOf, opts) => (single ? onUpdateZone(single.id, patchOf(single)) : onUpdateMany(selectedIds, patchOf, opts))}
        />
      )}
      {single && (
        <>
          <ToolBarButton Icon={Trash2} danger label={t("zones.deleteZone")} disabled={single.locked} onClick={() => onDeleteZone(single.id)} />
          <DoneButton onClick={() => onSelectZone(null)} />
        </>
      )}
      {selected.length > 1 && (
        <MultiSelectionGroup
          noun="zone"
          count={selected.length}
          lockedCount={selected.filter(zoneLocked).length}
          allVisible={selected.every((z) => z.visible)}
          allLocked={selected.every((z) => z.locked)}
          onToggleVisible={() => onUpdateMany(selectedIds, () => ({ visible: !selected.every((z) => z.visible) }), { includeLocked: true })}
          onToggleLocked={() => onUpdateMany(selectedIds, () => ({ locked: !selected.every((z) => z.locked) }), { includeLocked: true })}
          onDelete={() => onDeleteMany(selectedIds)}
          onDone={() => onSelectZone(null)}
        />
      )}
    </ToolBar>
  );
}

/** The selected zone's shape and name. */
function SelectedZone({ zone }: { zone: ZoneData }) {
  const Icon = SHAPE_ICON[zone.shapeType];
  return (
    <span className="tool-bar-label">
      <Icon size={14} strokeWidth={2.25} aria-hidden />
      <span className="tool-bar-text">{zone.name}</span>
    </span>
  );
}

/** Fill, outline and "More" for the selected zones: a field shows "Mixed" when they differ. */
function ZoneProperties({
  zones,
  layers,
  ownRegions,
  scaleConfig,
  regionOf,
  endOf,
  onUpdate,
}: {
  zones: ZoneData[];
  layers: MapLayerData[];
  ownRegions: ZoneRegionData[];
  scaleConfig: ScaleConfig | null;
  regionOf: (zone: ZoneData) => ZoneRegionData | undefined;
  endOf: (regionId: string) => number;
  onUpdate: (patchOf: (zone: ZoneData) => Partial<ZoneData>, opts?: { includeLocked?: boolean }) => void;
}) {
  const t = useT("maps");
  const [first] = zones;
  const multi = zones.length > 1;
  const mixed = multi ? mixedKeys(zones) : new Set<string>();
  const setAll = (patch: Partial<ZoneData>) => onUpdate(() => patch);
  const homeLayers = new Set(zones.map((z) => regionOf(z)?.layerId ?? null));
  const oneLayer = homeLayers.size === 1;
  const homeLayerId = oneLayer ? (regionOf(first)?.layerId ?? null) : null;
  // Zones move among their layer's own regions.
  const regionOptions = oneLayer ? ownRegions.filter((r) => r.layerId === homeLayerId) : [];
  const region = regionOf(first);
  const layersOf = sharedLayers(zones.map((z) => z.extraLayerIds));
  const moveLocked = !multi && (first.locked || Boolean(region?.locked));

  return (
    <>
      <ToolBarPopover label={t("zones.fill")} face={<Swatch color={first.fillColor} mixed={mixed.has("fillColor")} />}>
        <div className="tool-bar-pop-fields">
          <ZoneFillFields v={first} mixed={mixed} onChange={setAll} />
        </div>
      </ToolBarPopover>
      <ToolBarPopover label={t("zones.outline")} face={<span className={mixed.has("strokeColor") ? "tool-bar-swatch ring mixed" : "tool-bar-swatch ring"} style={mixed.has("strokeColor") ? undefined : { borderColor: first.strokeColor }} aria-hidden />}>
        <div className="tool-bar-pop-fields">
          <ZoneOutlineFields v={first} mixed={mixed} onChange={setAll} />
        </div>
      </ToolBarPopover>
      <ToolBarPopover label={t("toolBar.more")} hint={t("zoneBar.moreHint")} wide face={<MoreHorizontal size={16} strokeWidth={2.25} aria-hidden />}>
        <div className="tool-bar-pop-fields">
          {!multi && <ZoneName zone={first} onRename={(name) => setAll({ name })} />}
          <ZoneArea zones={zones} config={scaleConfig} />
          <ToolSection id="zone-territory" title={t("zones.territory.section")}>
            <ZoneTerritoryLink zone={first} mixed={mixed.has("territoryId")} onUpdate={setAll} />
          </ToolSection>
          <ToolSection id="zone-layers" title={t("panel.folderLayers")}>
            <FolderSelect
              value={first.regionId}
              mixed={mixed.has("regionId")}
              folders={regionOptions}
              disabled={!oneLayer || moveLocked}
              hint={oneLayer ? undefined : t("zones.multi.differentLayers")}
              onChange={(regionId) => {
                if (!regionId) return;
                const start = endOf(regionId);
                // Moved zones go in last, keeping their order.
                onUpdate((z) => (z.regionId === regionId ? {} : { regionId, sortOrder: start + zones.indexOf(z) }));
              }}
            />
            {multi ? (
              <LayerChecklist
                layers={layers}
                homeLayerId={homeLayerId}
                value={layersOf.all}
                mixedIds={layersOf.some}
                alwaysDrawFlag="zonesAlwaysVisible"
                onChange={() => undefined}
                onEdit={(add, remove) => onUpdate((z) => ({ extraLayerIds: editLayers(z.extraLayerIds, add, remove).filter((id) => id !== regionOf(z)?.layerId) }))}
              />
            ) : (
              <LayerChecklist
                layers={layers}
                homeLayerId={homeLayerId}
                value={first.extraLayerIds ?? []}
                alwaysDrawFlag="zonesAlwaysVisible"
                inherited={region ? { ids: region.extraLayerIds, from: region.name } : undefined}
                onChange={(extraLayerIds) => setAll({ extraLayerIds })}
              />
            )}
          </ToolSection>
        </div>
      </ToolBarPopover>
    </>
  );
}

/** Renames the zone when the field is left (Enter); follows outside renames while not being edited. */
function ZoneName({ zone, onRename }: { zone: ZoneData; onRename: (name: string) => void }) {
  const tc = useT("common");
  const [name, setName] = useState(zone.name);
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusedRef.current) setName(zone.name);
  }, [zone.id, zone.name]);
  return (
    <label className="grid-field">
      <span className="field-label">{tc("name")}</span>
      <input
        type="text"
        value={name}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          focusedRef.current = false;
          if (name.trim() && name !== zone.name) onRename(name.trim());
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
    </label>
  );
}
