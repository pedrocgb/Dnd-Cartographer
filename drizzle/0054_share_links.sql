CREATE TABLE `share_links` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`token` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_template` text,
	`target_id` text NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_links_token_unique` ON `share_links` (`token`);--> statement-breakpoint
CREATE INDEX `share_links_target_idx` ON `share_links` (`world_id`,`target_kind`,`target_id`);