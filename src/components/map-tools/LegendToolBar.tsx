"use client";

import { useState } from "react";
import { Bold, ChevronLeft, ChevronRight, Eye, EyeOff, Image as ImageIcon, Italic, Layers, LayoutGrid, Palette, Plus, Strikethrough, Trash2, Type, X } from "lucide-react";
import ColorWheel from "../ColorWheel";
import ConfirmDialog from "../ConfirmDialog";
import IconPicker from "../IconPicker";
import LayerChecklist from "../LayerChecklist";
import SegmentedControl from "../marker-panel/SegmentedControl";
import { SliderField } from "../SliderField";
import type { MapLayerData } from "../layer-images";
import { DEFAULT_ITEM_ICON, DEFAULT_LEGEND, LEGEND_ITEM_SIZES, LEGEND_LIMITS, type ClientLegend, type LegendConfig, type LegendItem } from "@/server/legends/legend-config";
import { formatInteger } from "@/server/settings/number-format";
import { LegendSwatch } from "../map-hud/MapLegend";
import { UploadField, type IconImage } from "../map-hud/legend-fields";
import type { LegendPatch } from "../map-hud/use-map-legends";
import { useT } from "@/i18n/useT";
import { DoneButton, Swatch, ToolBar, ToolBarButton, ToolBarDivider, ToolBarPopover } from "./ToolBar";

/**
 * The Legend tool's bar. With no item picked: show/hide, other layers,
 * layout and look of the active layer's legend, and Delete. With an item
 * picked (in the list or on the map): its label and text style, its image
 * (icon or upload) and colors, previous/next, Delete and Done.
 */
