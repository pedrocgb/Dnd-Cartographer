CREATE TABLE `fronts` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'adventure' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`threat` text DEFAULT '' NOT NULL,
	`doom` text DEFAULT '' NOT NULL,
	`portents` text DEFAULT '[]' NOT NULL,
	`clock` text,
	`color` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `fronts_campaign_idx` ON `fronts` (`campaign_id`);--> statement-breakpoint
ALTER TABLE `quests` ADD `front_id` text;--> statement-breakpoint
ALTER TABLE `quests` ADD `clues` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `quests` ADD `clock` text;--> statement-breakpoint
ALTER TABLE `quests` ADD `rewards` text;