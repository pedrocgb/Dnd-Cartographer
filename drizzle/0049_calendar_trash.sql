ALTER TABLE `calendars` ADD `deleted_at` integer;--> statement-breakpoint
UPDATE `calendars` SET `deleted_at` = `archived_at` WHERE `archived_at` IS NOT NULL;