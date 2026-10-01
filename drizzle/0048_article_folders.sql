CREATE TABLE `article_folder_items` (
	`folder_id` text NOT NULL,
	`article_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`folder_id`) REFERENCES `article_folders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_folder_items_pk` ON `article_folder_items` (`folder_id`,`article_id`);--> statement-breakpoint
CREATE INDEX `article_folder_items_article_idx` ON `article_folder_items` (`article_id`);--> statement-breakpoint
CREATE TABLE `article_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`color` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `article_folders_world_idx` ON `article_folders` (`world_id`);