CREATE TABLE `campaign_characters` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`person_id` text NOT NULL,
	`player_name` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_characters_unique` ON `campaign_characters` (`campaign_id`,`person_id`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`calendar_id` text NOT NULL,
	`currencies` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `campaigns_world_idx` ON `campaigns` (`world_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`number` integer NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`played_on` text,
	`start_day` integer,
	`end_day` integer,
	`recap_document_id` text,
	`notes` text DEFAULT '{}' NOT NULL,
	`article_links` text DEFAULT '[]' NOT NULL,
	`attendance` text DEFAULT '[]' NOT NULL,
	`xp_total` integer,
	`xp_overrides` text DEFAULT '{}' NOT NULL,
	`loot` text DEFAULT '[]' NOT NULL,
	`coins` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recap_document_id`) REFERENCES `rich_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_campaign_idx` ON `sessions` (`campaign_id`,`number`);--> statement-breakpoint
CREATE INDEX `sessions_world_day_idx` ON `sessions` (`world_id`,`start_day`);