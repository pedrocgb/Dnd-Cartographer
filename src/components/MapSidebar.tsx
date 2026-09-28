"use client";

import { useEffect, useRef, useState } from "react";
import {
  Settings,
  MapPin,
  MapPinned,
  MapPinPlus,
  Grid3x3,
  Shapes,
  Filter,
  Layers,
  Type,
  PenTool,
  ListTree,
  MousePointer2,
  Trash2,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { isModalOpen } from "./Modal";
import { isTypingTarget } from "./keyboard";

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

/** The sidebar tool whose screen (panel, modal or mode) is currently open. */
export type SidebarTool = "select" | "scene" | "layers" | "markers" | "zones" | "lines" | "text" | "grid" | "settings";

/** Single-key shortcuts (no modifiers) that open each tool, shown in its tooltip. */
const SHORTCUT_KEYS: Record<SidebarTool, string> = {
  select: "V",
  scene: "S",
  markers: "M",
  zones: "Z",
  text: "T",
  lines: "P",
  grid: "G",
  layers: "L",
  settings: ",",
};
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
  buttonRef,
  shortcut,
  ...rest
}: {
  icon: React.ReactNode;
  label: string;
  title?: string;
  className?: string;
  hover: HoverHandlers;
  buttonRef?: React.Ref<HTMLButtonElement>;
  /** The tool whose keyboard shortcut this button shares. */
  shortcut?: SidebarTool;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title" | "className">) {
  const tooltip = title ?? label;
  return (
    <button
      ref={buttonRef}
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
 * Markers button: a small menu beside the sidebar with the marker tools.
 * Opening it closes whatever tool was open. Follows the menu-button
 * pattern: ↑/↓ move, Esc closes and returns focus to the button, a pick or a
 * click outside closes it.
 */
function MarkersMenu({
  active,
  disabled,
  filterDisabled,
  hover,
  open,
  onOpenChange,
  onOpen,
  onAddMarker,
  onOpenMarkers,
  onOpenIconFilter,
}: {
  /** A marker tool is in use (placing, editing, the list or the icon filter). */
  active: boolean;
  disabled: boolean;
  filterDisabled: boolean;
  hover: HoverHandlers;
  /** Owned by the sidebar, so another tool's shortcut can close the menu. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpen: () => void;
  onAddMarker: () => void;
  onOpenMarkers: () => void;
  onOpenIconFilter: () => void;
}) {
  const setOpen = onOpenChange;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open, setOpen]);

  function toggle() {
    if (!open) onOpen();
    setOpen(!open);
  }

  function pick(action: () => void) {
    setOpen(false);
    action();
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

  return (
    <div className="map-sidebar-menu-root" ref={rootRef}>
      <SidebarButton
        buttonRef={buttonRef}
        className={btnClass(open || active)}
        icon={<MapPin size={19} strokeWidth={2.25} />}
        label="Markers"
        title={disabled ? "Upload an image first" : "Markers"}
        shortcut={disabled ? undefined : "markers"}
        hover={hover}
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
      />
      {open && (
        <div className="map-sidebar-menu" role="menu" aria-label="Markers" ref={menuRef} onKeyDown={onMenuKeyDown}>
          <button type="button" role="menuitem" className="map-sidebar-menu-item" onClick={() => pick(onAddMarker)}>
            <MapPinPlus size={15} strokeWidth={2.25} />
            Add marker
          </button>
          <button type="button" role="menuitem" className="map-sidebar-menu-item" onClick={() => pick(onOpenMarkers)}>
            <MapPinned size={15} strokeWidth={2.25} />
            Markers on this map
          </button>
          <button
            type="button"
            role="menuitem"
            className="map-sidebar-menu-item"
            disabled={filterDisabled}
            onClick={() => pick(onOpenIconFilter)}
          >
            <Filter size={15} strokeWidth={2.25} />
            Filter markers by icon
          </button>
        </div>
      )}
    </div>
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
  iconFilterDisabled,
  onOpenSettings,
  onOpenMarkers,
  onOpenGrid,
  onOpenZones,
  onOpenIconFilter,
  onOpenLayers,
  onOpenText,
  onOpenLines,
  onOpenScene,
  selectToolOn,
  activeTool,
  onToggleSelectTool,
  onOpenMarkersMenu,
  onAddMarker,
  onDeleteMap,
}: {
  layersDisabled: boolean;
  textDisabled: boolean;
  linesDisabled: boolean;
  sceneDisabled: boolean;
  markersDisabled: boolean;
  gridDisabled: boolean;
  zonesDisabled: boolean;
  iconFilterDisabled: boolean;
  onOpenSettings: () => void;
  onOpenMarkers: () => void;
  onOpenGrid: () => void;
  onOpenZones: () => void;
  onOpenIconFilter: () => void;
  onOpenLayers: () => void;
  onOpenText: () => void;
  onOpenLines: () => void;
  onOpenScene: () => void;
  selectToolOn: boolean;
  /** Highlighted like the Selection tool while its screen is open. */
  activeTool: SidebarTool | null;
  onToggleSelectTool: () => void;
  /** Opening the Markers menu closes whichever tool is open. */
  onOpenMarkersMenu: () => void;
  /** Same as the map toolbar's Add marker button. */
  onAddMarker: () => void;
  onDeleteMap: () => void;
}) {
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

  const upload = (disabled: boolean, title: string) => (disabled ? "Upload an image first" : title);
  const [markersMenuOpen, setMarkersMenuOpen] = useState(false);

  /** What each tool's shortcut does: the same as clicking its button (the Selection tool only turns on). */
  const toolActions: Record<SidebarTool, { disabled: boolean; run: () => void }> = {
    select: { disabled: sceneDisabled, run: () => !selectToolOn && onToggleSelectTool() },
    scene: { disabled: sceneDisabled, run: onOpenScene },
    markers: {
      disabled: markersDisabled,
      run: () => {
        onOpenMarkersMenu();
        setMarkersMenuOpen(true);
      },
    },
    zones: { disabled: zonesDisabled, run: onOpenZones },
    text: { disabled: textDisabled, run: onOpenText },
    lines: { disabled: linesDisabled, run: onOpenLines },
    grid: { disabled: gridDisabled, run: onOpenGrid },
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
      // Only one tool at a time: any other tool's shortcut closes the Markers menu.
      if (tool !== "markers") setMarkersMenuOpen(false);
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
          label="Selection"
          title={upload(sceneDisabled, "Select: click anything on this layer to edit it")}
          shortcut={sceneDisabled ? undefined : "select"}
          hover={hover}
          onClick={onToggleSelectTool}
          disabled={sceneDisabled}
          aria-pressed={selectToolOn}
        />
        <SidebarButton
          icon={<ListTree size={19} strokeWidth={2.25} />}
          label="Scene"
          className={btnClass(activeTool === "scene")}
          title={upload(sceneDisabled, "Scene: everything on this layer")}
          shortcut={sceneDisabled ? undefined : "scene"}
          hover={hover}
          onClick={onOpenScene}
          disabled={sceneDisabled}
        />
        <MarkersMenu
          active={activeTool === "markers"}
          disabled={markersDisabled}
          filterDisabled={iconFilterDisabled}
          hover={hover}
          open={markersMenuOpen}
          onOpenChange={setMarkersMenuOpen}
          onOpen={onOpenMarkersMenu}
          onAddMarker={onAddMarker}
          onOpenMarkers={onOpenMarkers}
          onOpenIconFilter={onOpenIconFilter}
        />
        <SidebarButton
          icon={<Shapes size={19} strokeWidth={2.25} />}
          label="Zones"
          className={btnClass(activeTool === "zones")}
          title={upload(zonesDisabled, "Zones")}
          shortcut={zonesDisabled ? undefined : "zones"}
          hover={hover}
          onClick={onOpenZones}
          disabled={zonesDisabled}
        />
        <SidebarButton
          icon={<Type size={19} strokeWidth={2.25} />}
          label="Text"
          className={btnClass(activeTool === "text")}
          title={upload(textDisabled, "Text")}
          shortcut={textDisabled ? undefined : "text"}
          hover={hover}
          onClick={onOpenText}
          disabled={textDisabled}
        />
        <SidebarButton
          icon={<PenTool size={19} strokeWidth={2.25} />}
          label="Lines"
          className={btnClass(activeTool === "lines")}
          title={upload(linesDisabled, "Lines")}
          shortcut={linesDisabled ? undefined : "lines"}
          hover={hover}
          onClick={onOpenLines}
          disabled={linesDisabled}
        />
        <SidebarButton
          icon={<Grid3x3 size={19} strokeWidth={2.25} />}
          label="Grid"
          className={btnClass(activeTool === "grid")}
          title={upload(gridDisabled, "Grid overlay")}
          shortcut={gridDisabled ? undefined : "grid"}
          hover={hover}
          onClick={onOpenGrid}
          disabled={gridDisabled}
        />
        <SidebarButton
          icon={<Layers size={19} strokeWidth={2.25} />}
          label="Layers"
          className={btnClass(activeTool === "layers")}
          shortcut={layersDisabled ? undefined : "layers"}
          hover={hover}
          onClick={onOpenLayers}
          disabled={layersDisabled}
        />
        <SidebarButton
          icon={<Settings size={19} strokeWidth={2.25} />}
          label="Settings"
          className={btnClass(activeTool === "settings")}
          title="Map settings"
          shortcut="settings"
          hover={hover}
          onClick={onOpenSettings}
        />
        <SidebarButton
          className="map-sidebar-btn danger"
          icon={<Trash2 size={19} strokeWidth={2.25} />}
          label="Delete Map"
          hover={hover}
          onClick={onDeleteMap}
        />

        <button
          type="button"
          className="map-sidebar-pin"
          onClick={togglePinned}
          aria-pressed={pinned}
          aria-label={pinned ? "Collapse the tool bar" : "Keep the tool bar expanded"}
          data-tooltip={pinned ? "Collapse the tool bar" : "Keep the tool bar expanded"}
        >
          {pinned ? <ChevronsLeft size={16} strokeWidth={2.25} /> : <ChevronsRight size={16} strokeWidth={2.25} />}
        </button>
      </div>
    </div>
  );
}
