ALTER TABLE `articles` ADD `info` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `info` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `territories` ADD `info` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
UPDATE `organizations` SET `kind` = 'Noble House' WHERE `kind` = 'House';--> statement-breakpoint
UPDATE `organizations` SET `kind` = 'Religious Order' WHERE `kind` = 'Religious Institution';--> statement-breakpoint
UPDATE `organizations` SET `kind` = 'Other' WHERE `kind` = 'Custom';--> statement-breakpoint
UPDATE `organizations` SET `kind` = 'Other' WHERE `kind` NOT IN ('Noble House','Guild','Council','Military Order','Religious Order','Clan','Company','Academy','Criminal Organization','Secret Society','Other');
