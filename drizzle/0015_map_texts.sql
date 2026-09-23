CREATE TABLE `map_texts` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`layer_id` text,
	`text` text NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`rotation` real DEFAULT 0 NOT NULL,
	`font_size` real NOT NULL,
	`font_key` text NOT NULL,
	`bold` integer DEFAULT false NOT NULL,
	`color` text DEFAULT '#FFFFFF' NOT NULL,
	`letter_spacing` real DEFAULT 0 NOT NULL,
	`align` text DEFAULT 'center' NOT NULL,
	`curve` real DEFAULT 0 NOT NULL,
	`outline_enabled` integer DEFAULT false NOT NULL,
	`outline_color` text DEFAULT '#000000' NOT NULL,
	`outline_opacity` real DEFAULT 1 NOT NULL,
	`outline_width` real DEFAULT 0.08 NOT NULL,
	`shadow_enabled` integer DEFAULT false NOT NULL,
	`shadow_angle` real DEFAULT 45 NOT NULL,
	`shadow_distance` real DEFAULT 0.08 NOT NULL,
	`shadow_color` text DEFAULT '#000000' NOT NULL,
	`shadow_opacity` real DEFAULT 0.6 NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `map_texts_map_idx` ON `map_texts` (`map_id`);--> statement-breakpoint
CREATE INDEX `map_texts_layer_idx` ON `map_texts` (`layer_id`);