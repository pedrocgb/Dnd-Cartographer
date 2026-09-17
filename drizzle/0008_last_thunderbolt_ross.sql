CREATE TABLE `authority_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`territory_id` text NOT NULL,
	`holder_type` text NOT NULL,
	`holder_id` text NOT NULL,
	`role` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`territory_id`) REFERENCES `territories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `authority_territory_idx` ON `authority_assignments` (`territory_id`);--> statement-breakpoint
CREATE TABLE `hierarchy_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`levels` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `marker_affiliations` (
	`id` text PRIMARY KEY NOT NULL,
	`marker_id` text NOT NULL,
	`territory_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`marker_id`) REFERENCES `markers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`territory_id`) REFERENCES `territories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `marker_affiliation_unique_idx` ON `marker_affiliations` (`marker_id`,`status`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'House' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `organizations_world_idx` ON `organizations` (`world_id`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`house_id` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `people_world_idx` ON `people` (`world_id`);--> statement-breakpoint
CREATE TABLE `political_links` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`external_url` text,
	`label` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `political_links_owner_idx` ON `political_links` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE INDEX `political_links_target_idx` ON `political_links` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `political_references` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `political_ref_source_idx` ON `political_references` (`source_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `territories` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`parent_id` text,
	`hierarchy_profile_id` text NOT NULL,
	`government_form` text,
	`power_holders` text,
	`leadership_selection` text,
	`autonomy` text,
	`situation` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hierarchy_profile_id`) REFERENCES `hierarchy_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `territories_world_idx` ON `territories` (`world_id`);--> statement-breakpoint
CREATE INDEX `territories_parent_idx` ON `territories` (`parent_id`);--> statement-breakpoint
CREATE TABLE `territory_seats` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`territory_id` text NOT NULL,
	`marker_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`territory_id`) REFERENCES `territories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`marker_id`) REFERENCES `markers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `territory_seats_unique_idx` ON `territory_seats` (`territory_id`,`role`);--> statement-breakpoint
CREATE INDEX `territory_seats_marker_idx` ON `territory_seats` (`marker_id`);