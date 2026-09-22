CREATE TABLE `zone_regions` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`name` text NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `zone_regions_map_idx` ON `zone_regions` (`map_id`);--> statement-breakpoint
CREATE TABLE `zones` (
	`id` text PRIMARY KEY NOT NULL,
	`region_id` text NOT NULL,
	`map_id` text NOT NULL,
	`name` text NOT NULL,
	`shape_type` text NOT NULL,
	`geometry` text NOT NULL,
	`fill_color` text DEFAULT '#FFFFFF' NOT NULL,
	`fill_opacity` real DEFAULT 0.25 NOT NULL,
	`stroke_color` text DEFAULT '#FFFFFF' NOT NULL,
	`stroke_opacity` real DEFAULT 1 NOT NULL,
	`stroke_width` real DEFAULT 0.15 NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`territory_id` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`region_id`) REFERENCES `zone_regions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `zones_region_idx` ON `zones` (`region_id`);--> statement-breakpoint
CREATE INDEX `zones_map_idx` ON `zones` (`map_id`);