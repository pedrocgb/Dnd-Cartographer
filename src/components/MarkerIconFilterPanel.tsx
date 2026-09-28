"use client";

import { useState } from "react";
import { X, Filter, Search } from "lucide-react";
import { RawIcon } from "./MarkerIcon";
import { groupIcons, searchIcons } from "@/server/markers/icon-registry";

export default function MarkerIconFilterPanel({
  selected,
  allOn,
  onToggle,
  onSelectAll,
  onClearAll,
  onClose,
}: {
  selected: Set<string>;
  allOn: boolean;
  onToggle: (iconKey: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const groups = groupIcons(searchIcons(query));
  return (
    <div className="icon-filter-panel">
      <div className="marker-side-panel-header">
        <h2>
          <Filter size={16} strokeWidth={2.25} style={{ verticalAlign: "-2px", marginRight: "6px" }} />
          Filter markers
        </h2>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close icon filter panel">
          <X size={16} strokeWidth={2.25} />
        </button>
      </div>

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
    </div>
  );
}
