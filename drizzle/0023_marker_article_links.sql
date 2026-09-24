CREATE TABLE `marker_article_links` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`marker_id` text NOT NULL,
	`template` text NOT NULL,
	`article_id` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `marker_article_links_marker_idx` ON `marker_article_links` (`marker_id`);--> statement-breakpoint
INSERT INTO `marker_article_links` (`id`, `world_id`, `marker_id`, `template`, `article_id`, `label`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  `world_id`, `source_id`, CASE `target_type` WHEN 'person' THEN 'character' ELSE `target_type` END, `target_id`, `label`, `created_at`, `updated_at`
FROM `political_references` WHERE `source_type` = 'marker';
