CREATE TABLE `map_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`layer_id` text,
	`kind` text NOT NULL,
	`points` text NOT NULL,
	`color` text DEFAULT '#E11D48' NOT NULL,
	`width` real NOT NULL,
	`style` text DEFAULT 'solid' NOT NULL,
	`dash_length` real DEFAULT 3 NOT NULL,
	`gap_length` real DEFAULT 2 NOT NULL,
	`cap` text DEFAULT 'round' NOT NULL,
	`opacity` real DEFAULT 1 NOT NULL,
	`shadow_enabled` integer DEFAULT false NOT NULL,
	`shadow_color` text DEFAULT '#000000' NOT NULL,
	`shadow_opacity` real DEFAULT 0.5 NOT NULL,
	`shadow_blur` real DEFAULT 0.5 NOT NULL,
	`shadow_distance` real DEFAULT 0.5 NOT NULL,
	`shadow_angle` real DEFAULT 45 NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `map_lines_map_idx` ON `map_lines` (`map_id`);--> statement-breakpoint
CREATE INDEX `map_lines_layer_idx` ON `map_lines` (`layer_id`);