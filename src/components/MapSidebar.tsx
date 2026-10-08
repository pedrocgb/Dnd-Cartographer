"use client";

import { useEffect, useRef, useState } from "react";
import {
  LandPlot,
  Settings,
  MapPin,
  Grid3x3,
  Shapes,
  Layers,
  Type,
  PenTool,
  ListTree,
  MousePointer2,
  ChevronsLeft,
  ChevronsRight,
  LayoutList,
  Route,
  Ruler,
} from "lucide-react";
import { isModalOpen } from "./Modal";
import { isTypingTarget } from "./keyboard";
import { SHORTCUT_KEYS, type SidebarTool } from "./shortcuts";
import { useT } from "@/i18n/useT";

/** Hovering a tool this long expands the bar to show every tool's name. */
const PEEK_DELAY_MS = 750;
/** The user's "keep expanded" choice, per browser. */
const PINNED_STORAGE_KEY = "map-sidebar-expanded";

function loadPinned(): boolean {
  try {
    return window.localStorage.getItem(PINNED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function savePinned(pinned: boolean) {
  try {
    window.localStorage.setItem(PINNED_STORAGE_KEY, pinned ? "1" : "0");
  } catch {
    // storage unavailable: the choice just isn't remembered
  }
}

export type { SidebarTool };

const TOOL_BY_KEY = new Map(Object.entries(SHORTCUT_KEYS).map(([tool, key]) => [key.toLowerCase(), tool as SidebarTool]));

const withShortcut = (tooltip: string, tool: SidebarTool) => `${tooltip} (${SHORTCUT_KEYS[tool]})`;

const btnClass = (active: boolean, extra = "") => `map-sidebar-btn${extra}${active ? " active" : ""}`;

type HoverHandlers = { onPointerEnter: () => void; onPointerLeave: () => void };

function SidebarButton({
  icon,
  label,
  title,
  className = "map-sidebar-btn",
  hover,
  shortcut,
  ...rest
}: {
  icon: React.ReactNode;
  label: string;
  title?: string;
  className?: string;
  hover: HoverHandlers;
  /** The tool whose keyboard shortcut this button shares. */
  shortcut?: SidebarTool;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title" | "className">) {
  const tooltip = title ?? label;
  return (
    <button
      className={className}
      data-tooltip={shortcut ? withShortcut(tooltip, shortcut) : tooltip}
      aria-label={label}
      aria-keyshortcuts={shortcut ? SHORTCUT_KEYS[shortcut] : undefined}
      {...hover}
      {...rest}
    >
      {icon}
      <span className="map-sidebar-label" aria-hidden>
        {label}
      </span>
    </button>
  );
}

/**
 * The map's tool bar. Collapsed it shows icons only; hovering a tool for
 * PEEK_DELAY_MS expands it over the map with every tool's name, until the
 * pointer leaves it. The arrow at the bottom keeps it expanded (it then takes
 * its own room instead of covering the map), remembered per browser.
 */
export default function MapSidebar({
  layersDisabled,
  textDisabled,
  linesDisabled,
  sceneDisabled,
  markersDisabled,
  gridDisabled,
  zonesDisabled,
  legendDisabled,
  scaleDisabled,
  areaDisabled,
  onOpenArea,
  onOpenLegend,
  onOpenScale,
  travelDisabled,
  onOpenTravel,
  onOpenSettings,
  onOpenMarkers,
  onOpenGrid,
  onOpenZones,
  onOpenLayers,
  onOpenText,
  onOpenLines,
  onOpenScene,
  selectToolOn,
  activeTool,
  onToggleSelectTool,
}: {
  layersDisabled: boolean;
  textDisabled: boolean;
  linesDisabled: boolean;
  sceneDisabled: boolean;
  markersDisabled: boolean;
  gridDisabled: boolean;
  zonesDisabled: boolean;
  legendDisabled: boolean;
  scaleDisabled: boolean;
  areaDisabled: boolean;
  onOpenArea: () => void;
  onOpenLegend: () => void;
  onOpenScale: () => void;
  travelDisabled: boolean;
  onOpenTravel: () => void;
  onOpenSettings: () => void;
  onOpenMarkers: () => void;
  onOpenGrid: () => void;
  onOpenZones: () => void;
  onOpenLayers: () => void;
  onOpenText: () => void;
  onOpenLines: () => void;
  onOpenScene: () => void;
  selectToolOn: boolean;
  /** Highlighted like the Selection tool while its screen is open. */
  activeTool: SidebarTool | null;
  onToggleSelectTool: () => void;
}) {
  const t = useT("maps");
  const [pinned, setPinned] = useState(loadPinned);
  const [peeking, setPeeking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const expanded = pinned || peeking;

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const hover: HoverHandlers = {
    onPointerEnter: () => {
      if (expanded) return;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setPeeking(true), PEEK_DELAY_MS);
    },
    onPointerLeave: () => clearTimeout(timerRef.current),
  };

  function endPeek() {
    clearTimeout(timerRef.current);
    setPeeking(false);
  }

  function togglePinned() {
    const next = !pinned;
    setPinned(next);
    savePinned(next);
    setPeeking(false);
  }

  const upload = (disabled: boolean, title: string) => (disabled ? t("rail.uploadFirst") : title);

  /** What each tool's shortcut does: the same as clicking its button (the Selection tool only turns on). */
  const toolActions: Record<SidebarTool, { disabled: boolean; run: () => void }> = {
    select: { disabled: sceneDisabled, run: () => !selectToolOn && onToggleSelectTool() },
    scene: { disabled: sceneDisabled, run: onOpenScene },
    markers: { disabled: markersDisabled, run: onOpenMarkers },
    zones: { disabled: zonesDisabled, run: onOpenZones },
    text: { disabled: textDisabled, run: onOpenText },
    lines: { disabled: linesDisabled, run: onOpenLines },
    grid: { disabled: gridDisabled, run: onOpenGrid },
    legend: { disabled: legendDisabled, run: onOpenLegend },
    scale: { disabled: scaleDisabled, run: onOpenScale },
    area: { disabled: areaDisabled, run: onOpenArea },
    travel: { disabled: travelDisabled, run: onOpenTravel },
    layers: { disabled: layersDisabled, run: onOpenLayers },
    settings: { disabled: false, run: onOpenSettings },
  };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (isTypingTarget(e.target) || isModalOpen()) return;
      const tool = TOOL_BY_KEY.get(e.key.toLowerCase());
      const action = tool && toolActions[tool];
      if (!action || action.disabled) return;
      e.preventDefault();
      action.run();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className={`map-sidebar${pinned ? " pinned" : ""}`}>
      <div className={`map-sidebar-rail${expanded ? " expanded" : ""}`} onPointerLeave={endPeek}>
        <SidebarButton
          className={btnClass(selectToolOn || activeTool === "select")}
          icon={<MousePointer2 size={19} strokeWidth={2.25} />}
          label={t("rail.selection")}
          title={upload(sceneDisabled, t("rail.selectionHint"))}
          shortcut={sceneDisabled ? undefined : "select"}
          hover={hover}
          onClick={onToggleSelectTool}
          disabled={sceneDisabled}
          aria-pressed={selectToolOn}
        />
        <SidebarButton
          icon={<ListTree size={19} strokeWidth={2.25} />}
          label={t("rail.scene")}
          className={btnClass(activeTool === "scene")}
          title={upload(sceneDisabled, t("rail.sceneHint"))}
          shortcut={sceneDisabled ? undefined : "scene"}
          hover={hover}
          onClick={onOpenScene}
          disabled={sceneDisabled}
        />
        <SidebarButton
          icon={<Layers size={19} strokeWidth={2.25} />}
          label={t("rail.layers")}
          className={btnClass(activeTool === "layers")}
          shortcut={layersDisabled ? undefined : "layers"}
          hover={hover}
          onClick={onOpenLayers}
          disabled={layersDisabled}
        />
        <div className="map-sidebar-gap" aria-hidden />
        <SidebarButton
          icon={<MapPin size={19} strokeWidth={2.25} />}
          label={t("rail.markers")}
          className={btnClass(activeTool === "markers")}
          title={upload(markersDisabled, t("rail.markersHint"))}
          shortcut={markersDisabled ? undefined : "markers"}
          hover={hover}
          onClick={onOpenMarkers}
          disabled={markersDisabled}
        />
        <SidebarButton
          icon={<Shapes size={19} strokeWidth={2.25} />}
          label={t("rail.zones")}
          className={btnClass(activeTool === "zones")}
          title={upload(zonesDisabled, t("rail.zones"))}
          shortcut={zonesDisabled ? undefined : "zones"}
          hover={hover}
          onClick={onOpenZones}
          disabled={zonesDisabled}
        />
        <SidebarButton
          icon={<Type size={19} strokeWidth={2.25} />}
          label={t("rail.text")}
          className={btnClass(activeTool === "text")}
          title={upload(textDisabled, t("rail.text"))}
          shortcut={textDisabled ? undefined : "text"}
          hover={hover}
          onClick={onOpenText}
          disabled={textDisabled}
        />
        <SidebarButton
          icon={<PenTool size={19} strokeWidth={2.25} />}
          label={t("rail.lines")}
          className={btnClass(activeTool === "lines")}
          title={upload(linesDisabled, t("rail.lines"))}
          shortcut={linesDisabled ? undefined : "lines"}
          hover={hover}
          onClick={onOpenLines}
          disabled={linesDisabled}
        />
        <div className="map-sidebar-gap" aria-hidden />
        <SidebarButton
          icon={<Ruler size={19} strokeWidth={2.25} />}
          label={t("rail.scale")}
          className={btnClass(activeTool === "scale")}
          title={upload(scaleDisabled, t("rail.scaleHint"))}
          shortcut={scaleDisabled ? undefined : "scale"}
          hover={hover}
          onClick={onOpenScale}
          disabled={scaleDisabled}
        />
        <SidebarButton
          icon={<LandPlot size={19} strokeWidth={2.25} />}
          label={t("rail.area")}
          className={btnClass(activeTool === "area")}
          title={upload(areaDisabled, t("rail.areaHint"))}
          shortcut={areaDisabled ? undefined : "area"}
          hover={hover}
          onClick={onOpenArea}
          disabled={areaDisabled}
        />
        <SidebarButton
          icon={<Route size={19} strokeWidth={2.25} />}
          label={t("rail.travel")}
          className={btnClass(activeTool === "travel")}
          title={upload(travelDisabled, t("rail.travelHint"))}
          shortcut={travelDisabled ? undefined : "travel"}
          hover={hover}
          onClick={onOpenTravel}
          disabled={travelDisabled}
        />
        <div className="map-sidebar-gap" aria-hidden />
        <SidebarButton
          icon={<Grid3x3 size={19} strokeWidth={2.25} />}
          label={t("rail.grid")}
          className={btnClass(activeTool === "grid")}
          title={upload(gridDisabled, t("rail.gridHint"))}
          shortcut={gridDisabled ? undefined : "grid"}
          hover={hover}
          onClick={onOpenGrid}
          disabled={gridDisabled}
        />
        <SidebarButton
          icon={<LayoutList size={19} strokeWidth={2.25} />}
          label={t("rail.legend")}
          className={btnClass(activeTool === "legend")}
          title={upload(legendDisabled, t("rail.legendHint"))}
          shortcut={legendDisabled ? undefined : "legend"}
          hover={hover}
          onClick={onOpenLegend}
          disabled={legendDisabled}
        />
        <div className="map-sidebar-gap" aria-hidden />
        <SidebarButton
          icon={<Settings size={19} strokeWidth={2.25} />}
          label={t("rail.settings")}
          className={btnClass(activeTool === "settings")}
          title={t("mapSettings.title")}
          shortcut="settings"
          hover={hover}
          onClick={onOpenSettings}
        />

        <button
          type="button"
          className="map-sidebar-pin"
          onClick={togglePinned}
          aria-pressed={pinned}
          aria-label={pinned ? t("rail.collapse") : t("rail.pin")}
          data-tooltip={pinned ? t("rail.collapse") : t("rail.pin")}
        >
          {pinned ? <ChevronsLeft size={16} strokeWidth={2.25} /> : <ChevronsRight size={16} strokeWidth={2.25} />}
        </button>
      </div>
    </div>
  );
}
