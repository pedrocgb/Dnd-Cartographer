CREATE TABLE `quests` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`parent_id` text,
	`title` text NOT NULL,
	`kind` text DEFAULT 'side' NOT NULL,
	`status` text DEFAULT 'hook' NOT NULL,
	`priority` integer DEFAULT 1 NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`body_document_id` text,
	`giver` text,
	`article_links` text DEFAULT '[]' NOT NULL,
	`objectives` text DEFAULT '[]' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`body_document_id`) REFERENCES `rich_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `quests_campaign_status_idx` ON `quests` (`campaign_id`,`status`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `quest_log` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
-- Session "open threads" become Rumor quests of the session's campaign (id = session id + thread id),
-- and each session logs them (started / completed) so they keep their history.
INSERT INTO `quests` (`id`, `world_id`, `campaign_id`, `title`, `kind`, `status`, `sort_order`, `created_at`, `updated_at`)
SELECT s.`id` || ':' || json_extract(t.value, '$.id'), s.`world_id`, s.`campaign_id`, substr(trim(json_extract(t.value, '$.text')), 1, 160), 'rumor',
  CASE WHEN json_extract(t.value, '$.resolved') THEN 'completed' ELSE 'hook' END, t.key, s.`created_at`, s.`updated_at`
FROM `sessions` s, json_each(s.`notes`, '$.threads') t
WHERE s.`deleted_at` IS NULL AND json_valid(s.`notes`) AND trim(coalesce(json_extract(t.value, '$.text'), '')) <> '';--> statement-breakpoint
UPDATE `sessions` SET `quest_log` = (
  SELECT json_group_array(json_object('questId', `sessions`.`id` || ':' || json_extract(t.value, '$.id'),
    'action', CASE WHEN json_extract(t.value, '$.resolved') THEN 'completed' ELSE 'started' END, 'note', '', 'objectiveIds', json('[]')))
  FROM json_each(`sessions`.`notes`, '$.threads') t WHERE trim(coalesce(json_extract(t.value, '$.text'), '')) <> '')
WHERE `deleted_at` IS NULL AND json_valid(`notes`) AND json_array_length(`notes`, '$.threads') > 0;--> statement-breakpoint
UPDATE `sessions` SET `notes` = json_set(`notes`, '$.threads', json('[]')) WHERE `deleted_at` IS NULL AND json_valid(`notes`) AND json_array_length(`notes`, '$.threads') > 0;
