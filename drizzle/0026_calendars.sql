CREATE TABLE `calendar_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`kind` text NOT NULL,
	`world_day` integer NOT NULL,
	`duration_days` integer DEFAULT 1 NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`document_id` text,
	`category` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '' NOT NULL,
	`article_template` text,
	`article_id` text,
	`article_links` text DEFAULT '[]' NOT NULL,
	`recurrence` text DEFAULT '{"kind":"none"}' NOT NULL,
	`until_day` integer,
	`exceptions` text DEFAULT '{}' NOT NULL,
	`source` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `rich_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `calendar_entries_world_day_idx` ON `calendar_entries` (`world_id`,`world_day`);--> statement-breakpoint
CREATE INDEX `calendar_entries_article_idx` ON `calendar_entries` (`article_id`);--> statement-breakpoint
CREATE TABLE `calendars` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`definition` text NOT NULL,
	`article_links` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `calendars_world_idx` ON `calendars` (`world_id`);--> statement-breakpoint
CREATE TABLE `celestial_objects` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#E8E3D5' NOT NULL,
	`icon` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`article_links` text DEFAULT '[]' NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `celestial_objects_world_idx` ON `celestial_objects` (`world_id`);--> statement-breakpoint
CREATE TABLE `definition_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `definition_revisions_subject_idx` ON `definition_revisions` (`subject_type`,`subject_id`);--> statement-breakpoint
CREATE TABLE `season_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`calendar_id` text NOT NULL,
	`data` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `season_profiles_world_idx` ON `season_profiles` (`world_id`);--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '#47BFAB' NOT NULL,
	`icon` text DEFAULT '' NOT NULL,
	`article_links` text DEFAULT '[]' NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `seasons_world_idx` ON `seasons` (`world_id`);--> statement-breakpoint
CREATE TABLE `world_chronology` (
	`world_id` text PRIMARY KEY NOT NULL,
	`current_day` integer DEFAULT 0 NOT NULL,
	`default_calendar_id` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
