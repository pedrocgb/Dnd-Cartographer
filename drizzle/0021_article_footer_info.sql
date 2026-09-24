ALTER TABLE `articles` ADD `footer_document_id` text REFERENCES rich_documents(id);--> statement-breakpoint
ALTER TABLE `articles` ADD `portrait_key` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `footer_document_id` text REFERENCES rich_documents(id);--> statement-breakpoint
ALTER TABLE `people` ADD `info` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `people` ADD `footer_document_id` text REFERENCES rich_documents(id);--> statement-breakpoint
ALTER TABLE `territories` ADD `footer_document_id` text REFERENCES rich_documents(id);