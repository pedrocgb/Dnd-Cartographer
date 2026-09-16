CREATE TABLE `map_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`original_key` text NOT NULL,
	`manifest_key` text,
	`thumbnail_key` text,
	`width` integer,
	`height` integer,
	`byte_size` integer,
	`content_hash` text,
	`state` text DEFAULT 'uploading' NOT NULL,
	`generation` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `map_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`label` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `maps` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`parent_id` text,
	`category_id` text,
	`name` text NOT NULL,
	`description_document_id` text,
	`current_asset_id` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `map_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`description_document_id`) REFERENCES `rich_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `maps_world_idx` ON `maps` (`world_id`);--> statement-breakpoint
CREATE INDEX `maps_parent_idx` ON `maps` (`parent_id`);--> statement-breakpoint
CREATE TABLE `marker_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`label` text NOT NULL,
	`default_icon_key` text DEFAULT 'map-pin' NOT NULL,
	`default_color` text DEFAULT '#FFFFFF' NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `markers` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`name` text NOT NULL,
	`u` real NOT NULL,
	`v` real NOT NULL,
	`icon_key` text DEFAULT 'map-pin' NOT NULL,
	`color` text DEFAULT '#FFFFFF' NOT NULL,
	`category_id` text,
	`description_document_id` text,
	`linked_map_id` text,
	`locked` integer DEFAULT false NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `marker_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`description_document_id`) REFERENCES `rich_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `markers_map_idx` ON `markers` (`map_id`);--> statement-breakpoint
CREATE TABLE `processing_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`generation` integer NOT NULL,
	`state` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`lease_expires_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `map_assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rich_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`json_text` text NOT NULL,
	`plain_text` text DEFAULT '' NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `worlds` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
