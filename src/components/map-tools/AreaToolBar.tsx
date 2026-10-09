"use client";

import { Circle, Hexagon, Layers, Ruler, Square, Trash2, X } from "lucide-react";
import { formatInteger } from "@/server/settings/number-format";
import { useSettings } from "@/components/settings/SettingsProvider";
import { formatArea, shapeAreaPx, shapePerimeterPx } from "@/server/scale/area";
import type { ScaleConfig } from "@/server/scale/scale-config";
import type { AreaTool, MeasuredShape } from "../map-hud/AreaLayer";
import { AreaReadings } from "../map-hud/area-readings";
import { useT } from "@/i18n/useT";
import type { MessageKey } from "@/i18n/messages";
import { ToolBar, ToolBarButton, ToolBarDivider, ToolBarPopover } from "./ToolBar";

const TOOLS: { tool: AreaTool; label: MessageKey<"maps">; tip: MessageKey<"maps">; Icon: typeof Square }[] = [
  { tool: "rectangle", label: "zones.shape.rectangle", tip: "area.rectangleHint", Icon: Square },
  { tool: "circle", label: "zones.shape.circle", tip: "zones.tool.circleHint", Icon: Circle },
  { tool: "polygon", label: "zones.shape.polygon", tip: "zones.tool.polygonHint", Icon: Hexagon },
];

const SHAPE_ICON = { rectangle: Square, circle: Circle, polygon: Hexagon, area: Hexagon } as const;
const SHAPE_NAME = { rectangle: "zones.shape.rectangle", circle: "zones.shape.circle", polygon: "zones.shape.polygon", area: "panel.area" } as const;

/**
 * The Area tool's bar: the shape to draw, the area measured (of the picked
 * shape, or all of them together; every unit in its popover), the shapes
 * measured so far, and Clear. Nothing here is saved.
 */
export default function AreaToolBar({
  inset,
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
  /** Where the map's free part starts (right of the side panel). */
  inset: number;
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
  const areaPx = single ? shapeAreaPx(single.shape) : shapes.reduce((sum, s) => sum + shapeAreaPx(s.shape), 0);
  const readout = (px: number) => formatArea(px, config, settings.lengthSystem) ?? t("areaBar.px", { n: formatInteger(px) });
  const nameOf = (s: MeasuredShape) => t("area.shapeName", { shape: t(SHAPE_NAME[s.shape.kind]), n: shapes.indexOf(s) + 1 });
  const title = single ? nameOf(single) : t("area.total", { n: shapes.length });

  return (
    <ToolBar label={t("areaBar.label")} inset={inset}>
      {TOOLS.map((item) => (
        <ToolBarButton key={item.tool} Icon={item.Icon} label={t(item.label)} hint={t(item.tip)} pressed={tool === item.tool} onClick={() => onSetTool(item.tool)} />
      ))}
      <ToolBarDivider />
      <ToolBarPopover
        label={t("areaBar.readout")}
        hint={shapes.length ? title : t("area.empty")}
        disabled={shapes.length === 0}
        face={<span className="tool-bar-value tool-bar-readout">{shapes.length ? readout(areaPx) : t("areaBar.none")}</span>}
      >
        <div className="tool-bar-pop-fields">
          <span className="field-label">{title}</span>
          {calibrated ? (
            <AreaReadings areaPx={areaPx} perimeterPx={single ? shapePerimeterPx(single.shape) : undefined} config={config} />
          ) : (
            <p className="field-label">{t("area.noScale")}</p>
          )}
          {selected && shapes.length > 1 && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onSelect(null)}>
              {t("area.showTotal")}
            </button>
          )}
        </div>
      </ToolBarPopover>
      <ToolBarPopover
        label={shapes.length ? t("area.shapesCount", { n: shapes.length }) : t("area.shapes")}
        hint={t("areaBar.shapesHint")}
        disabled={shapes.length === 0}
        face={
          <>
            <Layers size={16} strokeWidth={2.25} aria-hidden />
            <span className="tool-bar-value">{formatInteger(shapes.length)}</span>
          </>
        }
      >
        <ul className="area-shape-list">
          {shapes.map((s) => {
            const Icon = SHAPE_ICON[s.shape.kind];
            return (
              <li key={s.id} className={s.id === selectedId ? "selected" : ""}>
                <button type="button" className="area-shape-pick" aria-pressed={s.id === selectedId} onClick={() => onSelect(s.id === selectedId ? null : s.id)}>
                  <Icon size={14} strokeWidth={2.25} aria-hidden />
                  <span>{nameOf(s)}</span>
                  <span className="field-label">{readout(shapeAreaPx(s.shape))}</span>
                </button>
                <button type="button" className="btn btn-ghost btn-icon" aria-label={t("area.removeNamed", { name: nameOf(s) })} data-tooltip={t("area.remove")} onClick={() => onRemove(s.id)}>
                  <X size={14} strokeWidth={2.25} />
                </button>
              </li>
            );
          })}
        </ul>
      </ToolBarPopover>
      <ToolBarButton Icon={Trash2} danger label={t("area.clearAll")} disabled={shapes.length === 0} onClick={onClear} />
      {!calibrated && (
        <ToolBarButton Icon={Ruler} label={t("area.calibrate")} hint={t("area.noScale")} onClick={onOpenScale}>
          <span>{t("areaBar.calibrate")}</span>
        </ToolBarButton>
      )}
      <ToolBarDivider />
      <ToolBarButton Icon={X} label={tc("closePanel", { title: t("panel.area") })} onClick={onClose} />
    </ToolBar>
  );
}
