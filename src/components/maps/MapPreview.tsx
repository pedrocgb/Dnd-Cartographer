"use client";

import { MapPin, Shapes } from "lucide-react";
import { useT } from "@/i18n/useT";
import { formatInteger } from "@/server/settings/number-format";
import type { MapSummary } from "./types";

/**
 * Read-only preview of the hovered map in the middle of the Maps page:
 * name, category and parent map, its art, then marker and zone counts.
 * `visible` fades it in and out; the last map stays rendered while it
 * fades out, so the content doesn't vanish mid-animation.
 */
export default function MapPreview({ map, parentName, visible }: { map: MapSummary | null; parentName: string | null; visible: boolean }) {
  const t = useT("maps");
  const art = map?.currentAssetId && map.thumbnailKey ? `/api/thumbnails/${map.currentAssetId}` : null;
  return (
    <div className={visible && map ? "map-preview visible" : "map-preview"} aria-hidden={!visible}>
      {map && (
        <>
          <h1 className="map-preview-title">{map.name}</h1>
          {(map.categoryLabel || parentName) && (
            <p className="map-preview-meta">
              {map.categoryLabel && <span className="map-pill-tag">{map.categoryLabel}</span>}
              {parentName && <span>{t("preview.parent", { name: parentName })}</span>}
            </p>
          )}
          <div className="map-preview-art">
            {art ? (
              // eslint-disable-next-line @next/next/no-img-element -- local thumbnail, not worth next/image's remote-optimization machinery
              <img src={art} alt="" />
            ) : (
              <div className="map-preview-empty">{t("noImage")}</div>
            )}
          </div>
          <p className="map-preview-stats">
            <span>
              <MapPin size={14} strokeWidth={2.25} aria-hidden /> {t("preview.markers", { n: formatInteger(map.markerCount) })}
            </span>
            <span>
              <Shapes size={14} strokeWidth={2.25} aria-hidden /> {t("preview.zones", { n: formatInteger(map.zoneCount) })}
            </span>
          </p>
        </>
      )}
    </div>
  );
}
