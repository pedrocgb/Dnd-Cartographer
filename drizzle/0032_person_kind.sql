ALTER TABLE `people` ADD `kind` text DEFAULT 'npc' NOT NULL;--> statement-breakpoint
-- Characters marked "Player" become Player Character articles; the Character Type field is retired.
UPDATE `people` SET `kind` = 'player' WHERE json_valid(`info`) AND json_extract(`info`, '$.characterType') = 'Player';--> statement-breakpoint
UPDATE `people` SET `info` = json_remove(`info`, '$.characterType') WHERE json_valid(`info`) AND json_type(`info`, '$.characterType') IS NOT NULL;
