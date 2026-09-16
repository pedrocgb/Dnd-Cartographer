export const EXPORT_VERSION = 1;

export interface ExportedAsset {
  originalFileName: string;
  width: number | null;
  height: number | null;
  byteSize: number | null;
  dataBase64: string;
}

export interface ExportedDocument {
  id: string;
  jsonText: string;
  plainText: string;
  schemaVersion: number;
}

export interface ExportedMapCategory {
  id: string;
  label: string;
  sortOrder: number;
}

export interface ExportedMarkerCategory {
  id: string;
  label: string;
  defaultIconKey: string;
  defaultColor: string;
}

export interface ExportedMap {
  id: string;
  parentId: string | null;
  categoryId: string | null;
  name: string;
  descriptionDocumentId: string | null;
  deletedAt: string | null;
  asset: ExportedAsset | null;
}

export interface ExportedMarker {
  id: string;
  mapId: string;
  name: string;
  u: number;
  v: number;
  iconKey: string;
  color: string;
  backgroundColor: string;
  outlineColor: string;
  backgroundShape: string;
  categoryId: string | null;
  descriptionDocumentId: string | null;
  linkedMapId: string | null;
  locked: boolean;
  deletedAt: string | null;
}

export interface ExportBundle {
  exportVersion: typeof EXPORT_VERSION;
  exportedAt: string;
  worldName: string;
  mapCategories: ExportedMapCategory[];
  markerCategories: ExportedMarkerCategory[];
  documents: ExportedDocument[];
  maps: ExportedMap[];
  markers: ExportedMarker[];
}
