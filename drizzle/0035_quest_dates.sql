ALTER TABLE `campaigns` ADD `quest_map` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `quests` ADD `start_day` integer;--> statement-breakpoint
ALTER TABLE `quests` ADD `deadline_day` integer;--> statement-breakpoint
ALTER TABLE `quests` ADD `end_day` integer;--> statement-breakpoint
CREATE INDEX `quests_world_deadline_idx` ON `quests` (`world_id`,`deadline_day`);