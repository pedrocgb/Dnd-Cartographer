"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPinned, MapPinPlus, Star } from "lucide-react";
import type { ArticleTemplateKey } from "@/server/articles/templates";
import type { ArticleMarker } from "@/server/markers/article-links";
import MarkerIcon from "@/components/MarkerIcon";
import InfoPicker from "./InfoPicker";

/** The map URL that opens in "place a marker for this article" mode (read by MapWorkspace). */
export function placeOnMapHref(mapId: string, template: ArticleTemplateKey, articleId: string, name: string): string {
  const params = new URLSearchParams({ place: `${template}:${articleId}`, placeName: name });
  return `/maps/${encodeURIComponent(mapId)}?${params}`;
}

/** "Place on map": pick a map, then go there ready to click where this article's marker goes. */
function PlaceOnMap({ template, articleId, title }: { template: ArticleTemplateKey; articleId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [maps, setMaps] = useState<{ id: string; name: string }[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/maps")
      .then((r) => r.json() as Promise<{ maps: { id: string; name: string }[] }>)
      .then((d) => !cancelled && setMaps(d.maps))
      .catch(() => !cancelled && setMaps([]));
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) {
    return (
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpen(true)} data-tooltip="Put a marker for this article on a map">
        <MapPinPlus size={14} strokeWidth={2.25} />
        Place on map
      </button>
    );
  }
  return (
    <div className="article-map-place">
      <InfoPicker
        options={(maps ?? []).map((m) => ({ value: m.id, label: m.name })).sort((a, b) => a.label.localeCompare(b.label))}
        value={null}
        placeholder={maps === null ? "Loading maps…" : maps.length ? "Choose a map…" : "No maps yet"}
        ariaLabel="Map to place the marker on"
        disabled={!maps?.length}
        onChange={(mapId) => mapId && router.push(placeOnMapHref(mapId, template, articleId, title))}
      />
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}

/**
 * "On the map": every marker linked to this article, grouped by map, each
 * jumping to the marker on its map — plus "Place on map" to add one. Shown
 * for every template, empty or not, so placing is always one click away.
 */
export default function ArticleMapPresence({ template, articleId, title }: { template: ArticleTemplateKey; articleId: string; title: string }) {
  const [markers, setMarkers] = useState<ArticleMarker[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/articles/${encodeURIComponent(articleId)}/markers`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { markers: [] }))
      .then((d: { markers?: ArticleMarker[] }) => !cancelled && setMarkers(d.markers ?? []))
      .catch(() => !cancelled && setMarkers([]));
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  const byMap = useMemo(() => {
    const groups = new Map<string, { mapName: string; markers: ArticleMarker[] }>();
    for (const m of markers ?? []) {
      const group = groups.get(m.mapId) ?? { mapName: m.mapName, markers: [] };
      group.markers.push(m);
      groups.set(m.mapId, group);
    }
    return [...groups.entries()];
  }, [markers]);

  return (
    <section className="article-card article-map-presence" aria-label="On the map">
      <header className="article-card-header">
        <span className="article-card-label">
          <MapPinned size={15} strokeWidth={2.25} />
          On the map
        </span>
        <span className="article-card-header-end">
          <PlaceOnMap template={template} articleId={articleId} title={title} />
        </span>
      </header>
      {markers !== null && markers.length === 0 && <p className="field-label article-map-empty">Not on any map yet.</p>}
      {byMap.map(([mapId, group]) => (
        <div key={mapId} className="article-map-group">
          <Link href={`/maps/${mapId}`} className="article-map-name">
            {group.mapName}
          </Link>
          <ul>
            {group.markers.map((m) => (
              <li key={m.linkId}>
                <Link href={`/maps/${m.mapId}?marker=${m.markerId}`} className="article-map-marker" data-tooltip="Show on map">
                  <MarkerIcon
                    iconKey={m.iconKey}
                    color={m.color}
                    backgroundColor={m.backgroundColor}
                    outlineColor={m.outlineColor}
                    backgroundShape={m.backgroundShape}
                    size={12}
                  />
                  <span className="article-map-marker-name">{m.markerName}</span>
                </Link>
                {m.isPrimary && <Star size={12} strokeWidth={2.25} fill="currentColor" className="article-map-primary" aria-label="Main article of this marker" data-tooltip="This article is the marker's main article" />}
                {m.label && <span className="article-map-role">{m.label}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
