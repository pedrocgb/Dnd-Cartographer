"use client";

import { LayoutList, Plus, X } from "lucide-react";
import { LEGEND_LIMITS, type ClientLegend, type LegendConfig } from "@/server/legends/legend-config";
import LegendItemsWindow from "./LegendItemsWindow";
import type { LegendPatch } from "./use-map-legends";
import { useT } from "@/i18n/useT";

/**
 * The Legend tool's list: the active layer's legend (one per layer), its
 * title and its items. The legend bar shows/hides it, sets its layout and
 * look, and edits the picked item. With the tool open, the legend on the
 * map can be dragged around and its items dragged to reorder them.
 */
export default function LegendPanel({
  layerName,
  legend,
  error,
  selectedItemId,
  onSelectItem,
  onCreate,
  onUpdate,
  onClose,
}: {
  layerName: string;
  legend: ClientLegend | null;
  error: string | null;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onCreate: () => void;
  onUpdate: (patch: LegendPatch) => void;
  onClose: () => void;
}) {
  const t = useT("maps");
  const tc = useT("common");
  const config = legend?.config;
  const setConfig = (patch: Partial<LegendConfig>) => onUpdate({ config: patch });

  return (
    <div className="zones-panel legend-panel">
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
            <div className="legend-field">
              <label className="field-label" htmlFor="legend-title">
                {t("legend.title")}
              </label>
              <input id="legend-title" type="text" value={config.title ?? ""} placeholder={t("legend.noTitle")} maxLength={LEGEND_LIMITS.title} onChange={(e) => setConfig({ title: e.target.value || null })} />
            </div>
            <LegendItemsWindow items={config.items} selectedItemId={selectedItemId} onSelectItem={onSelectItem} onChangeItems={(items) => setConfig({ items })} />
          </>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  );
}
