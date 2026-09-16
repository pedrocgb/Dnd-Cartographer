CREATE TABLE `map_grids` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`shape` text DEFAULT 'square' NOT NULL,
	`columns` integer DEFAULT 100 NOT NULL,
	`rows` integer DEFAULT 100 NOT NULL,
	`horizontal_offset` real DEFAULT 0 NOT NULL,
	`vertical_offset` real DEFAULT 0 NOT NULL,
	`opacity` real DEFAULT 0.18 NOT NULL,
	`line_width` real DEFAULT 0.3 NOT NULL,
	`color` text DEFAULT '#FFFFFF' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `map_grids_map_idx` ON `map_grids` (`map_id`);