"use client";

import { useState } from "react";
import { Diamond, Hexagon, Link2, Move, Square, Trash2, X, type LucideIcon } from "lucide-react";
import ColorWheel from "../ColorWheel";
import ConfirmDialog from "../ConfirmDialog";
import Toggle from "../Toggle";
import { SliderField } from "../SliderField";
import type { MapGrid } from "../GridLayer";
import { DEFAULT_GRID, GRID_SHAPES, MAX_GRID_LINES, computeLinkedColumns, computeLinkedRows, type GridShape } from "@/server/grid/grid-config";
import { formatInteger } from "@/server/settings/number-format";
import { useT } from "@/i18n/useT";
import { Swatch, ToolBar, ToolBarButton, ToolBarDivider, ToolBarPopover } from "./ToolBar";

export type GridPatch = Partial<Pick<MapGrid, "shape" | "columns" | "rows" | "linkedColumnsRows" | "horizontalOffset" | "verticalOffset" | "opacity" | "lineWidth" | "color">>;

/** The flat-top hexagon turned 90° (points up). */
function VerticalHexagon(props: React.ComponentProps<typeof Hexagon>) {
  return <Hexagon {...props} style={{ transform: "rotate(90deg)" }} />;
}

const SHAPE_ICONS: Record<GridShape, LucideIcon | typeof VerticalHexagon> = {
  diamond: Diamond,
  square: Square,
  hexagon: Hexagon,
  "hexagon-vertical": VerticalHexagon,
};

/**
 * The Grid tool's bar: the active layer's grid (one per layer, made when the
 * tool opens). Shape, size, offset (typed, or dragged on the map with Align),
 * lines and color; then Delete.
 */
