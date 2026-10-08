"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { GripHorizontal } from "lucide-react";
import { RawIcon } from "@/components/MarkerIcon";
import type { ClientLegend, LegendConfig, LegendImage, LegendItem, LegendItemSize } from "@/server/legends/legend-config";
import { useHudDrag } from "./use-hud-drag";
import { useT } from "@/i18n/useT";

/** Swatch (the item's small rectangle image) size per legend item size, px. */
export const SWATCH_SIZES: Record<LegendItemSize, { w: number; h: number }> = {
  small: { w: 22, h: 14 },
  medium: { w: 30, h: 20 },
  large: { w: 40, h: 26 },
};

/** The item's image: an icon on its fill color, or the uploaded picture (cropped to fill). */
export function LegendSwatch({ image, size }: { image: LegendImage; size: LegendItemSize }) {
  const { w, h } = SWATCH_SIZES[size];
  if (image.kind === "upload") {
    // eslint-disable-next-line @next/next/no-img-element -- a tiny user image from our own upload route
    return <img className="map-legend-swatch" src={image.src} alt="" width={w} height={h} draggable={false} />;
  }
  return (
    <span className="map-legend-swatch" style={{ width: w, height: h, background: image.fill, color: image.color }}>
      <RawIcon iconKey={image.key} size={Math.round(h * 0.75)} strokeWidth={2.25} />
    </span>
  );
}

export function LegendText({ item }: { item: LegendItem }) {
  let node: React.ReactNode = item.text;
  if (item.strike) node = <s>{node}</s>;
  if (item.italic) node = <em>{node}</em>;
  if (item.bold) node = <strong>{node}</strong>;
  return <span className="map-legend-text">{node}</span>;
}

/** `items` with `draggedId` moved before (or after) `targetId`. */
export function moveItem(items: LegendItem[], draggedId: string, targetId: string, after: boolean): LegendItem[] {
  const dragged = items.find((i) => i.id === draggedId);
  if (!dragged || draggedId === targetId) return items;
  const rest = items.filter((i) => i.id !== draggedId);
  const index = rest.findIndex((i) => i.id === targetId) + (after ? 1 : 0);
  return [...rest.slice(0, index), dragged, ...rest.slice(index)];
}

/**
 * The legend over the map window (it stays put while the map pans and
 * zooms). Items flow left to right, up to `columns` per row, and the legend
 * is only as big as its items; past `rows` rows it scrolls. While editing
 * (its panel open) the title bar drags it and items drag to reorder.
 */
export default function MapLegend({
  legend,
  area,
  inset,
  editable,
  selectedItemId,
  onSelectItem,
  onUpdateConfig,
}: {
  legend: ClientLegend;
  area: HTMLElement | null;
  inset: number;
  editable: boolean;
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  onUpdateConfig: (patch: Partial<LegendConfig>) => void;
}) {
  const t = useT("maps");
  const { config } = legend;
  const [widget, setWidget] = useState<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);
  const [drag, setDrag] = useState<{ id: string; overId: string | null; after: boolean } | null>(null);
  const { style, handleProps, dragging } = useHudDrag({
    area,
    widget,
    position: config.position,
    inset,
    editable,
    onCommit: (position) => onUpdateConfig({ position }),
  });

  const columns = Math.max(1, Math.min(config.columns, config.items.length));

  // Past `rows` rows the body scrolls: its height stops at the first item of row `rows + 1`.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const cut = body?.children[config.rows * columns] as HTMLElement | undefined;
    setMaxHeight(body && cut ? cut.offsetTop - body.offsetTop - 2 : undefined);
  }, [config.rows, columns, config.items, config.itemSize]);

  if (!editable && config.items.length === 0) return null;
  const title = config.title;

  return (
    <div
      ref={setWidget}
      className={["map-legend", editable && "editing", dragging && "dragging"].filter(Boolean).join(" ")}
      style={{ ...style, background: `rgb(20 21 24 / ${config.background})`, borderColor: config.background < 0.2 ? "transparent" : undefined }}
      role="region"
      aria-label={title ? t("legend.region", { title }) : t("panel.legend")}
    >
      {(title || editable) && (
        <div className="map-legend-header" {...handleProps} aria-label={editable ? t("legend.moveLabel") : undefined} data-tooltip={editable ? t("legend.moveHint") : undefined}>
          {title ? <span className="map-legend-title">{title}</span> : <span className="map-legend-title field-label">{t("panel.legend")}</span>}
          {editable && <GripHorizontal size={14} strokeWidth={2.25} aria-hidden className="map-legend-grip" />}
        </div>
      )}
      {config.items.length === 0 ? (
        <p className="map-legend-empty field-label">{t("legend.emptyWidget")}</p>
      ) : (
        <div ref={bodyRef} className="map-legend-body" style={{ gridTemplateColumns: `repeat(${columns}, auto)`, maxHeight }}>
          {config.items.map((item) => {
            const dropClass = drag?.overId === item.id && drag.id !== item.id ? (drag.after ? " drop-after" : " drop-before") : "";
            return (
              <div
                key={item.id}
                className={`map-legend-item${selectedItemId === item.id && editable ? " selected" : ""}${drag?.id === item.id ? " dragged" : ""}${dropClass}`}
                draggable={editable}
                onClick={editable ? () => onSelectItem(item.id) : undefined}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", item.id);
                  setDrag({ id: item.id, overId: null, after: false });
                }}
                onDragOver={(e) => {
                  if (!drag) return;
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const after = e.clientX > rect.left + rect.width / 2;
                  if (drag.overId !== item.id || drag.after !== after) setDrag({ ...drag, overId: item.id, after });
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (drag?.overId) onUpdateConfig({ items: moveItem(config.items, drag.id, drag.overId, drag.after) });
                  setDrag(null);
                }}
                onDragEnd={() => setDrag(null)}
              >
                <LegendSwatch image={item.image} size={config.itemSize} />
                <LegendText item={item} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
