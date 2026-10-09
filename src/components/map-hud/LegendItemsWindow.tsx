"use client";

import { useState } from "react";
import { GripVertical, LayoutList, Plus } from "lucide-react";
import { newId } from "@/components/calendars/api";
import { DEFAULT_ITEM_ICON, LEGEND_LIMITS, type LegendItem } from "@/server/legends/legend-config";
import { LegendSwatch, LegendText, moveItem } from "./MapLegend";
import { useT } from "@/i18n/useT";

/**
 * The legend's items, as a list: drag the grip (or Alt+↑/↓) to reorder,
 * click one to pick it (the legend bar edits it), Add for a new one.
 */
export default function LegendItemsWindow({
  items,
  selectedItemId,
  onSelectItem,
  onChangeItems,
}: {
  items: LegendItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onChangeItems: (items: LegendItem[]) => void;
}) {
  const t = useT("maps");
  const [drag, setDrag] = useState<{ id: string; overId: string | null; after: boolean } | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const full = items.length >= LEGEND_LIMITS.items;

  function addItem() {
    const item: LegendItem = { id: newId("item"), image: DEFAULT_ITEM_ICON, text: "", bold: false, italic: false, strike: false };
    onChangeItems([...items, item]);
    onSelectItem(item.id);
  }

  return (
    <div className="legend-items">
      <div className="legend-items-header">
        <h3>
          {t("legend.items")} <span className="legend-items-count">{items.length}</span>
        </h3>
        <button type="button" className="btn btn-sm btn-primary" disabled={full} onClick={addItem}>
          <Plus size={14} strokeWidth={2.25} />
          {t("legend.addItem")}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="legend-items-empty">
          <LayoutList size={28} strokeWidth={1.5} aria-hidden />
          <p>{t("legend.noItems")}</p>
          <p className="field-label">{t("legend.noItemsHint")}</p>
          <button type="button" className="btn btn-sm" onClick={addItem}>
            <Plus size={14} strokeWidth={2.25} />
            {t("legend.addFirst")}
          </button>
        </div>
      ) : (
        <>
          <p className="field-label">{t("legend.listHint")}</p>
          <ul className="legend-item-list">
            {items.map((item, index) => {
              const drop = drag?.overId === item.id && drag.id !== item.id ? (drag.after ? " drop-below" : " drop-above") : "";
              return (
                <li
                  key={item.id}
                  className={`legend-item-card${item.id === selectedItemId ? " selected" : ""}${drag?.id === item.id ? " dragged" : ""}${drop}`}
                  draggable={armedId === item.id}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", item.id);
                    setDrag({ id: item.id, overId: null, after: false });
                  }}
                  onDragOver={(e) => {
                    if (!drag) return;
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const after = e.clientY > rect.top + rect.height / 2;
                    if (drag.overId !== item.id || drag.after !== after) setDrag({ ...drag, overId: item.id, after });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (drag?.overId) onChangeItems(moveItem(items, drag.id, drag.overId, drag.after));
                    setDrag(null);
                  }}
                  onDragEnd={() => {
                    setDrag(null);
                    setArmedId(null);
                  }}
                >
                  <span
                    className="legend-item-grip"
                    aria-hidden
                    data-tooltip={t("legend.dragToReorder")}
                    onPointerDown={() => setArmedId(item.id)}
                    onPointerUp={() => setArmedId(null)}
                  >
                    <GripVertical size={14} strokeWidth={2.25} />
                  </span>
                  <button
                    type="button"
                    className="legend-item-open"
                    aria-label={t("legend.editItem", { name: item.text || t("legend.untitled") })}
                    aria-pressed={item.id === selectedItemId}
                    onClick={() => onSelectItem(item.id === selectedItemId ? null : item.id)}
                    onKeyDown={(e) => {
                      if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
                      e.preventDefault();
                      const target = items[index + (e.key === "ArrowUp" ? -1 : 1)];
                      if (target) onChangeItems(moveItem(items, item.id, target.id, e.key === "ArrowDown"));
                    }}
                  >
                    <LegendSwatch image={item.image} size="medium" />
                    {item.text ? <LegendText item={item} /> : <span className="legend-item-untitled">{t("legend.noLabel")}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
