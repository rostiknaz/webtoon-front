-- Partial Indexes (not supported by Drizzle ORM)
-- These indexes use WHERE clauses which require manual SQL

-- Prevent duplicate active subscriptions per user
-- This ensures only ONE active/trial subscription can exist per user at a time
-- Prevents race conditions where concurrent subscribe requests could create duplicates
CREATE UNIQUE INDEX IF NOT EXISTS `idx_one_active_subscription_per_user`
ON `subscriptions` (`user_id`)
WHERE `status` IN ('active', 'trial');
