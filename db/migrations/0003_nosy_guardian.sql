CREATE TABLE `moderation_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`clip_id` text NOT NULL,
	`moderator_id` text,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`confidence` real,
	`ai_model` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`clip_id`) REFERENCES `clips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`moderator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_moderation_logs_clip` ON `moderation_logs` (`clip_id`);--> statement-breakpoint
CREATE INDEX `idx_moderation_logs_moderator` ON `moderation_logs` (`moderator_id`);