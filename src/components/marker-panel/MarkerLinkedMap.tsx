"use client";

import Link from "next/link";
import { ArrowRight, Map as MapIcon, X } from "lucide-react";
import InfoPicker from "@/components/articles/InfoPicker";
import type { Marker } from "../MarkerLayer";
import type { MarkerUpdate } from "./types";
import MarkerCard from "./MarkerCard";
import { useT } from "@/i18n/useT";

interface MapOption {
  id: string;
  name: string;
}

function MapBadge() {
  const t = useT("maps");
  return (
    <span className="marker-article-icon" data-tooltip={t("marker.map")}>
      <MapIcon size={15} strokeWidth={2.25} aria-label={t("marker.map")} />
    </span>
  );
}

/** View mode: the map this marker leads to, opened in place of the current one. */
export function MarkerLinkedMapView({ map }: { map: MapOption | null }) {
  const t = useT("maps");
  if (!map) return null;
  return (
    <Link href={`/maps/${map.id}`} className="marker-linked-map">
      <MapBadge />
      <span className="marker-article-text">
        <span className="marker-article-label">{t("marker.linkedMap")}</span>
        <span className="marker-article-name">{map.name}</span>
      </span>
      <ArrowRight size={15} strokeWidth={2.25} aria-hidden="true" />
    </Link>
  );
}

/** Edit mode: pick the map this marker leads to (a city's own map, a dungeon…). */
export function MarkerLinkedMapEdit({ marker, maps, onUpdate }: { marker: Marker; maps: MapOption[]; onUpdate: MarkerUpdate }) {
  const t = useT("maps");
  const linked = marker.linkedMapId ? (maps.find((m) => m.id === marker.linkedMapId) ?? null) : null;
  return (
    <MarkerCard title={t("marker.linkedMap")}>
      {marker.linkedMapId && (
        <div className="marker-article-row marker-subject-row">
          <MapBadge />
          <span className="marker-article-text">
            {linked ? (
              <Link href={`/maps/${linked.id}`} className="marker-article-name">
                {linked.name}
              </Link>
            ) : (
              <span className="marker-article-name removed">{t("marker.deletedMap")}</span>
            )}
          </span>
          <button type="button" className="btn btn-ghost btn-icon" aria-label={t("marker.unlinkMap")} data-tooltip={t("marker.unlink")} onClick={() => onUpdate({ linkedMapId: null })}>
            <X size={14} strokeWidth={2.25} />
          </button>
        </div>
      )}
      <InfoPicker
        options={maps.map((m) => ({ value: m.id, label: m.name }))}
        value={null}
        placeholder={marker.linkedMapId ? t("marker.replaceMap") : t("marker.linkMap")}
        ariaLabel={t("marker.linkedMap")}
        onChange={(linkedMapId) => linkedMapId && onUpdate({ linkedMapId })}
      />
    </MarkerCard>
  );
}
