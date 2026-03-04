PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_credits` (
	`user_id` text PRIMARY KEY NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`free_downloads_remaining` integer DEFAULT 3 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_credits`("user_id", "balance", "free_downloads_remaining", "updated_at") SELECT "user_id", "balance", "free_downloads_remaining", "updated_at" FROM `credits`;--> statement-breakpoint
DROP TABLE `credits`;--> statement-breakpoint
ALTER TABLE `__new_credits` RENAME TO `credits`;--> statement-breakpoint
PRAGMA foreign_keys=ON;