export default function GridToolBar({
  inset,
  layerName,
  grid,
  imageWidth,
  imageHeight,
  aligning,
  onSetAligning,
  onUpdate,
  onDelete,
  onClose,
}: {
  /** Where the map's free part starts (right of the side panel). */
  inset: number;
  layerName: string;
  grid: MapGrid;
  imageWidth: number;
  imageHeight: number;
  /** Dragging on the map moves the grid. */
  aligning: boolean;
  onSetAligning: (on: boolean) => void;
  onUpdate: (patch: GridPatch) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = useT("maps");
  const tc = useT("common");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const shape = grid.shape as GridShape;
  const ShapeIcon = SHAPE_ICONS[shape] ?? Square;
  const linkedRows = (columns: number, s: GridShape) => computeLinkedRows(columns, s, imageWidth, imageHeight);

  const setShape = (next: GridShape) => onUpdate(grid.linkedColumnsRows ? { shape: next, rows: linkedRows(grid.columns, next) } : { shape: next });
  const setColumns = (columns: number) => onUpdate(grid.linkedColumnsRows ? { columns, rows: linkedRows(columns, shape) } : { columns });
  const setRows = (rows: number) => onUpdate(grid.linkedColumnsRows ? { rows, columns: computeLinkedColumns(rows, shape, imageWidth, imageHeight) } : { rows });
  const setLinked = (linked: boolean) => onUpdate(linked ? { linkedColumnsRows: true, rows: linkedRows(grid.columns, shape) } : { linkedColumnsRows: false });

  return (
    <>
    <ToolBar label={t("gridBar.label")} inset={inset} caption={aligning ? t("gridBar.aligning") : t("panel.layer", { name: layerName })}>
      <ToolBarPopover label={t("grid.shape")} hint={t(`grid.shape.${shape}`)} face={<ShapeIcon size={16} strokeWidth={2.25} aria-hidden />}>
        {(close) => (
          <>
            <span className="field-label">{t("grid.shape")}</span>
            <ul className="tool-bar-choices">
              {GRID_SHAPES.map(({ key }) => {
                const Icon = SHAPE_ICONS[key];
                return (
                  <li key={key}>
                    <button
                      type="button"
                      aria-pressed={key === shape}
                      onClick={() => {
                        setShape(key);
                        close();
                      }}
                    >
                      <Icon size={14} strokeWidth={2.25} aria-hidden />
                      <span className="tool-bar-text">{t(`grid.shape.${key}`)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </ToolBarPopover>
      <ToolBarPopover
        label={t("gridBar.size")}
        hint={t("gridBar.sizeHint")}
        face={
          <>
            {grid.linkedColumnsRows && <Link2 size={14} strokeWidth={2.25} aria-hidden />}
            <span className="tool-bar-value">{t("gridBar.sizeValue", { columns: formatInteger(grid.columns), rows: formatInteger(grid.rows) })}</span>
          </>
        }
      >
        <div className="tool-bar-pop-fields">
          <Toggle checked={grid.linkedColumnsRows} onChange={setLinked} label={t("grid.linked")} />
          <p className="field-label">{t("gridBar.linkedHint")}</p>
          <SliderField label={t("grid.columns")} value={grid.columns} min={1} max={MAX_GRID_LINES} defaultValue={DEFAULT_GRID.columns} onChange={setColumns} />
          <SliderField label={t("grid.rows")} value={grid.rows} min={1} max={MAX_GRID_LINES} defaultValue={DEFAULT_GRID.rows} onChange={setRows} />
        </div>
      </ToolBarPopover>
      <ToolBarButton Icon={Move} label={t("gridBar.align")} hint={t("gridBar.alignHint")} pressed={aligning} onClick={() => onSetAligning(!aligning)} />
      <ToolBarPopover label={t("gridBar.offset")} hint={t("gridBar.offsetHint")} face={<span className="tool-bar-value">{t("gridBar.offsetValue", { x: formatInteger(grid.horizontalOffset), y: formatInteger(grid.verticalOffset) })}</span>}>
        <div className="tool-bar-pop-fields">
          <SliderField label={t("grid.offsetX")} value={grid.horizontalOffset} min={-100} max={100} suffix="%" defaultValue={DEFAULT_GRID.horizontalOffset} onChange={(horizontalOffset) => onUpdate({ horizontalOffset })} />
          <SliderField label={t("grid.offsetY")} value={grid.verticalOffset} min={-100} max={100} suffix="%" defaultValue={DEFAULT_GRID.verticalOffset} onChange={(verticalOffset) => onUpdate({ verticalOffset })} />
        </div>
      </ToolBarPopover>
      <ToolBarDivider />
      <ToolBarPopover label={t("gridBar.lines")} hint={t("gridBar.linesHint")} face={<span className="tool-bar-value">{t("gridBar.opacityValue", { n: formatInteger(Math.round(grid.opacity * 100)) })}</span>}>
        <div className="tool-bar-pop-fields">
          <SliderField label={t("grid.opacity")} value={Math.round(grid.opacity * 100)} min={0} max={100} suffix="%" defaultValue={Math.round(DEFAULT_GRID.opacity * 100)} onChange={(pct) => onUpdate({ opacity: pct / 100 })} />
          <SliderField label={t("grid.width")} value={grid.lineWidth} min={0} max={5} step={0.1} defaultValue={DEFAULT_GRID.lineWidth} onChange={(lineWidth) => onUpdate({ lineWidth })} />
        </div>
      </ToolBarPopover>
      <ToolBarPopover label={t("grid.color")} face={<Swatch color={grid.color} />}>
        <div className="tool-bar-pop-fields">
          <span className="field-label">{t("grid.color")}</span>
          <ColorWheel value={grid.color} onChange={(color) => onUpdate({ color })} />
        </div>
      </ToolBarPopover>
      <ToolBarDivider />
      <ToolBarButton Icon={Trash2} danger label={t("grid.delete")} onClick={() => setConfirmDelete(true)} />
      <ToolBarButton Icon={X} label={t("grid.close")} onClick={onClose} />
    </ToolBar>
      <ConfirmDialog
        open={confirmDelete}
        title={t("grid.delete")}
        confirmLabel={tc("delete")}
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete();
        }}
        onCancel={() => setConfirmDelete(false)}
      >
        {t("gridBar.deleteBody", { layer: layerName })}
      </ConfirmDialog>
    </>
  );
}
