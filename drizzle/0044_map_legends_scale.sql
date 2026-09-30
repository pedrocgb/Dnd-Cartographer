CREATE TABLE `map_legends` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`layer_id` text NOT NULL,
	`extra_layer_ids` text DEFAULT '[]' NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `map_legends_map_idx` ON `map_legends` (`map_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `map_legends_layer_idx` ON `map_legends` (`layer_id`);--> statement-breakpoint
CREATE TABLE `map_scale_bars` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`visible` integer DEFAULT false NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `map_scale_bars_map_idx` ON `map_scale_bars` (`map_id`);