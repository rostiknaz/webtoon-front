-- Migration: Add composite index for creator activity queries
-- Optimizes time-based aggregations in admin creator activity monitoring

CREATE INDEX IF NOT EXISTS idx_clips_creator_time ON clips(creator_id, created_at DESC);
