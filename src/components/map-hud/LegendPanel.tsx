"use client";

import { useState } from "react";
import { LayoutList, Plus, Trash2, X } from "lucide-react";
import LayerChecklist from "@/components/LayerChecklist";
import SegmentedControl from "@/components/marker-panel/SegmentedControl";
import MarkerCard from "@/components/marker-panel/MarkerCard";
import ConfirmDialog from "@/components/ConfirmDialog";
import Toggle from "@/components/Toggle";
import { SliderField } from "@/components/SliderField";
import type { MapLayerData } from "@/components/layer-images";
import { DEFAULT_LEGEND, LEGEND_ITEM_SIZES, LEGEND_LIMITS, type ClientLegend, type LegendConfig } from "@/server/legends/legend-config";
import LegendItemsWindow from "./LegendItemsWindow";
import type { LegendPatch } from "./use-map-legends";
import { useT } from "@/i18n/useT";


/**
 * The Legend tool: the active layer's legend (one per layer). Left, its
 * settings — whether it shows, on which other layers too, title, grid and
 * look; right, the Items window. With this panel open, the legend on the
 * map can be dragged around and its items dragged to reorder them.
 */
export default function LegendPanel({
  layerName,
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
  layerName: string;
  layerId: string;
  layers: MapLayerData[];
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

  return (
    <div className={legend ? "zones-panel zones-panel-editing legend-panel" : "zones-panel legend-panel"}>
      <div className="zones-panel-main">
        <div className="marker-side-panel-header">
          <h2>
            <LayoutList size={16} strokeWidth={2.25} style={{ verticalAlign: "-2px", marginRight: "6px" }} />
            {t("panel.legend")}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={tc("closePanel", { title: t("panel.legend") })}>
            <X size={16} strokeWidth={2.25} />
          </button>
        </div>
        <p className="panel-layer-label">{t("panel.layer", { name: layerName })}</p>

        {!legend || !config ? (
          <div className="legend-items-empty">
            <LayoutList size={28} strokeWidth={1.5} aria-hidden />
            <p>{t("legend.none")}</p>
            <p className="field-label">{t("legend.noneHint")}</p>
            <button type="button" className="btn btn-sm btn-primary" onClick={onCreate}>
              <Plus size={14} strokeWidth={2.25} />
              {t("legend.create")}
            </button>
          </div>
        ) : (
          <>
            <Toggle checked={legend.visible} onChange={(visible) => onUpdate({ visible })} label={t("legend.show")} />
            <LayerChecklist layers={layers} homeLayerId={layerId} value={legend.extraLayerIds} onChange={(extraLayerIds) => onUpdate({ extraLayerIds })} />
            <p className="field-label zone-tool-hint">{t("legend.dragHint")}</p>

            <MarkerCard title={t("legend.layout")} defaultOpen>
              <div className="legend-field">
                <label className="field-label" htmlFor="legend-title">
                  {t("legend.title")}
                </label>
                <input id="legend-title" type="text" value={config.title ?? ""} placeholder={t("legend.noTitle")} maxLength={LEGEND_LIMITS.title} onChange={(e) => setConfig({ title: e.target.value || null })} />
              </div>
              <SliderField label={t("legend.columns")} value={config.columns} min={LEGEND_LIMITS.columns[0]} max={LEGEND_LIMITS.columns[1]} defaultValue={DEFAULT_LEGEND.columns} onChange={(columns) => setConfig({ columns })} />
              <SliderField label={t("legend.rows")} value={config.rows} min={LEGEND_LIMITS.rows[0]} max={LEGEND_LIMITS.rows[1]} defaultValue={DEFAULT_LEGEND.rows} onChange={(rows) => setConfig({ rows })} />
              <p className="field-label">{t("legend.rowsHint")}</p>
            </MarkerCard>

            <MarkerCard title={t("legend.look")} defaultOpen>
              <div className="legend-field">
                <span className="field-label">{t("legend.itemSize")}</span>
                <SegmentedControl ariaLabel={t("legend.itemSize")} value={config.itemSize} segments={LEGEND_ITEM_SIZES.map((key) => ({ key, label: t(`legend.size.${key}`) }))} onChange={(itemSize) => setConfig({ itemSize })} />
              </div>
              <SliderField label={t("legend.background")} value={Math.round(config.background * 100)} min={0} max={100} suffix="%" defaultValue={DEFAULT_LEGEND.background * 100} onChange={(v) => setConfig({ background: v / 100 })} />
            </MarkerCard>

            <button type="button" className="btn btn-sm btn-ghost legend-delete" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} strokeWidth={2.25} />
              {t("legend.delete")}
            </button>
          </>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>

      {legend && config && (
        <div className="zones-panel-editor">
          <LegendItemsWindow items={config.items} selectedItemId={selectedItemId} onSelectItem={onSelectItem} onChangeItems={(items) => setConfig({ items })} />
        </div>
      )}

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
        <p>{t("legend.deleteBody", { count: config?.items.length ?? 0, n: config?.items.length ?? 0 })}</p>
      </ConfirmDialog>
    </div>
  );
}
