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
    categoryId: text("category_id").references(() => mapCategories.id),
    name: text("name").notNull(),
    descriptionDocumentId: text("description_document_id").references(
      () => richDocuments.id
    ),
    currentAssetId: text("current_asset_id"),
    revision: integer("revision").notNull().default(0),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    index("maps_world_idx").on(table.worldId),
    index("maps_parent_idx").on(table.parentId),
  ]
);

export const mapAssets = sqliteTable("map_assets", {
  id: id(),
  mapId: text("map_id")
    .notNull()
    .references(() => maps.id),
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
  (table) => [uniqueIndex("map_grids_map_idx").on(table.mapId)]
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
 * polygon: {points:[{x,y},...]}), always in the source image's own pixel
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
    mapId: text("map_id")
      .notNull()
      .references(() => maps.id),
    name: text("name").notNull(),
    shapeType: text("shape_type", { enum: ["rectangle", "circle", "polygon"] }).notNull(),
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
  description: text("description").notNull().default(""),
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
    description: text("description").notNull().default(""),
    parentId: text("parent_id"),
    hierarchyProfileId: text("hierarchy_profile_id")
      .notNull()
      .references(() => hierarchyProfiles.id),
    governmentForm: text("government_form"),
    powerHolders: text("power_holders"),
    leadershipSelection: text("leadership_selection"),
    autonomy: text("autonomy"),
    situation: text("situation"),
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
    description: text("description").notNull().default(""),
    houseId: text("house_id"),
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
    description: text("description").notNull().default(""),
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

export const schemaCheck = sql`PRAGMA foreign_keys = ON;`;
