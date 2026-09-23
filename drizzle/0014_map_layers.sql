CREATE TABLE `map_layers` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`asset_id` text,
	`image_opacity` real DEFAULT 1 NOT NULL,
	`image_always_visible` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `map_layers_map_idx` ON `map_layers` (`map_id`);--> statement-breakpoint
DROP INDEX `map_grids_map_idx`;--> statement-breakpoint
ALTER TABLE `map_grids` ADD `layer_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `map_grids_layer_idx` ON `map_grids` (`layer_id`);--> statement-breakpoint
CREATE INDEX `map_grids_map_idx` ON `map_grids` (`map_id`);--> statement-breakpoint
ALTER TABLE `map_assets` ADD `layer_id` text;--> statement-breakpoint
ALTER TABLE `maps` ADD `frame_width` integer;--> statement-breakpoint
ALTER TABLE `maps` ADD `frame_height` integer;--> statement-breakpoint
ALTER TABLE `markers` ADD `layer_id` text;--> statement-breakpoint
ALTER TABLE `zone_regions` ADD `layer_id` text;--> statement-breakpoint
INSERT INTO `map_layers` (`id`, `map_id`, `name`, `sort_order`, `visible`, `asset_id`, `image_opacity`, `image_always_visible`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(16))), `id`, 'Layer 1', 0, 1, `current_asset_id`, 1, 0, CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000 FROM `maps`;--> statement-breakpoint
UPDATE `maps` SET
  `frame_width` = (SELECT `width` FROM `map_assets` WHERE `map_assets`.`id` = `maps`.`current_asset_id`),
  `frame_height` = (SELECT `height` FROM `map_assets` WHERE `map_assets`.`id` = `maps`.`current_asset_id`);--> statement-breakpoint
UPDATE `map_assets` SET `layer_id` = (SELECT `id` FROM `map_layers` WHERE `map_layers`.`map_id` = `map_assets`.`map_id`);--> statement-breakpoint
UPDATE `markers` SET `layer_id` = (SELECT `id` FROM `map_layers` WHERE `map_layers`.`map_id` = `markers`.`map_id`);--> statement-breakpoint
UPDATE `zone_regions` SET `layer_id` = (SELECT `id` FROM `map_layers` WHERE `map_layers`.`map_id` = `zone_regions`.`map_id`);--> statement-breakpoint
UPDATE `map_grids` SET `layer_id` = (SELECT `id` FROM `map_layers` WHERE `map_layers`.`map_id` = `map_grids`.`map_id`);
