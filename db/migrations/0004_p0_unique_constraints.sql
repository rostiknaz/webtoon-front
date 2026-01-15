-- P0 Critical: Unique Constraints and Performance Indexes
-- These ensure data integrity and improve query performance

-- ============================================
-- Unique Constraints (Data Integrity)
-- ============================================

-- Prevent duplicate episode numbers within a series
-- Also serves as a composite index for episode ordering queries
CREATE UNIQUE INDEX IF NOT EXISTS `idx_episodes_serial_episode` ON `episodes` (`serial_id`, `episode_number`);
--> statement-breakpoint

-- Prevent duplicate OAuth provider entries per user
-- A user can only have one account per provider (e.g., one Google account)
CREATE UNIQUE INDEX IF NOT EXISTS `idx_accounts_user_provider` ON `accounts` (`user_id`, `provider_id`);
--> statement-breakpoint

-- Prevent duplicate watch history entries per user/episode
-- Each user should have at most one watch history record per episode
CREATE UNIQUE INDEX IF NOT EXISTS `idx_watch_history_user_episode` ON `watch_history` (`user_id`, `episode_id`);
--> statement-breakpoint

-- Prevent duplicate episode access grants per user/episode
-- A user should only have one access record per episode
CREATE UNIQUE INDEX IF NOT EXISTS `idx_user_episode_access_user_episode` ON `user_episode_access` (`user_id`, `episode_id`);
--> statement-breakpoint

-- ============================================
-- Additional Performance Indexes
-- ============================================

-- Optimize "continue watching" queries that sort by last watched time
CREATE INDEX IF NOT EXISTS `idx_watch_history_user_last_watched` ON `watch_history` (`user_id`, `last_watched_at` DESC);
--> statement-breakpoint

-- Optimize subscription analytics queries by plan
CREATE INDEX IF NOT EXISTS `idx_subscriptions_plan_id` ON `subscriptions` (`plan_id`);
