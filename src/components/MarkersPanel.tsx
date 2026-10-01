"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ArrowDownAZ, ArrowUpZA, Filter, MapPinned, Search, X } from "lucide-react";
import { RawIcon } from "./MarkerIcon";
import { ICONS, MARKER_CATEGORIES, DEFAULT_MARKER_CATEGORY, groupIcons, searchIcons } from "@/server/markers/icon-registry";
import { STATUS_TAGS, ENVIRONMENT_TAGS, OWNERSHIP_TAGS } from "@/server/markers/tag-registry";
import { useToggleSet } from "./useToggleSet";
import type { Marker } from "./MarkerLayer";
import type { MapLayerData } from "./layer-images";

const NONE_VALUE = "__none__";

const ICON_UNIVERSE = ICONS.map((i) => i.key);
const CATEGORY_UNIVERSE: string[] = [...MARKER_CATEGORIES];
const STATUS_UNIVERSE = [...STATUS_TAGS, NONE_VALUE];
const ENVIRONMENT_UNIVERSE = [...ENVIRONMENT_TAGS, NONE_VALUE];
const OWNERSHIP_UNIVERSE = [...OWNERSHIP_TAGS, NONE_VALUE];

function iconLabel(key: string) {
  return ICONS.find((i) => i.key === key)?.label ?? key;
}

function markerCategory(m: Marker): string {
  return m.category ?? DEFAULT_MARKER_CATEGORY;
}

