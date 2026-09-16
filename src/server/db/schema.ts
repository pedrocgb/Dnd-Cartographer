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
    categoryId: text("category_id").references(() => markerCategories.id),
    descriptionDocumentId: text("description_document_id").references(
      () => richDocuments.id
    ),
    linkedMapId: text("linked_map_id"),
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
    horizontalOffset: real("horizontal_offset").notNull().default(0),
    verticalOffset: real("vertical_offset").notNull().default(0),
    opacity: real("opacity").notNull().default(0.18),
    lineWidth: real("line_width").notNull().default(0.3),
    color: text("color").notNull().default("#FFFFFF"),
    ...timestamps,
  },
  (table) => [uniqueIndex("map_grids_map_idx").on(table.mapId)]
);

export const schemaCheck = sql`PRAGMA foreign_keys = ON;`;
