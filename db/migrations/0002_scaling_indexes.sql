-- Scaling indexes for 3-5M DAU
-- These indexes support high-traffic query patterns identified in DATABASE_SCALING_ANALYSIS.md

-- Subscription ordering optimization (cache miss queries)
-- Supports: getUserSubscription() with ORDER BY createdAt DESC
CREATE INDEX IF NOT EXISTS `idx_subscriptions_user_created`
ON `subscriptions` (`user_id`, `created_at` DESC);

-- Session cleanup optimization
-- Supports: Background session cleanup jobs querying expired sessions
CREATE INDEX IF NOT EXISTS `idx_sessions_expires_at`
ON `sessions` (`expires_at`);

-- Webhook audit trail
-- Supports: Compliance queries, debugging webhook history
CREATE INDEX IF NOT EXISTS `idx_webhook_events_processed_at`
ON `webhook_events` (`processed_at`);

-- Episode publication ordering
-- Supports: "Get published episodes for series" sorted by publish date
CREATE INDEX IF NOT EXISTS `idx_episodes_serial_published`
ON `episodes` (`serial_id`, `published_at` DESC);
