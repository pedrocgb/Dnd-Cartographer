ALTER TABLE `marker_article_links` ADD `is_primary` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `marker_article_links_article_idx` ON `marker_article_links` (`article_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `marker_article_links_primary_idx` ON `marker_article_links` (`marker_id`) WHERE "marker_article_links"."is_primary" = 1;--> statement-breakpoint
ALTER TABLE `markers` ADD `label_mode` text DEFAULT 'hover' NOT NULL;--> statement-breakpoint
ALTER TABLE `markers` ADD `importance` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
UPDATE `marker_article_links` SET `is_primary` = 1
WHERE `id` IN (
  SELECT `id` FROM `marker_article_links` AS l
  WHERE `id` = (
    SELECT `id` FROM `marker_article_links` AS o
    WHERE o.`marker_id` = l.`marker_id`
    ORDER BY o.`created_at`, o.`id` LIMIT 1
  )
);
