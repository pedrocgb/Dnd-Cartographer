CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`updated_at` integer NOT NULL
);--> statement-breakpoint
-- The one world's settings become everyone's (the latest saved, should there be several).
INSERT INTO `app_settings` (`id`, `data`, `updated_at`) SELECT 'app', `data`, `updated_at` FROM `__old_app_settings` ORDER BY `updated_at` DESC LIMIT 1;--> statement-breakpoint
DROP TABLE `__old_app_settings`;
