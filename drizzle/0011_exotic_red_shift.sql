ALTER TABLE `hierarchy_profiles` ADD `description_document_id` text REFERENCES rich_documents(id);--> statement-breakpoint
ALTER TABLE `organizations` ADD `description_document_id` text REFERENCES rich_documents(id);--> statement-breakpoint
ALTER TABLE `people` ADD `description_document_id` text REFERENCES rich_documents(id);--> statement-breakpoint
ALTER TABLE `territories` ADD `description_document_id` text REFERENCES rich_documents(id);