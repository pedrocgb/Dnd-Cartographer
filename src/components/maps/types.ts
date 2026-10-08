import type { Translator } from "@/i18n/translate";

/** A map as `/api/maps` lists it. */
export interface MapSummary {
  id: string;
  name: string;
  parentId: string | null;
  folderId: string | null;
  categoryId: string | null;
  categoryLabel: string | null;
  thumbnailKey: string | null;
  currentAssetId: string | null;
  assetState: string | null;
  childCount: number;
  markerCount: number;
  zoneCount: number;
}

/** A maps-list folder as `/api/map-folders` lists it. */
export interface FolderSummary {
  id: string;
  name: string;
  parentId: string | null;
  /** Icon tint; null uses the default. */
  color: string | null;
}

const ASSET_STATES = ["uploading", "queued", "processing", "ready", "failed", "cancelled"] as const;

/** A map image's processing state in the user's language (an unknown state shows as stored). */
export function assetStateLabel(state: string, t: Translator<"maps">): string {
  return (ASSET_STATES as readonly string[]).includes(state) ? t(`assetState.${state as (typeof ASSET_STATES)[number]}`) : state;
}
