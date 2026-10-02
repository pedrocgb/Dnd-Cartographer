-- Settings become app-wide: keep the old per-world rows aside until 0052 copies them into the new table.
ALTER TABLE `app_settings` RENAME TO `__old_app_settings`;--> statement-breakpoint
ALTER TABLE `worlds` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `worlds` ADD `last_opened_at` integer;
