-- Performance indexes for high-traffic queries
-- These indexes dramatically improve query performance on frequently accessed tables

-- CRITICAL: Episodes by series lookup (used on every series page load)
-- Queries: getSeriesEpisodes(), getSeriesStats()
CREATE INDEX `idx_episodes_serial_id` ON `episodes` (`serial_id`);
--> statement-breakpoint

-- CRITICAL: User subscription lookup (used on every authenticated request)
-- Query: getUserSubscription()
CREATE INDEX `idx_subscriptions_user_id` ON `subscriptions` (`user_id`);
--> statement-breakpoint

-- Composite index for subscription status filtering (covers most subscription queries)
CREATE INDEX `idx_subscriptions_user_status` ON `subscriptions` (`user_id`, `status`);
--> statement-breakpoint

-- Plans active status lookup (used for plans list, cached but still needs fast query)
CREATE INDEX `idx_plans_is_active` ON `plans` (`is_active`);
--> statement-breakpoint

-- User likes - unique constraint to prevent duplicate likes
CREATE UNIQUE INDEX `idx_user_likes_user_episode` ON `user_likes` (`user_id`, `episode_id`);
--> statement-breakpoint

-- Watch history lookup by user (for continue watching feature)
CREATE INDEX `idx_watch_history_user_id` ON `watch_history` (`user_id`);
--> statement-breakpoint

-- Watch history lookup by episode (for analytics)
CREATE INDEX `idx_watch_history_episode_id` ON `watch_history` (`episode_id`);
--> statement-breakpoint

-- Sessions by user (for listing active sessions, logout all)
CREATE INDEX `idx_sessions_user_id` ON `sessions` (`user_id`);
--> statement-breakpoint

-- Accounts by user (for OAuth provider linking)
CREATE INDEX `idx_accounts_user_id` ON `accounts` (`user_id`);
--> statement-breakpoint

-- User episode access lookup (for checking purchased episodes)
CREATE INDEX `idx_user_episode_access_user_id` ON `user_episode_access` (`user_id`);
--> statement-breakpoint

-- Payment transactions by user (for payment history)
CREATE INDEX `idx_payment_transactions_user_id` ON `payment_transactions` (`user_id`);
