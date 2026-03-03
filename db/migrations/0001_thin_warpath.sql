ALTER TABLE `users` ADD `role` text DEFAULT 'consumer' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `is_founding_creator` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `display_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `payout_method` text;--> statement-breakpoint
ALTER TABLE `users` ADD `payout_email` text;--> statement-breakpoint
ALTER TABLE `users` ADD `tos_accepted_at` integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_episodes_serial_published` ON `episodes` (`serial_id`,`published_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_sessions_expires_at` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_subscriptions_user_created` ON `subscriptions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_webhook_events_processed_at` ON `webhook_events` (`processed_at`);