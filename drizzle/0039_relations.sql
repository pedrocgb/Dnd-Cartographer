CREATE TABLE `relations` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`type` text NOT NULL,
	`from_kind` text NOT NULL,
	`from_id` text NOT NULL,
	`to_kind` text NOT NULL,
	`to_id` text NOT NULL,
	`pair_key` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`one_way` integer DEFAULT false NOT NULL,
	`secret` integer DEFAULT false NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`attitude` integer,
	`parent_kind` text,
	`spouse_status` text,
	`since_day` integer,
	`until_day` integer,
	`notes` text DEFAULT '' NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `relations_world_type_idx` ON `relations` (`world_id`,`type`);--> statement-breakpoint
CREATE INDEX `relations_from_idx` ON `relations` (`from_id`);--> statement-breakpoint
CREATE INDEX `relations_to_idx` ON `relations` (`to_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `relations_pair_unique` ON `relations` (`world_id`,`type`,`pair_key`) WHERE deleted_at IS NULL AND type <> 'custom';--> statement-breakpoint
CREATE TABLE `relationship_boards` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`name` text NOT NULL,
	`cards` text DEFAULT '[]' NOT NULL,
	`filters` text DEFAULT '{}' NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `relationship_boards_world_idx` ON `relationship_boards` (`world_id`);--> statement-breakpoint
ALTER TABLE `organizations` ADD `color` text;