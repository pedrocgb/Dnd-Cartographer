"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { RawIcon } from "./MarkerIcon";
import { groupIcons, searchIcons } from "@/server/markers/icon-registry";
import { useT } from "@/i18n/useT";

/** The marker icon grid: a search box over labels and synonyms, icons grouped by section. */
export default function IconPicker({ value, onChange }: { value: string; onChange: (iconKey: string) => void }) {
  const t = useT("common");
  const [query, setQuery] = useState("");
  const groups = groupIcons(searchIcons(query));
  return (
    <div className="icon-picker">
      <label className="icon-picker-search">
        <Search size={14} strokeWidth={2.25} aria-hidden />
        <input type="text" value={query} placeholder={t("iconPicker.placeholder")} aria-label={t("iconPicker.label")} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {groups.length === 0 && <p className="field-label">{t("iconPicker.noMatch", { query })}</p>}
      {groups.map(({ group, icons }) => (
        <section key={group} className="icon-picker-group" aria-label={group}>
          <h4>{group}</h4>
          <div className="icon-grid">
            {icons.map((icon) => (
              <button
                key={icon.key}
                type="button"
                className={icon.key === value ? "active" : ""}
                data-tooltip={icon.label}
                aria-label={icon.label}
                aria-pressed={icon.key === value}
                onClick={() => onChange(icon.key)}
              >
                <RawIcon iconKey={icon.key} size={16} />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
