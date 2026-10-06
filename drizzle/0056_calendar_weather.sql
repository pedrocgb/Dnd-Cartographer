CREATE TABLE `calendar_weather` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`world_day` integer NOT NULL,
	`data` text NOT NULL,
	`settlement_id` text,
	`territory_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`settlement_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`territory_id`) REFERENCES `territories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `calendar_weather_world_day_idx` ON `calendar_weather` (`world_id`,`world_day`);--> statement-breakpoint
CREATE INDEX `calendar_weather_settlement_idx` ON `calendar_weather` (`settlement_id`);--> statement-breakpoint
CREATE INDEX `calendar_weather_territory_idx` ON `calendar_weather` (`territory_id`);