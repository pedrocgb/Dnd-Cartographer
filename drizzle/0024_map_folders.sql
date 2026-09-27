CREATE TABLE `map_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `map_folders_world_idx` ON `map_folders` (`world_id`);--> statement-breakpoint
ALTER TABLE `maps` ADD `folder_id` text;