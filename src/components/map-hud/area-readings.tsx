"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useSettings } from "@/components/settings/SettingsProvider";
import { areaReadings, formatLength, splitReadings, type AreaReading } from "@/server/scale/area";
import { formatNumber, type ScaleConfig } from "@/server/scale/scale-config";
import { useT } from "@/i18n/useT";

function ReadingRow({ reading, primary = false }: { reading: AreaReading; primary?: boolean }) {
  return (
    <div className={primary ? "area-reading primary" : "area-reading"}>
      <dt>{reading.unit}</dt>
      <dd>{formatNumber(reading.value)}</dd>
    </div>
  );
}

/**
 * The area in every unit it converts to: the units of the user's
 * measurement system (Settings) on top, the others behind "Show more"; the
 * perimeter always shows.
 */
export function AreaReadings({ areaPx, perimeterPx, config }: { areaPx: number; perimeterPx?: number; config: ScaleConfig }) {
  const t = useT("maps");
  const { settings } = useSettings();
  const [expanded, setExpanded] = useState(false);
  const { main, more } = splitReadings(areaReadings(areaPx, config), settings.lengthSystem);
  const perimeter = perimeterPx === undefined ? null : formatLength(perimeterPx, config);
  return (
    <dl className="area-readings">
      {main.map((r, i) => (
        <ReadingRow key={r.key} reading={r} primary={i === 0} />
      ))}
      {more.length > 0 && (
        <button type="button" className="area-more" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
          <ChevronRight size={13} strokeWidth={2.25} className={expanded ? "marker-collapsible-chevron open" : "marker-collapsible-chevron"} aria-hidden />
          {expanded ? t("area.showLess") : t("area.showMore")}
        </button>
      )}
      {expanded && more.map((r) => <ReadingRow key={r.key} reading={r} />)}
      {perimeter && (
        <div className="area-reading perimeter">
          <dt>{t("area.perimeter")}</dt>
          <dd>{perimeter}</dd>
        </div>
      )}
    </dl>
  );
}
