-- Add OAuth-related columns to accounts table
-- These columns are required by Better Auth for OAuth token management

ALTER TABLE accounts ADD COLUMN access_token_expires_at INTEGER;
ALTER TABLE accounts ADD COLUMN refresh_token_expires_at INTEGER;
ALTER TABLE accounts ADD COLUMN scope TEXT;
