import type { Marker } from "../MarkerLayer";

/** The marker fields the panel edits. */
export type MarkerPatch = Partial<
  Pick<
    Marker,
    | "name"
    | "iconKey"
    | "color"
    | "backgroundColor"
    | "outlineColor"
    | "backgroundShape"
    | "labelMode"
    | "importance"
    | "category"
    | "locked"
    | "linkedMapId"
    | "layerId"
    | "extraLayerIds"
    | "descriptionDocumentId"
    | "statusTags"
    | "environment"
    | "ownership"
  >
>;

export type MarkerUpdate = (patch: MarkerPatch) => void;
