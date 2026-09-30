CREATE TABLE `map_routes` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`layer_id` text NOT NULL,
	`extra_layer_ids` text DEFAULT '[]' NOT NULL,
	`group_id` text,
	`name` text DEFAULT '' NOT NULL,
	`points` text NOT NULL,
	`color` text DEFAULT '#FACC15' NOT NULL,
	`width` real DEFAULT 3 NOT NULL,
	`style` text DEFAULT 'dashed' NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `map_routes_map_idx` ON `map_routes` (`map_id`);--> statement-breakpoint
CREATE INDEX `map_routes_layer_idx` ON `map_routes` (`layer_id`);--> statement-breakpoint
CREATE TABLE `route_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`map_id` text NOT NULL,
	`layer_id` text NOT NULL,
	`name` text NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`extra_layer_ids` text DEFAULT '[]' NOT NULL,
	`default_style` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `route_groups_map_idx` ON `route_groups` (`map_id`);