CREATE TABLE `creator_earnings` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`month` text NOT NULL,
	`total_downloads` integer DEFAULT 0 NOT NULL,
	`platform_revenue` real NOT NULL,
	`total_platform_downloads` integer NOT NULL,
	`earnings_amount` real NOT NULL,
	`revenue_share` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`paid_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_creator_earnings_creator` ON `creator_earnings` (`creator_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_creator_earnings_creator_month` ON `creator_earnings` (`creator_id`,`month`);--> statement-breakpoint
CREATE INDEX `idx_creator_earnings_month_status` ON `creator_earnings` (`month`,`status`);