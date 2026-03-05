CREATE TABLE `downloads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`clip_id` text NOT NULL,
	`credit_cost` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`clip_id`) REFERENCES `clips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_downloads_user_clip` ON `downloads` (`user_id`,`clip_id`);--> statement-breakpoint
CREATE INDEX `idx_downloads_user_id` ON `downloads` (`user_id`);