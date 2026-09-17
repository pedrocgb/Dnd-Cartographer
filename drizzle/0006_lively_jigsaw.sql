ALTER TABLE `markers` ADD `status_tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `markers` ADD `environment` text;--> statement-breakpoint
ALTER TABLE `markers` ADD `ownership` text;