ALTER TABLE `pages` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `pages` ADD `font_family` text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `pages` ADD `content_width` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `pages` ADD `is_locked` integer DEFAULT false NOT NULL;