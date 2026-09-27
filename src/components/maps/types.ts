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
