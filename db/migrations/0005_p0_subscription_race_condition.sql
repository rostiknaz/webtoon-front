-- P0 Critical: Prevent duplicate active subscriptions per user
-- This ensures only ONE active/trial subscription can exist per user at a time
-- SQLite partial index syntax

-- Unique constraint: one active subscription per user
-- This prevents race conditions where two concurrent subscribe requests
-- could both pass the application-level check and insert duplicate subscriptions
CREATE UNIQUE INDEX IF NOT EXISTS `idx_one_active_subscription_per_user`
ON `subscriptions` (`user_id`)
WHERE `status` IN ('active', 'trial');
