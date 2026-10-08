"use client";

import { formatInteger } from "@/server/settings/number-format";
import { useState } from "react";
import { ChevronRight, Circle, Hexagon, LandPlot, Ruler, Square, Trash2, X } from "lucide-react";
import { useSettings } from "@/components/settings/SettingsProvider";
import MarkerCard from "@/components/marker-panel/MarkerCard";
import { areaReadings, formatArea, formatLength, shapeAreaPx, shapePerimeterPx, splitReadings, type AreaReading } from "@/server/scale/area";
import { formatNumber, type ScaleConfig } from "@/server/scale/scale-config";
import type { AreaTool, MeasuredShape } from "./AreaLayer";
import { useT } from "@/i18n/useT";
import type { MessageKey } from "@/i18n/messages";

const TOOLS: { tool: AreaTool; label: MessageKey<"maps">; tip: MessageKey<"maps">; Icon: typeof Square }[] = [
  { tool: "rectangle", label: "zones.shape.rectangle", tip: "area.rectangleHint", Icon: Square },
  { tool: "circle", label: "zones.shape.circle", tip: "zones.tool.circleHint", Icon: Circle },
  { tool: "polygon", label: "zones.shape.polygon", tip: "zones.tool.polygonHint", Icon: Hexagon },
];

const SHAPE_ICON = { rectangle: Square, circle: Circle, polygon: Hexagon, area: Hexagon } as const;
const SHAPE_NAME = { rectangle: "zones.shape.rectangle", circle: "zones.shape.circle", polygon: "zones.shape.polygon", area: "panel.area" } as const;

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

/**
 * The Area tool's panel: shape tools, the shapes measured so far (each with
 * its area; pick one to read it alone), and the area in every unit — of the
 * picked shape, or of all of them together. Nothing here is saved.
 */
export default function AreaPanel({
  tool,
  onSetTool,
  shapes,
  selectedId,
  onSelect,
  onRemove,
  onClear,
  config,
  onOpenScale,
  onClose,
}: {
  tool: AreaTool;
  onSetTool: (tool: AreaTool) => void;
  shapes: MeasuredShape[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  config: ScaleConfig;
  onOpenScale: () => void;
  onClose: () => void;
}) {
  const t = useT("maps");
  const tc = useT("common");
  const { settings } = useSettings();
  const calibrated = config.framePxPerUnit !== null;
  const selected = shapes.find((s) => s.id === selectedId) ?? null;
  const single = selected ?? (shapes.length === 1 ? shapes[0] : null);
  const totalPx = shapes.reduce((sum, s) => sum + shapeAreaPx(s.shape), 0);
  const nameOf = (s: MeasuredShape) => t("area.shapeName", { shape: t(SHAPE_NAME[s.shape.kind]), n: shapes.indexOf(s) + 1 });

  return (
    <div className="grid-panel area-panel">
      <div className="marker-side-panel-header">
        <h2>
          <LandPlot size={16} strokeWidth={2.25} style={{ verticalAlign: "-2px", marginRight: "6px" }} />
          {t("panel.area")}
        </h2>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={tc("closePanel", { title: t("panel.area") })}>
          <X size={16} strokeWidth={2.25} />
        </button>
      </div>

      {!calibrated && (
        <div className="area-calibrate">
          <p className="field-label">{t("area.noScale")}</p>
          <button type="button" className="btn btn-sm" onClick={onOpenScale}>
            <Ruler size={14} strokeWidth={2.25} />
            {t("area.calibrate")}
          </button>
        </div>
      )}

      <div className="zone-tool-row" role="toolbar" aria-label={t("area.shape")}>
        {TOOLS.map((item) => (
          <button key={item.tool} type="button" className={tool === item.tool ? "active" : ""} aria-label={t(item.label)} aria-pressed={tool === item.tool} data-tooltip={t(item.tip)} onClick={() => onSetTool(item.tool)}>
            <item.Icon size={15} strokeWidth={2.25} />
          </button>
        ))}
      </div>

      <MarkerCard title={shapes.length ? t("area.shapesCount", { n: shapes.length }) : t("area.shapes")} defaultOpen>
        {shapes.length === 0 ? (
          <p className="field-label">{t("area.empty")}</p>
        ) : (
          <>
            <ul className="area-shape-list">
              {shapes.map((s) => {
                const Icon = SHAPE_ICON[s.shape.kind];
                const px = shapeAreaPx(s.shape);
                return (
                  <li key={s.id} className={s.id === selectedId ? "selected" : ""}>
                    <button type="button" className="area-shape-pick" aria-pressed={s.id === selectedId} onClick={() => onSelect(s.id === selectedId ? null : s.id)}>
                      <Icon size={14} strokeWidth={2.25} aria-hidden />
                      <span>{nameOf(s)}</span>
                      <span className="field-label">{formatArea(px, config, settings.lengthSystem) ?? `${formatInteger(px)} px²`}</span>
                    </button>
                    <button type="button" className="btn btn-ghost btn-icon" aria-label={t("area.removeNamed", { name: nameOf(s) })} data-tooltip={t("area.remove")} onClick={() => onRemove(s.id)}>
                      <X size={14} strokeWidth={2.25} />
                    </button>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="btn btn-sm" onClick={onClear}>
              <Trash2 size={14} strokeWidth={2.25} />
              {t("area.clearAll")}
            </button>
          </>
        )}
      </MarkerCard>

      {shapes.length > 0 && calibrated && (
        <MarkerCard title={single ? nameOf(single) : t("area.total", { n: shapes.length })} defaultOpen>
          {single ? (
            <AreaReadings areaPx={shapeAreaPx(single.shape)} perimeterPx={shapePerimeterPx(single.shape)} config={config} />
          ) : (
            <AreaReadings areaPx={totalPx} config={config} />
          )}
          {selected && shapes.length > 1 && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onSelect(null)}>
              {t("area.showTotal")}
            </button>
          )}
        </MarkerCard>
      )}
    </div>
  );
}
