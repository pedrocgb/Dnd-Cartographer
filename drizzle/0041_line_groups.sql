CREATE TABLE `line_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`layer_id` text NOT NULL,
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
CREATE INDEX `line_groups_map_idx` ON `line_groups` (`map_id`);--> statement-breakpoint
ALTER TABLE `map_lines` ADD `group_id` text;--> statement-breakpoint
ALTER TABLE `map_lines` ADD `name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `map_lines` ADD `locked` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `map_lines` ADD `sort_order` integer DEFAULT 0 NOT NULL;