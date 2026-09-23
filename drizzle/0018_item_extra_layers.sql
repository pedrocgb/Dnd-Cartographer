ALTER TABLE `map_lines` ADD `extra_layer_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `map_texts` ADD `extra_layer_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `markers` ADD `extra_layer_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `zones` ADD `extra_layer_ids` text DEFAULT '[]' NOT NULL;