export default function LegendToolBar({
  inset,
  layerId,
  layers,
  legend,
  error,
  selectedItemId,
  onSelectItem,
  onCreate,
  onUpdate,
  onDelete,
  onClose,
}: {
  /** Where the map's free part starts (right of the side panel). */
  inset: number;
  layerId: string;
  layers: MapLayerData[];
  /** The active layer's own legend (null: none yet). */
  legend: ClientLegend | null;
  error: string | null;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onCreate: () => void;
  onUpdate: (patch: LegendPatch) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = useT("maps");
  const tc = useT("common");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const config = legend?.config;
  const setConfig = (patch: Partial<LegendConfig>) => onUpdate({ config: patch });
  const items = config?.items ?? [];
  const index = items.findIndex((i) => i.id === selectedItemId);
  const item = index >= 0 ? items[index] : null;
  const close = <ToolBarButton Icon={X} label={tc("closePanel", { title: t("panel.legend") })} onClick={onClose} />;

  if (!legend || !config) {
    return (
      <ToolBar label={t("legendBar.label")} inset={inset} caption={error ?? t("legend.noneHint")}>
        <ToolBarButton Icon={Plus} label={t("legend.create")} onClick={onCreate}>
          <span>{t("legend.create")}</span>
        </ToolBarButton>
        <ToolBarDivider />
        {close}
      </ToolBar>
    );
  }

  return (
    <>
      <ToolBar label={t("legendBar.label")} inset={inset} caption={error ?? (item ? undefined : t("legend.dragHint"))}>
        {item ? (
          <ItemButtons
            item={item}
            index={index}
            count={items.length}
            onChange={(patch) => setConfig({ items: items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)) })}
            onStep={(delta) => onSelectItem(items[index + delta]?.id ?? item.id)}
            onDelete={() => {
              setConfig({ items: items.filter((i) => i.id !== item.id) });
              onSelectItem(null);
            }}
            onDone={() => onSelectItem(null)}
          />
        ) : (
          <>
            <ToolBarButton
              Icon={legend.visible ? Eye : EyeOff}
              label={t("legend.show")}
              hint={legend.visible ? t("legendBar.hide") : t("legend.show")}
              pressed={legend.visible}
              onClick={() => onUpdate({ visible: !legend.visible })}
            />
            <ToolBarPopover
              label={t("legendBar.layers")}
              hint={t("legendBar.layersHint")}
              wide
              face={
                <>
                  <Layers size={16} strokeWidth={2.25} aria-hidden />
                  {legend.extraLayerIds.length > 0 && <span className="tool-bar-value">{formatInteger(legend.extraLayerIds.length)}</span>}
                </>
              }
            >
              <div className="tool-bar-pop-fields">
                <LayerChecklist layers={layers} homeLayerId={layerId} value={legend.extraLayerIds} onChange={(extraLayerIds) => onUpdate({ extraLayerIds })} />
              </div>
            </ToolBarPopover>
            <ToolBarDivider />
            <ToolBarPopover
              label={t("legend.layout")}
              hint={t("legendBar.layoutHint")}
              face={
                <>
                  <LayoutGrid size={16} strokeWidth={2.25} aria-hidden />
                  <span className="tool-bar-value">{t("gridBar.sizeValue", { columns: formatInteger(config.columns), rows: formatInteger(config.rows) })}</span>
                </>
              }
            >
              <div className="tool-bar-pop-fields">
                <SliderField label={t("legend.columns")} value={config.columns} min={LEGEND_LIMITS.columns[0]} max={LEGEND_LIMITS.columns[1]} defaultValue={DEFAULT_LEGEND.columns} onChange={(columns) => setConfig({ columns })} />
                <SliderField label={t("legend.rows")} value={config.rows} min={LEGEND_LIMITS.rows[0]} max={LEGEND_LIMITS.rows[1]} defaultValue={DEFAULT_LEGEND.rows} onChange={(rows) => setConfig({ rows })} />
                <p className="field-label">{t("legend.rowsHint")}</p>
              </div>
            </ToolBarPopover>
            <ToolBarPopover label={t("legend.look")} hint={t("legendBar.lookHint")} face={<Palette size={16} strokeWidth={2.25} aria-hidden />}>
              <div className="tool-bar-pop-fields">
                <span className="field-label">{t("legend.itemSize")}</span>
                <SegmentedControl ariaLabel={t("legend.itemSize")} value={config.itemSize} segments={LEGEND_ITEM_SIZES.map((key) => ({ key, label: t(`legend.size.${key}`) }))} onChange={(itemSize) => setConfig({ itemSize })} />
                <SliderField label={t("legend.background")} value={Math.round(config.background * 100)} min={0} max={100} suffix="%" defaultValue={DEFAULT_LEGEND.background * 100} onChange={(v) => setConfig({ background: v / 100 })} />
              </div>
            </ToolBarPopover>
            <ToolBarDivider />
            <ToolBarButton Icon={Trash2} danger label={t("legend.delete")} onClick={() => setConfirmDelete(true)} />
            {close}
          </>
        )}
      </ToolBar>
      <ConfirmDialog
        open={confirmDelete}
        title={t("legend.delete")}
        confirmLabel={tc("delete")}
        danger
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete();
        }}
        onCancel={() => setConfirmDelete(false)}
      >
        <p>{t("legend.deleteBody", { count: items.length, n: items.length })}</p>
      </ConfirmDialog>
    </>
  );
}

