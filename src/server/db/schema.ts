import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
};

export const worlds = sqliteTable("worlds", {
  id: id(),
  name: text("name").notNull(),
  ...timestamps,
});

export const richDocuments = sqliteTable("rich_documents", {
  id: id(),
  worldId: text("world_id")
    .notNull()
    .references(() => worlds.id),
  jsonText: text("json_text").notNull(),
  plainText: text("plain_text").notNull().default(""),
  schemaVersion: integer("schema_version").notNull().default(1),
  revision: integer("revision").notNull().default(0),
  ...timestamps,
});

export const mapCategories = sqliteTable(
  "map_categories",
  {
    id: id(),
    worldId: text("world_id")
      .notNull()
      .references(() => worlds.id),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [uniqueIndex("map_categories_world_label_idx").on(table.worldId, table.label)]
);

/**
 * Folders organizing the maps list (purely organizational — a map's parent
 * map is separate). Folders nest through `parentId`; deleting one removes
 * its subfolders and sends their maps back to the root, never deleting a map.
 */
export const mapFolders = sqliteTable(
  "map_folders",
  {
    id: id(),
    worldId: text("world_id")
      .notNull()
      .references(() => worlds.id),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    /** Icon tint (#RRGGBB); null uses the default folder color. */
    color: text("color"),
    ...timestamps,
  },
  (table) => [index("map_folders_world_idx").on(table.worldId)]
);

export const markerCategories = sqliteTable("marker_categories", {
  id: id(),
  worldId: text("world_id")
    .notNull()
    .references(() => worlds.id),
  label: text("label").notNull(),
  defaultIconKey: text("default_icon_key").notNull().default("map-pin"),
  defaultColor: text("default_color").notNull().default("#FFFFFF"),
});

export const maps = sqliteTable(
  "maps",
  {
    id: id(),
    worldId: text("world_id")
      .notNull()
      .references(() => worlds.id),
    parentId: text("parent_id"),
    /** The maps-list folder it's filed in (null: not in a folder). */
    folderId: text("folder_id"),
    categoryId: text("category_id").references(() => mapCategories.id),
    name: text("name").notNull(),
    descriptionDocumentId: text("description_document_id").references(
      () => richDocuments.id
    ),
    currentAssetId: text("current_asset_id"),
    // The map's canonical coordinate frame (source pixels), fixed by the
    // first image ever uploaded. Every layer image is stretched to it, so
    // marker u/v, zone geometry and grids line up on every layer.
    frameWidth: integer("frame_width"),
    frameHeight: integer("frame_height"),
    revision: integer("revision").notNull().default(0),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    index("maps_world_idx").on(table.worldId),
    index("maps_parent_idx").on(table.parentId),
  ]
);

/**
 * A map-local layer owning markers, zone regions (and their zones), one
 * grid and an optional image. Lower sortOrder = higher in the list = drawn
 * on top. `assetId` has no FK, same convention as maps.currentAssetId.
 */
export const mapLayers = sqliteTable(
  "map_layers",
  {
    id: id(),
    mapId: text("map_id")
      .notNull()
      .references(() => maps.id),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    visible: integer("visible", { mode: "boolean" }).notNull().default(true),
    assetId: text("asset_id"),
    imageOpacity: real("image_opacity").notNull().default(1),
    imageAlwaysVisible: integer("image_always_visible", { mode: "boolean" }).notNull().default(false),
    // "Always draw" this layer's items even while another layer is active.
    zonesAlwaysVisible: integer("zones_always_visible", { mode: "boolean" }).notNull().default(false),
    markersAlwaysVisible: integer("markers_always_visible", { mode: "boolean" }).notNull().default(false),
    textsAlwaysVisible: integer("texts_always_visible", { mode: "boolean" }).notNull().default(false),
    linesAlwaysVisible: integer("lines_always_visible", { mode: "boolean" }).notNull().default(false),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("map_layers_map_idx").on(table.mapId)]
);

export const mapAssets = sqliteTable("map_assets", {
  id: id(),
  mapId: text("map_id")
    .notNull()
    .references(() => maps.id),
  // The layer this upload targets (set on that layer once processed).
  layerId: text("layer_id"),
  originalKey: text("original_key").notNull(),
  manifestKey: text("manifest_key"),
  thumbnailKey: text("thumbnail_key"),
  width: integer("width"),
  height: integer("height"),
  byteSize: integer("byte_size"),
  contentHash: text("content_hash"),
  state: text("state", {
    enum: ["uploading", "queued", "processing", "ready", "failed", "cancelled"],
  })
    .notNull()
    .default("uploading"),
  generation: integer("generation").notNull().default(1),
  ...timestamps,
});

export const processingJobs = sqliteTable("processing_jobs", {
  id: id(),
  assetId: text("asset_id")
    .notNull()
    .references(() => mapAssets.id),
  generation: integer("generation").notNull(),
  state: text("state", {
    enum: ["queued", "processing", "done", "failed"],
  })
    .notNull()
    .default("queued"),
  attempts: integer("attempts").notNull().default(0),
  leaseExpiresAt: integer("lease_expires_at", { mode: "timestamp_ms" }),
  lastError: text("last_error"),
  ...timestamps,
});

export const markers = sqliteTable(
  "markers",
  {
    id: id(),
    mapId: text("map_id")
      .notNull()
      .references(() => maps.id),
    // Nullable at DB level (added by ALTER); the API always sets it.
    layerId: text("layer_id"),
    // JSON string[] of other layers this item is also shown (and editable) on.
    extraLayerIds: text("extra_layer_ids").notNull().default("[]"),
    name: text("name").notNull(),
    u: real("u").notNull(),
    v: real("v").notNull(),
    iconKey: text("icon_key").notNull().default("map-pin"),
    color: text("color").notNull().default("#FFFFFF"),
    backgroundColor: text("background_color").notNull().default("#141416"),
    outlineColor: text("outline_color").notNull().default("#0D0E10"),
    backgroundShape: text("background_shape").notNull().default("circle"),
    // A user-editable classification, independent of both categoryId (the
    // unused markerCategories FK below) and the icon's own static group —
    // it merely defaults from the icon's group at creation time.
    category: text("category"),
    categoryId: text("category_id").references(() => markerCategories.id),
    descriptionDocumentId: text("description_document_id").references(
      () => richDocuments.id
    ),
    linkedMapId: text("linked_map_id"),
    // JSON-encoded string[] of status tag keys — stored as plain text and
    // (de)serialized in application code, following the same convention as
    // richDocuments.jsonText rather than drizzle's typed json column mode.
    statusTags: text("status_tags").notNull().default("[]"),
    environment: text("environment"),
    ownership: text("ownership"),
    visible: integer("visible", { mode: "boolean" }).notNull().default(true),
    locked: integer("locked", { mode: "boolean" }).notNull().default(false),
    revision: integer("revision").notNull().default(0),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("markers_map_idx").on(table.mapId)]
);

export const mapGrids = sqliteTable(
  "map_grids",
  {
    id: id(),
    mapId: text("map_id")
      .notNull()
      .references(() => maps.id),
    layerId: text("layer_id"),
    shape: text("shape").notNull().default("square"),
    columns: integer("columns").notNull().default(100),
    rows: integer("rows").notNull().default(100),
    linkedColumnsRows: integer("linked_columns_rows", { mode: "boolean" }).notNull().default(false),
    horizontalOffset: real("horizontal_offset").notNull().default(0),
    verticalOffset: real("vertical_offset").notNull().default(0),
    opacity: real("opacity").notNull().default(0.18),
    lineWidth: real("line_width").notNull().default(0.3),
    color: text("color").notNull().default("#FFFFFF"),
    ...timestamps,
  },
  (table) => [index("map_grids_map_idx").on(table.mapId), uniqueIndex("map_grids_layer_idx").on(table.layerId)]
);

/**
 * A map-local folder/layer grouping zones (e.g. "Duchies", "Forests",
 * "Danger Areas") — organizational only, with no automatic political
 * meaning even when named after a territory type.
 */
export const zoneRegions = sqliteTable(
  "zone_regions",
  {
    id: id(),
    mapId: text("map_id")
      .notNull()
      .references(() => maps.id),
    layerId: text("layer_id"),
    name: text("name").notNull(),
    visible: integer("visible", { mode: "boolean" }).notNull().default(true),
    locked: integer("locked", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("zone_regions_map_idx").on(table.mapId)]
);

/**
 * One drawn shape inside a Zone Region. `geometry` is JSON-encoded and
 * shape-dependent (rectangle: {x,y,width,height}; circle: {x,y,radius};
 * polygon: {points:[{x,y},...]}; area: {polygons: MultiPolygon} — painted
 * with the brush/eraser, may have holes and separate parts), always in the source image's own pixel
 * coordinate space — following the same "JSON as plain text" convention as
 * markers.statusTags rather than a typed column, since the shape varies by
 * shapeType. `territoryId` is an optional, descriptive-only reference to an
 * existing political territory (no DB FK, same convention as
 * markers.linkedMapId) — it never affects political hierarchy or marker
 * affiliation.
 */
export const zones = sqliteTable(
  "zones",
  {
    id: id(),
    regionId: text("region_id")
      .notNull()
      .references(() => zoneRegions.id),
    // JSON string[] of other layers this item is also shown (and editable) on.
    extraLayerIds: text("extra_layer_ids").notNull().default("[]"),
    mapId: text("map_id")
      .notNull()
      .references(() => maps.id),
    name: text("name").notNull(),
    shapeType: text("shape_type", { enum: ["rectangle", "circle", "polygon", "area"] }).notNull(),
    geometry: text("geometry").notNull(),
    fillColor: text("fill_color").notNull().default("#FFFFFF"),
    fillOpacity: real("fill_opacity").notNull().default(0.25),
    strokeColor: text("stroke_color").notNull().default("#FFFFFF"),
    strokeOpacity: real("stroke_opacity").notNull().default(1),
    strokeWidth: real("stroke_width").notNull().default(0.15),
    visible: integer("visible", { mode: "boolean" }).notNull().default(true),
    locked: integer("locked", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    territoryId: text("territory_id"),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("zones_region_idx").on(table.regionId), index("zones_map_idx").on(table.mapId)]
);

/**
 * A styled map label placed on one layer. Position (`x`,`y` = center) and
 * `fontSize` are in the map frame's pixel space; spacing/outline/shadow
 * sizes are in em so they scale with the font. Validated by
 * src/server/texts/text-config.ts.
 */
export const mapTexts = sqliteTable(
  "map_texts",
  {
    id: id(),
    mapId: text("map_id")
      .notNull()
      .references(() => maps.id),
    layerId: text("layer_id"),
    // JSON string[] of other layers this item is also shown (and editable) on.
    extraLayerIds: text("extra_layer_ids").notNull().default("[]"),
    text: text("text").notNull(),
    x: real("x").notNull(),
    y: real("y").notNull(),
    rotation: real("rotation").notNull().default(0),
    fontSize: real("font_size").notNull(),
    fontKey: text("font_key").notNull(),
    bold: integer("bold", { mode: "boolean" }).notNull().default(false),
    color: text("color").notNull().default("#FFFFFF"),
    letterSpacing: real("letter_spacing").notNull().default(0),
    align: text("align", { enum: ["left", "center", "right"] }).notNull().default("center"),
    curve: real("curve").notNull().default(0),
    outlineEnabled: integer("outline_enabled", { mode: "boolean" }).notNull().default(false),
    outlineColor: text("outline_color").notNull().default("#000000"),
    outlineOpacity: real("outline_opacity").notNull().default(1),
    outlineWidth: real("outline_width").notNull().default(0.08),
    shadowEnabled: integer("shadow_enabled", { mode: "boolean" }).notNull().default(false),
    shadowAngle: real("shadow_angle").notNull().default(45),
    shadowDistance: real("shadow_distance").notNull().default(0.08),
    shadowColor: text("shadow_color").notNull().default("#000000"),
    shadowOpacity: real("shadow_opacity").notNull().default(0.6),
    visible: integer("visible", { mode: "boolean" }).notNull().default(true),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("map_texts_map_idx").on(table.mapId), index("map_texts_layer_idx").on(table.layerId)]
);

/**
 * A drawn map line on one layer. `points` is JSON text in frame pixels —
 * pen lines: [{x,y,cin?,cout?}] with absolute Bézier handles; free-drawn:
 * [{x,y}]. Dash/gap/shadow sizes are multiples of `width`. Validated by
 * src/server/lines/line-config.ts.
 */
export const mapLines = sqliteTable(
  "map_lines",
  {
    id: id(),
    mapId: text("map_id")
      .notNull()
      .references(() => maps.id),
    layerId: text("layer_id"),
    // JSON string[] of other layers this item is also shown (and editable) on.
    extraLayerIds: text("extra_layer_ids").notNull().default("[]"),
    kind: text("kind", { enum: ["free", "pen"] }).notNull(),
    points: text("points").notNull(),
    color: text("color").notNull().default("#E11D48"),
    width: real("width").notNull(),
    style: text("style", { enum: ["solid", "dot", "dashed"] }).notNull().default("solid"),
    dashLength: real("dash_length").notNull().default(3),
    gapLength: real("gap_length").notNull().default(2),
    cap: text("cap", { enum: ["round", "square"] }).notNull().default("round"),
    opacity: real("opacity").notNull().default(1),
    shadowEnabled: integer("shadow_enabled", { mode: "boolean" }).notNull().default(false),
    shadowColor: text("shadow_color").notNull().default("#000000"),
    shadowOpacity: real("shadow_opacity").notNull().default(0.5),
    shadowBlur: real("shadow_blur").notNull().default(0.5),
    shadowDistance: real("shadow_distance").notNull().default(0.5),
    shadowAngle: real("shadow_angle").notNull().default(45),
    visible: integer("visible", { mode: "boolean" }).notNull().default(true),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("map_lines_map_idx").on(table.mapId), index("map_lines_layer_idx").on(table.layerId)]
);

// ---------- Politics ----------

/**
 * A named, reusable rule-set governing one branch of the administrative
 * tree. `levels` is JSON-encoded `HierarchyLevel[]` (see
 * src/server/politics/hierarchy-config.ts) — kept as a single text column,
 * following the same convention as markers.statusTags, rather than a
 * separate rules table, since rules are only ever read/written as a whole
 * per profile.
 */
export const hierarchyProfiles = sqliteTable("hierarchy_profiles", {
  id: id(),
  worldId: text("world_id").notNull().references(() => worlds.id),
  name: text("name").notNull(),
  descriptionDocumentId: text("description_document_id").references(() => richDocuments.id),
  levels: text("levels").notNull().default("[]"),
  ...timestamps,
});

/**
 * A political territory (Kingdom, Duchy, County, custom types, ...),
 * independent of any map. `parentId` is a plain self-referencing text
 * column with no DB-level FK (consistent with markers.linkedMapId
 * elsewhere in this schema) — validated in application code instead, since
 * Drizzle's sqlite self-referencing FKs require awkward type gymnastics
 * for no real safety gain in a single-process local app.
 */
export const territories = sqliteTable(
  "territories",
  {
    id: id(),
    worldId: text("world_id").notNull().references(() => worlds.id),
    name: text("name").notNull(),
    type: text("type").notNull(),
    descriptionDocumentId: text("description_document_id").references(() => richDocuments.id),
    parentId: text("parent_id"),
    hierarchyProfileId: text("hierarchy_profile_id")
      .notNull()
      .references(() => hierarchyProfiles.id),
    governmentForm: text("government_form"),
    powerHolders: text("power_holders"),
    leadershipSelection: text("leadership_selection"),
    autonomy: text("autonomy"),
    situation: text("situation"),
    // Relative storage key for the uploaded "Coat of arms" image (see
    // src/server/assets/portrait-paths.ts), or null if none uploaded yet.
    portraitKey: text("portrait_key"),
    // Article layer: manual tags (JSON string[]), the sidebar and optional footer documents.
    tags: text("tags").notNull().default("[]"),
    sidebarDocumentId: text("sidebar_document_id").references(() => richDocuments.id),
    footerDocumentId: text("footer_document_id").references(() => richDocuments.id),
    // Info Bar values (JSON; see src/server/articles/info-fields.ts).
    info: text("info").notNull().default("{}"),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("territories_world_idx").on(table.worldId), index("territories_parent_idx").on(table.parentId)]
);

/** A named person — a ruler, claimant, or any other political figure. */
export const people = sqliteTable(
  "people",
  {
    id: id(),
    worldId: text("world_id").notNull().references(() => worlds.id),
    name: text("name").notNull(),
    // Which article this person is: a Character ("npc") or a Player Character ("player").
    kind: text("kind", { enum: ["npc", "player"] }).notNull().default("npc"),
    descriptionDocumentId: text("description_document_id").references(() => richDocuments.id),
    houseId: text("house_id"),
    // Relative storage key for the uploaded "Image" (portrait), or null.
    portraitKey: text("portrait_key"),
    status: text("status"),
    // Character article info fields added so far: JSON { [fieldKey]: string | string[] | null }
    // (see src/server/articles/info-fields.ts). House and status keep their own columns.
    info: text("info").notNull().default("{}"),
    // Article layer: manual tags (JSON string[]), the sidebar and optional footer documents.
    tags: text("tags").notNull().default("[]"),
    sidebarDocumentId: text("sidebar_document_id").references(() => richDocuments.id),
    footerDocumentId: text("footer_document_id").references(() => richDocuments.id),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("people_world_idx").on(table.worldId)]
);

/** A noble house, council, clan, or religious institution. */
export const organizations = sqliteTable(
  "organizations",
  {
    id: id(),
    worldId: text("world_id").notNull().references(() => worlds.id),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("House"),
    descriptionDocumentId: text("description_document_id").references(() => richDocuments.id),
    // Relative storage key for the uploaded "Crest" image, or null.
    portraitKey: text("portrait_key"),
    // Article layer: manual tags (JSON string[]), the sidebar and optional footer documents.
    tags: text("tags").notNull().default("[]"),
    sidebarDocumentId: text("sidebar_document_id").references(() => richDocuments.id),
    footerDocumentId: text("footer_document_id").references(() => richDocuments.id),
    // Info Bar values (JSON; see src/server/articles/info-fields.ts).
    info: text("info").notNull().default("{}"),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("organizations_world_idx").on(table.worldId)]
);

/**
 * A person or organization holding a role over a territory. Multiple rows
 * per territory support co-rulers and a council coexisting with a monarch;
 * multiple rows per holder support one person holding several offices.
 */
export const authorityAssignments = sqliteTable(
  "authority_assignments",
  {
    id: id(),
    worldId: text("world_id").notNull().references(() => worlds.id),
    territoryId: text("territory_id")
      .notNull()
      .references(() => territories.id),
    holderType: text("holder_type", { enum: ["person", "organization"] }).notNull(),
    holderId: text("holder_id").notNull(),
    role: text("role").notNull(),
    title: text("title").notNull().default(""),
    notes: text("notes").notNull().default(""),
    ...timestamps,
  },
  (table) => [index("authority_territory_idx").on(table.territoryId)]
);

/** Capital or administrative-seat role linking a territory to a marker. */
export const territorySeats = sqliteTable(
  "territory_seats",
  {
    id: id(),
    worldId: text("world_id").notNull().references(() => worlds.id),
    territoryId: text("territory_id")
      .notNull()
      .references(() => territories.id),
    markerId: text("marker_id")
      .notNull()
      .references(() => markers.id),
    role: text("role", { enum: ["capital", "seat"] }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("territory_seats_unique_idx").on(table.territoryId, table.role),
    index("territory_seats_marker_idx").on(table.markerId),
  ]
);

/**
 * A marker's political affiliation — at most one `accepted` row and at
 * most one `draft` row per marker, enforced by the unique index. Draft and
 * accepted are kept as separate rows (not a single mutable row) so an
 * in-progress incomplete draft never clobbers a previously accepted,
 * complete affiliation.
 */
export const markerAffiliations = sqliteTable(
  "marker_affiliations",
  {
    id: id(),
    markerId: text("marker_id")
      .notNull()
      .references(() => markers.id),
    territoryId: text("territory_id")
      .notNull()
      .references(() => territories.id),
    status: text("status", { enum: ["accepted", "draft"] }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("marker_affiliation_unique_idx").on(table.markerId, table.status)]
);

/**
 * A labeled relationship from a marker or territory to a person or
 * organization that falls short of an authority assignment (e.g. a
 * claimant, an advisor) — a mention, not conferred rule.
 */
export const politicalReferences = sqliteTable(
  "political_references",
  {
    id: id(),
    worldId: text("world_id").notNull().references(() => worlds.id),
    sourceType: text("source_type", { enum: ["marker", "territory"] }).notNull(),
    sourceId: text("source_id").notNull(),
    targetType: text("target_type", { enum: ["person", "organization"] }).notNull(),
    targetId: text("target_id").notNull(),
    label: text("label").notNull().default(""),
    ...timestamps,
  },
  (table) => [index("political_ref_source_idx").on(table.sourceType, table.sourceId)]
);

/**
 * A generic link from any political-adjacent owner (a marker, territory,
 * person, or organization) to an internal record or an external URL. One
 * shared table for every "Add link" affordance in the feature, rather than
 * a parallel table per owner type.
 */
export const politicalLinks = sqliteTable(
  "political_links",
  {
    id: id(),
    worldId: text("world_id").notNull().references(() => worlds.id),
    ownerType: text("owner_type", { enum: ["marker", "territory", "person", "organization"] }).notNull(),
    ownerId: text("owner_id").notNull(),
    targetType: text("target_type", { enum: ["map", "marker", "territory", "person", "organization"] }),
    targetId: text("target_id"),
    externalUrl: text("external_url"),
    label: text("label").notNull().default(""),
    ...timestamps,
  },
  (table) => [
    index("political_links_owner_idx").on(table.ownerType, table.ownerId),
    index("political_links_target_idx").on(table.targetType, table.targetId),
  ]
);

/**
 * An article linked to a marker (the marker panel's Articles tab): any
 * template — `template` says which table `articleId` lives in (see
 * src/server/articles/templates.ts). Replaces the marker-sourced
 * political_references rows, which migration 0023 copied here.
 */
export const markerArticleLinks = sqliteTable(
  "marker_article_links",
  {
    id: id(),
    worldId: text("world_id").notNull().references(() => worlds.id),
    markerId: text("marker_id").notNull(),
    template: text("template").notNull(),
    articleId: text("article_id").notNull(),
    // Optional relationship to the marker (e.g. "Lord of this keep").
    label: text("label").notNull().default(""),
    ...timestamps,
  },
  (table) => [index("marker_article_links_marker_idx").on(table.markerId)]
);

// ---------- Articles ----------

/**
 * A user-written wiki article from one of the generic templates (see
 * src/server/articles/templates.ts). Territory, character and organization
 * articles live in their politics tables, which carry the same tags and
 * sidebar columns. `tags` holds only manual tags — the template tag is
 * implicit.
 */
export const articles = sqliteTable(
  "articles",
  {
    id: id(),
    worldId: text("world_id").notNull().references(() => worlds.id),
    template: text("template").notNull(),
    title: text("title").notNull(),
    tags: text("tags").notNull().default("[]"),
    bodyDocumentId: text("body_document_id").references(() => richDocuments.id),
    sidebarDocumentId: text("sidebar_document_id").references(() => richDocuments.id),
    footerDocumentId: text("footer_document_id").references(() => richDocuments.id),
    // Relative storage key for the article's image (see src/server/assets/portrait-paths.ts).
    portraitKey: text("portrait_key"),
    // Info Bar values (JSON; see src/server/articles/info-fields.ts).
    info: text("info").notNull().default("{}"),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("articles_world_template_idx").on(table.worldId, table.template)]
);

export const schemaCheck = sql`PRAGMA foreign_keys = ON;`;

// ---------- Calendars (fantasy dates: years, months, days only) ----------
// One shared chronology per world: `currentDay` is a signed physical-day
// offset from an arbitrary epoch ("worldDay"). Calendars only label it.

/** The world's shared current day and default calendar; `revision` rejects stale writes. */
export const worldChronology = sqliteTable("world_chronology", {
  worldId: text("world_id")
    .primaryKey()
    .references(() => worlds.id),
  currentDay: integer("current_day").notNull().default(0),
  defaultCalendarId: text("default_calendar_id"),
  revision: integer("revision").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** A cultural calendar. `definition` is the engine's CalendarDefinition JSON; `version` rejects stale edits. */
export const calendars = sqliteTable(
  "calendars",
  {
    id: id(),
    worldId: text("world_id")
      .notNull()
      .references(() => worlds.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    definition: text("definition").notNull(),
    /** JSON [{ template, articleId }]. */
    articleLinks: text("article_links").notNull().default("[]"),
    version: integer("version").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("calendars_world_idx").on(table.worldId)]
);

/** World-scope sun / moons / stars / … shared by every calendar. `config` is the celestial evaluator's CelestialConfig JSON. */
export const celestialObjects = sqliteTable(
  "celestial_objects",
  {
    id: id(),
    worldId: text("world_id")
      .notNull()
      .references(() => worlds.id),
    type: text("type").notNull(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#E8E3D5"),
    icon: text("icon").notNull().default(""),
    description: text("description").notNull().default(""),
    articleLinks: text("article_links").notNull().default("[]"),
    config: text("config").notNull().default("{}"),
    /** Draw its small symbol on calendar days (off for an always-there sun, say). Day details list it either way. */
    showDayIcon: integer("show_day_icon", { mode: "boolean" }).notNull().default(true),
    /** Drawn before the others on calendar days (prioritized ones among themselves by name). */
    prioritizeDayIcon: integer("prioritize_day_icon", { mode: "boolean" }).notNull().default(false),
    /** JSON list of the calendar ids it shows in; NULL = every calendar, new ones included. */
    calendarIds: text("calendar_ids"),
    version: integer("version").notNull().default(1),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("celestial_objects_world_idx").on(table.worldId)]
);

/** A reusable named season (its timing lives on each profile's membership). */
export const seasons = sqliteTable(
  "seasons",
  {
    id: id(),
    worldId: text("world_id")
      .notNull()
      .references(() => worlds.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    color: text("color").notNull().default("#47BFAB"),
    icon: text("icon").notNull().default(""),
    articleLinks: text("article_links").notNull().default("[]"),
    /** The calendar whose profiles can use it; NULL = shared by every calendar. */
    calendarId: text("calendar_id"),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("seasons_world_idx").on(table.worldId)]
);

/** A named season schedule read in `calendarId`. `data` is SeasonProfileData minus calendarId. Articles reference it by id. */
export const seasonProfiles = sqliteTable(
  "season_profiles",
  {
    id: id(),
    worldId: text("world_id")
      .notNull()
      .references(() => worlds.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    calendarId: text("calendar_id").notNull(),
    data: text("data").notNull(),
    /** The generic profile Calendars previews by default (not a geographic assignment). */
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    version: integer("version").notNull().default(1),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("season_profiles_world_idx").on(table.worldId)]
);

/**
 * A dated note, event or direct article link, bound to the absolute
 * `worldDay` (its start). Events may recur (rule + exceptions stored once;
 * occurrences are evaluated per requested range). `source` keeps the
 * calendar/date it was entered in (provenance; worldDay stays authoritative).
 */
export const calendarEntries = sqliteTable(
  "calendar_entries",
  {
    id: id(),
    worldId: text("world_id")
      .notNull()
      .references(() => worlds.id),
    kind: text("kind", { enum: ["note", "event", "link"] }).notNull(),
    worldDay: integer("world_day").notNull(),
    durationDays: integer("duration_days").notNull().default(1),
    title: text("title").notNull().default(""),
    description: text("description").notNull().default(""),
    documentId: text("document_id").references(() => richDocuments.id),
    category: text("category").notNull().default(""),
    color: text("color").notNull().default(""),
    /** Direct link: the article. */
    articleTemplate: text("article_template"),
    articleId: text("article_id"),
    /** Events: JSON [{ template, articleId }]. */
    articleLinks: text("article_links").notNull().default("[]"),
    recurrence: text("recurrence").notNull().default('{"kind":"none"}'),
    untilDay: integer("until_day"),
    exceptions: text("exceptions").notNull().default("{}"),
    source: text("source"),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("calendar_entries_world_day_idx").on(table.worldId, table.worldDay), index("calendar_entries_article_idx").on(table.articleId)]
);

/** Restorable snapshots taken before a definition changes (calendars, celestial objects, season profiles). */
export const definitionRevisions = sqliteTable(
  "definition_revisions",
  {
    id: id(),
    worldId: text("world_id")
      .notNull()
      .references(() => worlds.id),
    subjectType: text("subject_type", { enum: ["calendar", "celestial", "profile"] }).notNull(),
    subjectId: text("subject_id").notNull(),
    version: integer("version").notNull(),
    /** JSON: the subject's previous definition, plus any entry days a migration changed. */
    snapshot: text("snapshot").notNull(),
    reason: text("reason").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("definition_revisions_subject_idx").on(table.subjectType, table.subjectId)]
);

/** A campaign: a party playing sessions in this world. In-world dates are entered and shown in `calendarId`. */
export const campaigns = sqliteTable(
  "campaigns",
  {
    id: id(),
    worldId: text("world_id")
      .notNull()
      .references(() => worlds.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    calendarId: text("calendar_id").notNull(),
    /** JSON [{ id, name, short, value }]: value in the smallest unit. */
    currencies: text("currencies").notNull().default("[]"),
    status: text("status", { enum: ["active", "finished"] }).notNull().default("active"),
    /** JSON { [nodeId]: { x, y } }: where the DM dragged the quest map's nodes. */
    questMap: text("quest_map").notNull().default("{}"),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("campaigns_world_idx").on(table.worldId)]
);

/** The party roster: player characters (Character articles, the `people` table) in a campaign. */
export const campaignCharacters = sqliteTable(
  "campaign_characters",
  {
    id: id(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    personId: text("person_id")
      .notNull()
      .references(() => people.id),
    // Unused: the player is read from the Player Character article's Controlling Player.
    playerName: text("player_name").notNull().default(""),
    status: text("status", { enum: ["active", "retired", "dead"] }).notNull().default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [uniqueIndex("campaign_characters_unique").on(table.campaignId, table.personId)]
);

/** One game session of a campaign: recap, notes, who/where was involved, attendance, XP, loot and coins. */
export const sessions = sqliteTable(
  "sessions",
  {
    id: id(),
    worldId: text("world_id")
      .notNull()
      .references(() => worlds.id),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    number: integer("number").notNull(),
    title: text("title").notNull().default(""),
    /** Real-life play date, ISO YYYY-MM-DD. */
    playedOn: text("played_on"),
    /** In-world span (worldDay, inclusive). */
    startDay: integer("start_day"),
    endDay: integer("end_day"),
    recapDocumentId: text("recap_document_id").references(() => richDocuments.id),
    /** JSON { events, decisions, nextSession } (open threads moved to quests). */
    notes: text("notes").notNull().default("{}"),
    /** JSON [{ template, articleId }]: NPCs, places, organizations, items involved. */
    articleLinks: text("article_links").notNull().default("[]"),
    /** JSON personId[] of the PCs who played. */
    attendance: text("attendance").notNull().default("[]"),
    xpTotal: integer("xp_total"),
    /** JSON { [personId]: xp } replacing the even split. */
    xpOverrides: text("xp_overrides").notNull().default("{}"),
    /** JSON [{ id, name, template?, articleId?, quantity, value?, recipient }]; recipient = personId or "party". */
    loot: text("loot").notNull().default("[]"),
    /** JSON [{ id, currencyId, amount, recipient }]; negative = spent. */
    coins: text("coins").notNull().default("[]"),
    /** JSON [{ questId, action, note, objectiveIds, clueIds, clockTicks, rewardsAdded }]: what happened to the campaign's quests (their history). */
    questLog: text("quest_log").notNull().default("[]"),
    version: integer("version").notNull().default(1),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("sessions_campaign_idx").on(table.campaignId, table.number), index("sessions_world_day_idx").on(table.worldId, table.startDay)]
);

/** A campaign's quest or plot thread: objectives, involved articles, sub-quests (see src/server/quests). */
export const quests = sqliteTable(
  "quests",
  {
    id: id(),
    worldId: text("world_id")
      .notNull()
      .references(() => worlds.id),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    /** Parent quest (a sub-quest); never a cycle. */
    parentId: text("parent_id"),
    title: text("title").notNull(),
    kind: text("kind", { enum: ["main", "side", "personal", "faction", "rumor"] }).notNull().default("side"),
    status: text("status", { enum: ["hook", "active", "onHold", "completed", "failed", "abandoned"] }).notNull().default("hook"),
    priority: integer("priority").notNull().default(1),
    summary: text("summary").notNull().default(""),
    bodyDocumentId: text("body_document_id").references(() => richDocuments.id),
    /** JSON { template, articleId } or null: who gave the quest. */
    giver: text("giver"),
    /** JSON [{ template, articleId, role }]. */
    articleLinks: text("article_links").notNull().default("[]"),
    /** JSON [{ id, text, state, optional }]. */
    objectives: text("objectives").notNull().default("[]"),
    /** The front (threat) it belongs to, or null. */
    frontId: text("front_id"),
    /** JSON [{ id, text, placedIn: [{ template, articleId }], revealed, revealedSessionId }]: secrets & clues. */
    clues: text("clues").notNull().default("[]"),
    /** JSON { segments, filled, label } or null: its progress clock. */
    clock: text("clock"),
    /** JSON { xp, coins: [{ currencyId, amount }], items: [{ id, name, template, articleId, quantity }] } or null. */
    rewards: text("rewards"),
    /** In-world days (the shared day count): when it started, when it's due, when it ended; each optional. */
    startDay: integer("start_day"),
    deadlineDay: integer("deadline_day"),
    endDay: integer("end_day"),
    /** Order within its board column. */
    sortOrder: integer("sort_order").notNull().default(0),
    version: integer("version").notNull().default(1),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("quests_campaign_status_idx").on(table.campaignId, table.status), index("quests_world_deadline_idx").on(table.worldId, table.deadlineDay)]
);

/** A campaign's front (Dungeon World): a threat with grim portents and an impending doom; quests can sit under it. */
export const fronts = sqliteTable(
  "fronts",
  {
    id: id(),
    worldId: text("world_id")
      .notNull()
      .references(() => worlds.id),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["campaign", "adventure"] }).notNull().default("adventure"),
    status: text("status", { enum: ["active", "averted", "doom"] }).notNull().default("active"),
    threat: text("threat").notNull().default(""),
    doom: text("doom").notNull().default(""),
    /** JSON [{ id, text, happened }], in the order they come. */
    portents: text("portents").notNull().default("[]"),
    /** JSON { segments, filled, label } or null. */
    clock: text("clock"),
    /** The clock fills once per grim portent: full marks the next portent, then it starts over. */
    clockPerPortent: integer("clock_per_portent", { mode: "boolean" }).notNull().default(false),
    color: text("color"),
    sortOrder: integer("sort_order").notNull().default(0),
    version: integer("version").notNull().default(1),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("fronts_campaign_idx").on(table.campaignId)]
);
