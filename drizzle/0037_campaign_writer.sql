CREATE TABLE `campaign_status_log` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`session_id` text,
	`world_day` integer,
	`kind` text DEFAULT 'world' NOT NULL,
	`subject` text,
	`text` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `campaign_status_log_campaign_idx` ON `campaign_status_log` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `document_mentions` (
	`document_id` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `rich_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_mentions_pk` ON `document_mentions` (`document_id`,`target_kind`,`target_id`);--> statement-breakpoint
CREATE INDEX `document_mentions_target_idx` ON `document_mentions` (`target_kind`,`target_id`);--> statement-breakpoint
CREATE TABLE `outline_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`parent_id` text,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`synopsis` text DEFAULT '' NOT NULL,
	`document_id` text,
	`beat_template` text,
	`beat_key` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`planned_session_id` text,
	`played_session_id` text,
	`change_note` text DEFAULT '' NOT NULL,
	`links` text DEFAULT '[]' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `rich_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `outline_nodes_campaign_idx` ON `outline_nodes` (`campaign_id`,`parent_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `plot_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'promise' NOT NULL,
	`mice_type` text,
	`status` text DEFAULT 'open' NOT NULL,
	`quest_id` text,
	`summary` text DEFAULT '' NOT NULL,
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
CREATE INDEX `plot_threads_campaign_idx` ON `plot_threads` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `thread_beats` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`node_id` text NOT NULL,
	`role` text DEFAULT 'progress' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `plot_threads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`node_id`) REFERENCES `outline_nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `thread_beats_unique` ON `thread_beats` (`thread_id`,`node_id`);--> statement-breakpoint
CREATE INDEX `thread_beats_node_idx` ON `thread_beats` (`node_id`);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `setup` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `prep` text DEFAULT '{}' NOT NULL;