function FilterSection({
  label,
  expanded,
  onToggleExpanded,
  universe,
  selected,
  allOn,
  onToggleValue,
  onSelectAll,
  onClearAll,
  renderValue,
  labelFor,
  titleFor,
}: {
  label: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  universe: string[];
  selected: Set<string>;
  allOn: boolean;
  onToggleValue: (value: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  renderValue?: (value: string) => React.ReactNode;
  /** Text label for a value (default: the value itself). */
  labelFor?: (value: string) => string;
  titleFor?: (value: string) => string;
}) {
  return (
    <div className="marker-filter-section">
      <button
        type="button"
        className="marker-filter-header"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
      >
        <span>
          {label}
          {!allOn && <span className="marker-filter-count"> ({selected.size}/{universe.length})</span>}
        </span>
        {expanded ? <ChevronUp size={14} strokeWidth={2.25} /> : <ChevronDown size={14} strokeWidth={2.25} />}
      </button>
      {expanded && (
        <div className="tag-toggle-grid">
          <button
            type="button"
            className={allOn ? "tag-toggle active" : "tag-toggle"}
            aria-pressed={allOn}
            onClick={() => (allOn ? onClearAll() : onSelectAll())}
          >
            All
          </button>
          {universe.map((value) => (
            <button
              key={value}
              type="button"
              className={[
                "tag-toggle",
                renderValue ? "tag-toggle-icon" : "",
                selected.has(value) ? "active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={selected.has(value)}
              aria-label={titleFor ? titleFor(value) : undefined}
              data-tooltip={titleFor ? titleFor(value) : undefined}
              onClick={() => onToggleValue(value)}
            >
              {renderValue ? renderValue(value) : value === NONE_VALUE ? "None" : labelFor ? labelFor(value) : value}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type SortOrder = "default" | "az" | "za";

/** Left column: every marker of the map, searchable and filterable; a row jumps to its marker. */
function MarkersList({ markers, layers, onSelect }: { markers: Marker[]; layers: MapLayerData[]; onSelect: (markerId: string) => void }) {
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("default");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const iconFilter = useToggleSet(ICON_UNIVERSE);
  const categoryFilter = useToggleSet(CATEGORY_UNIVERSE);
  const statusFilter = useToggleSet(STATUS_UNIVERSE);
  const environmentFilter = useToggleSet(ENVIRONMENT_UNIVERSE);
  const ownershipFilter = useToggleSet(OWNERSHIP_UNIVERSE);

  // Layers load (and change) after mount, so this filter tracks what's
  // excluded rather than useToggleSet's fixed initial universe.
  const [excludedLayers, setExcludedLayers] = useState<Set<string>>(() => new Set());
  const layerUniverse = useMemo(() => layers.map((l) => l.id), [layers]);
  const layerSelected = useMemo(() => new Set(layerUniverse.filter((id) => !excludedLayers.has(id))), [layerUniverse, excludedLayers]);
  const layerAllOn = layerSelected.size === layerUniverse.length;
  const layerNames = useMemo(() => new Map(layers.map((l) => [l.id, l.name])), [layers]);
  const layerName = (id: string) => layerNames.get(id) ?? "";
  function toggleLayer(id: string) {
    setExcludedLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = markers.filter((m) => {
      if (q && !m.name.toLowerCase().includes(q)) return false;
      if (!layerAllOn && !layerSelected.has(m.layerId ?? "")) return false;
      if (!iconFilter.allOn && !iconFilter.selected.has(m.iconKey)) return false;
      if (!categoryFilter.allOn && !categoryFilter.selected.has(markerCategory(m))) return false;
      if (!statusFilter.allOn) {
        const hasNone = m.statusTags.length === 0;
        const matches = hasNone ? statusFilter.selected.has(NONE_VALUE) : m.statusTags.some((t) => statusFilter.selected.has(t));
        if (!matches) return false;
      }
      if (!environmentFilter.allOn && !environmentFilter.selected.has(m.environment ?? NONE_VALUE)) return false;
      if (!ownershipFilter.allOn && !ownershipFilter.selected.has(m.ownership ?? NONE_VALUE)) return false;
      return true;
    });

    if (sortOrder !== "default") {
      result = [...result].sort((a, b) =>
        sortOrder === "az" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      );
    }
    return result;
  }, [
    markers,
    search,
    sortOrder,
    layerAllOn,
    layerSelected,
    iconFilter.allOn,
    iconFilter.selected,
    categoryFilter.allOn,
    categoryFilter.selected,
    statusFilter.allOn,
    statusFilter.selected,
    environmentFilter.allOn,
    environmentFilter.selected,
    ownershipFilter.allOn,
    ownershipFilter.selected,
  ]);

  return (
    <>
      <div className="marker-search-row">
        <input
          type="text"
          placeholder="Search markers…"
          aria-label="Search markers"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-icon"
          data-tooltip={sortOrder === "az" ? "Sorted A–Z" : sortOrder === "za" ? "Sorted Z–A" : "Sort alphabetically"}
          aria-label="Toggle alphabetical sort"
          onClick={() => setSortOrder((prev) => (prev === "default" ? "az" : prev === "az" ? "za" : "default"))}
        >
          {sortOrder === "za" ? (
            <ArrowUpZA size={16} strokeWidth={2.25} />
          ) : (
            <ArrowDownAZ size={16} strokeWidth={2.25} />
          )}
        </button>
      </div>

      <div className="marker-filter-list">
        {layers.length > 1 && (
          <FilterSection
            label="Layer"
            expanded={Boolean(expanded.layer)}
            onToggleExpanded={() => toggleExpanded("layer")}
            universe={layerUniverse}
            selected={layerSelected}
            allOn={layerAllOn}
            onToggleValue={toggleLayer}
            onSelectAll={() => setExcludedLayers(new Set())}
            onClearAll={() => setExcludedLayers(new Set(layerUniverse))}
            labelFor={layerName}
          />
        )}
        <FilterSection
          label="Icon"
          expanded={Boolean(expanded.icon)}
          onToggleExpanded={() => toggleExpanded("icon")}
          universe={ICON_UNIVERSE}
          selected={iconFilter.selected}
          allOn={iconFilter.allOn}
          onToggleValue={iconFilter.toggle}
          onSelectAll={iconFilter.selectAll}
          onClearAll={iconFilter.clearAll}
          renderValue={(key) => <RawIcon iconKey={key} size={16} />}
          titleFor={iconLabel}
        />
        <FilterSection
          label="Category"
          expanded={Boolean(expanded.category)}
          onToggleExpanded={() => toggleExpanded("category")}
          universe={CATEGORY_UNIVERSE}
          selected={categoryFilter.selected}
          allOn={categoryFilter.allOn}
          onToggleValue={categoryFilter.toggle}
          onSelectAll={categoryFilter.selectAll}
          onClearAll={categoryFilter.clearAll}
        />
        <FilterSection
          label="Status"
          expanded={Boolean(expanded.status)}
          onToggleExpanded={() => toggleExpanded("status")}
          universe={STATUS_UNIVERSE}
          selected={statusFilter.selected}
          allOn={statusFilter.allOn}
          onToggleValue={statusFilter.toggle}
          onSelectAll={statusFilter.selectAll}
          onClearAll={statusFilter.clearAll}
        />
        <FilterSection
          label="Environment"
          expanded={Boolean(expanded.environment)}
          onToggleExpanded={() => toggleExpanded("environment")}
          universe={ENVIRONMENT_UNIVERSE}
          selected={environmentFilter.selected}
          allOn={environmentFilter.allOn}
          onToggleValue={environmentFilter.toggle}
          onSelectAll={environmentFilter.selectAll}
          onClearAll={environmentFilter.clearAll}
        />
        <FilterSection
          label="Ownership"
          expanded={Boolean(expanded.ownership)}
          onToggleExpanded={() => toggleExpanded("ownership")}
          universe={OWNERSHIP_UNIVERSE}
          selected={ownershipFilter.selected}
          allOn={ownershipFilter.allOn}
          onToggleValue={ownershipFilter.toggle}
          onSelectAll={ownershipFilter.selectAll}
          onClearAll={ownershipFilter.clearAll}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="field-label">
          {markers.length === 0 ? "No markers on this map yet." : "No markers match your search/filters."}
        </p>
      ) : (
        <ul className="marker-list">
          {filtered.map((m) => (
            <li key={m.id}>
              <button
                className="marker-list-row"
                onClick={() => onSelect(m.id)}
              >
                <span className="marker-list-icon" style={{ color: m.color }}>
                  <RawIcon iconKey={m.iconKey} size={16} />
                </span>
                {m.name}
                {layers.length > 1 && m.layerId && <span className="marker-list-layer">{layerName(m.layerId)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Right column: which icons show on the map (never changes marker data). */
function IconFilter({
  selected,
  allOn,
  onToggle,
  onSelectAll,
  onClearAll,
}: {
  selected: Set<string>;
  allOn: boolean;
  onToggle: (iconKey: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  const [query, setQuery] = useState("");
  const groups = groupIcons(searchIcons(query));
  return (
    <>
      <p className="field-label">Toggle an icon off to hide every marker using it. This never changes marker data.</p>

      <button
        type="button"
        className={allOn ? "icon-filter-row active" : "icon-filter-row"}
        aria-pressed={allOn}
        onClick={() => (allOn ? onClearAll() : onSelectAll())}
      >
        <span className="icon-filter-row-label">All</span>
      </button>

      <label className="icon-picker-search">
        <Search size={14} strokeWidth={2.25} aria-hidden />
        <input type="text" value={query} placeholder="Search icons" aria-label="Search icons" onChange={(e) => setQuery(e.target.value)} />
      </label>

      {groups.map(({ group, icons }) => (
        <section key={group} className="icon-picker-group" aria-label={group}>
          <h4>{group}</h4>
          <ul className="icon-filter-list">
            {icons.map((icon) => {
              const active = selected.has(icon.key);
              return (
                <li key={icon.key}>
                  <button
                    type="button"
                    className={active ? "icon-filter-row active" : "icon-filter-row"}
                    aria-pressed={active}
                    onClick={() => onToggle(icon.key)}
                  >
                    <RawIcon iconKey={icon.key} size={16} />
                    <span className="icon-filter-row-label">{icon.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

/**
 * The Markers tool: a lateral panel with the map's markers (left) beside
 * the icon filter (right), both open together like the other tools'
 * list-and-settings panels.
 */
export default function MarkersPanel({
  markers,
  layers,
  onSelectMarker,
  iconFilter,
  onClose,
}: {
  markers: Marker[];
  layers: MapLayerData[];
  onSelectMarker: (markerId: string) => void;
  iconFilter: { selected: Set<string>; allOn: boolean; toggle: (iconKey: string) => void; selectAll: () => void; clearAll: () => void };
  onClose: () => void;
}) {
  return (
    <div className="markers-panel" aria-label="Markers">
      <section className="markers-panel-col" aria-labelledby="markers-panel-list-title">
        <div className="marker-side-panel-header">
          <h2 id="markers-panel-list-title">
            <MapPinned size={16} strokeWidth={2.25} aria-hidden />
            Markers on this map
          </h2>
        </div>
        <MarkersList markers={markers} layers={layers} onSelect={onSelectMarker} />
      </section>
      <section className="markers-panel-col markers-panel-filter" aria-labelledby="markers-panel-filter-title">
        <div className="marker-side-panel-header">
          <h2 id="markers-panel-filter-title">
            <Filter size={16} strokeWidth={2.25} aria-hidden />
            Filter markers
          </h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close the markers panel" data-tooltip="Close">
            <X size={16} strokeWidth={2.25} />
          </button>
        </div>
        <IconFilter selected={iconFilter.selected} allOn={iconFilter.allOn} onToggle={iconFilter.toggle} onSelectAll={iconFilter.selectAll} onClearAll={iconFilter.clearAll} />
      </section>
    </div>
  );
}
