CREATE TABLE `text_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`layer_id` text NOT NULL,
	`name` text NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`extra_layer_ids` text DEFAULT '[]' NOT NULL,
	`default_style` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `text_groups_map_idx` ON `text_groups` (`map_id`);--> statement-breakpoint
ALTER TABLE `line_groups` ADD `extra_layer_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `line_groups` ADD `default_style` text;--> statement-breakpoint
ALTER TABLE `map_texts` ADD `group_id` text;--> statement-breakpoint
ALTER TABLE `map_texts` ADD `locked` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `map_texts` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `zone_regions` ADD `extra_layer_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `zone_regions` ADD `default_style` text;