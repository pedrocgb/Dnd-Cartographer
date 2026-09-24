CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`template` text NOT NULL,
	`title` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`body_document_id` text,
	`sidebar_document_id` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`body_document_id`) REFERENCES `rich_documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sidebar_document_id`) REFERENCES `rich_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `articles_world_template_idx` ON `articles` (`world_id`,`template`);--> statement-breakpoint
ALTER TABLE `organizations` ADD `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `sidebar_document_id` text REFERENCES rich_documents(id);--> statement-breakpoint
ALTER TABLE `people` ADD `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `people` ADD `sidebar_document_id` text REFERENCES rich_documents(id);--> statement-breakpoint
ALTER TABLE `territories` ADD `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `territories` ADD `sidebar_document_id` text REFERENCES rich_documents(id);