/** The picked item's buttons: previous/next, label and its style, image, colors, Delete, Done. */
function ItemButtons({
  item,
  index,
  count,
  onChange,
  onStep,
  onDelete,
  onDone,
}: {
  item: LegendItem;
  index: number;
  count: number;
  onChange: (patch: Partial<LegendItem>) => void;
  onStep: (delta: -1 | 1) => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const t = useT("maps");
  // The icon kept while trying an upload, so switching back restores it.
  const [lastIcon, setLastIcon] = useState<IconImage>(item.image.kind === "icon" ? item.image : (DEFAULT_ITEM_ICON as IconImage));
  // Upload is only picked here until a file is chosen: the item keeps its icon meanwhile.
  const [source, setSource] = useState<"icon" | "upload">(item.image.kind);
  const [lastItemId, setLastItemId] = useState(item.id);
  if (item.id !== lastItemId) {
    setLastItemId(item.id);
    setLastIcon(item.image.kind === "icon" ? item.image : (DEFAULT_ITEM_ICON as IconImage));
    setSource(item.image.kind);
  }
  const icon = item.image.kind === "icon" ? item.image : null;
  const setIcon = (next: IconImage) => {
    setLastIcon(next);
    onChange({ image: next });
  };

  return (
    <>
      <ToolBarButton Icon={ChevronLeft} label={t("legend.previous")} disabled={index === 0} onClick={() => onStep(-1)} />
      <span className="tool-bar-label">
        <LegendSwatch image={item.image} size="small" />
        <span className="tool-bar-text">{item.text || t("legend.noLabel")}</span>
        <span className="field-label">{t("legendBar.position", { n: formatInteger(index + 1), total: formatInteger(count) })}</span>
      </span>
      <ToolBarButton Icon={ChevronRight} label={t("legend.next")} disabled={index === count - 1} onClick={() => onStep(1)} />
      <ToolBarDivider />
      <ToolBarPopover label={t("legend.label")} hint={t("legendBar.labelHint")} face={<Type size={16} strokeWidth={2.25} aria-hidden />}>
        <div className="tool-bar-pop-fields">
          <label className="field-label" htmlFor={`legend-text-${item.id}`}>
            {t("legend.label")}
          </label>
          <input id={`legend-text-${item.id}`} type="text" autoFocus placeholder={t("legend.labelPlaceholder")} value={item.text} maxLength={LEGEND_LIMITS.text} onChange={(e) => onChange({ text: e.target.value })} />
        </div>
      </ToolBarPopover>
      <ToolBarButton Icon={Bold} label={t("text.bold")} pressed={item.bold} onClick={() => onChange({ bold: !item.bold })} />
      <ToolBarButton Icon={Italic} label={t("legend.italic")} pressed={item.italic} onClick={() => onChange({ italic: !item.italic })} />
      <ToolBarButton Icon={Strikethrough} label={t("legend.strike")} pressed={item.strike} onClick={() => onChange({ strike: !item.strike })} />
      <ToolBarDivider />
      <ToolBarPopover label={t("legend.image")} hint={t("legendBar.imageHint")} wide face={<ImageIcon size={16} strokeWidth={2.25} aria-hidden />}>
        <div className="tool-bar-pop-fields">
          <SegmentedControl
            ariaLabel={t("legend.imageSource")}
            value={source}
            segments={[
              { key: "icon", label: t("legend.icon") },
              { key: "upload", label: t("legend.upload") },
            ]}
            onChange={(key) => {
              setSource(key);
              if (key === "icon" && item.image.kind !== "icon") onChange({ image: lastIcon });
            }}
          />
          {source === "icon" ? (
            <div className="legend-icon-picker">
              <IconPicker value={(icon ?? lastIcon).key} onChange={(key) => setIcon({ ...(icon ?? lastIcon), key })} />
            </div>
          ) : (
            <UploadField image={item.image} onChange={(image) => onChange({ image })} />
          )}
        </div>
      </ToolBarPopover>
      {icon && (
        <>
          <ToolBarPopover label={t("legend.fill")} face={<Swatch color={icon.fill} />}>
            <div className="tool-bar-pop-fields">
              <span className="field-label">{t("legend.fill")}</span>
              <ColorWheel value={icon.fill} onChange={(fill) => setIcon({ ...icon, fill })} />
            </div>
          </ToolBarPopover>
          <ToolBarPopover label={t("legend.iconColor")} face={<Swatch color={icon.color} />}>
            <div className="tool-bar-pop-fields">
              <span className="field-label">{t("legend.iconColor")}</span>
              <ColorWheel value={icon.color} onChange={(color) => setIcon({ ...icon, color })} />
            </div>
          </ToolBarPopover>
        </>
      )}
      <ToolBarDivider />
      <ToolBarButton Icon={Trash2} danger label={t("legend.deleteItem")} onClick={onDelete} />
      <DoneButton onClick={onDone} />
    </>
  );
}
