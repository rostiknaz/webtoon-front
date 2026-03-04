CREATE TABLE `credit_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`clip_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_credit_transactions_user_id` ON `credit_transactions` (`user_id`);--> statement-breakpoint
CREATE TABLE `credits` (
	`user_id` text NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`free_downloads_remaining` integer DEFAULT 3 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credits_user_id_unique` ON `credits` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_clip_categories_category` ON `clip_categories` (`category_id`,`clip_id`);