import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ============================================
// Better Auth Tables
// ============================================

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  name: text('name'),
  image: text('image'),
  role: text('role').notNull().default('consumer'), // 'consumer', 'creator', 'admin'
  isFoundingCreator: integer('is_founding_creator', { mode: 'boolean' }).notNull().default(false),
  displayName: text('display_name'), // Creator display name (nullable — set on creator registration)
  bio: text('bio'), // Creator bio (nullable, max 500 chars enforced by Zod)
  payoutMethod: text('payout_method'), // 'paypal' or 'stripe' (nullable)
  payoutEmail: text('payout_email'), // Payout email address (nullable)
  tosAcceptedAt: integer('tos_accepted_at', { mode: 'timestamp' }), // When creator accepted ToS (nullable)
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  // Sessions by user (for listing active sessions, logout all)
  index('idx_sessions_user_id').on(table.userId),
  // Session expiration cleanup (for background cleanup jobs)
  index('idx_sessions_expires_at').on(table.expiresAt),
]);

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  // Prevent duplicate OAuth provider entries per user
  uniqueIndex('idx_accounts_user_provider').on(table.userId, table.providerId),
  // Accounts by user (for OAuth provider linking)
  index('idx_accounts_user_id').on(table.userId),
]);

export const verifications = sqliteTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// ============================================
// Content Tables
// ============================================

export const series = sqliteTable('series', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(), // URL-safe identifier for R2 paths (e.g., "midnight-confessions")
  title: text('title').notNull(),
  description: text('description'),
  thumbnailUrl: text('thumbnail_url'),
  genre: text('genre'),
  author: text('author'),
  status: text('status').notNull().default('ongoing'), // ongoing, completed, hiatus
  totalViews: integer('total_views').notNull().default(0),
  totalLikes: integer('total_likes').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  // Note: unique() on slug creates sqlite_autoindex, this explicit index provides better naming
  index('idx_series_slug').on(table.slug),
]);

export const episodes = sqliteTable('episodes', {
  id: text('id').primaryKey(),
  serialId: text('serial_id').notNull().references(() => series.id, { onDelete: 'cascade' }),
  episodeNumber: integer('episode_number').notNull(),
  title: text('title'),
  description: text('description'),
  thumbnailUrl: text('thumbnail_url'),
  duration: integer('duration'), // Duration in seconds
  isPaid: integer('is_paid', { mode: 'boolean' }).notNull().default(false),
  views: integer('views').notNull().default(0),
  likes: integer('likes').notNull().default(0),
  isLocked: integer('is_locked', { mode: 'boolean' }).notNull().default(false),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  // Prevent duplicate episode numbers within a series (also serves as composite index)
  uniqueIndex('idx_episodes_serial_episode').on(table.serialId, table.episodeNumber),
  // CRITICAL: Episodes by series lookup (used on every series page load)
  index('idx_episodes_serial_id').on(table.serialId),
  // Episode publication ordering (for published episodes sorted by date)
  index('idx_episodes_serial_published').on(table.serialId, table.publishedAt),
]);

// ============================================
// Subscription Tables
// ============================================

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  solidgateProductId: text('solidgate_product_id').notNull(), // UUID v4
  solidgateProductPriceId: text('solidgate_product_price_id'), // Optional UUID v4
  price: real('price').notNull(), // Decimal price
  currency: text('currency').notNull().default('USD'),
  billingPeriod: text('billing_period').notNull().default('monthly'), // monthly, yearly
  trialDays: integer('trial_days').notNull().default(0),
  features: text('features').notNull(), // JSON: {"episodeAccess": "all" | "first_3", "adFree": true, ...}
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  // Plans active status lookup (used for plans list)
  index('idx_plans_is_active').on(table.isActive),
]);

export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId: text('plan_id').notNull().references(() => plans.id),
  solidgateOrderId: text('solidgate_order_id'),
  solidgateSubscriptionId: text('solidgate_subscription_id').unique(),
  status: text('status').notNull().default('pending'), // pending, active, trial, canceled, past_due, expired
  currentPeriodStart: integer('current_period_start', { mode: 'timestamp' }),
  currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }),
  trialStart: integer('trial_start', { mode: 'timestamp' }),
  trialEnd: integer('trial_end', { mode: 'timestamp' }),
  canceledAt: integer('canceled_at', { mode: 'timestamp' }),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  // CRITICAL: User subscription lookup (used on every authenticated request)
  index('idx_subscriptions_user_id').on(table.userId),
  // Composite index for subscription status filtering (covers most subscription queries)
  index('idx_subscriptions_user_status').on(table.userId, table.status),
  // Optimize subscription analytics queries by plan
  index('idx_subscriptions_plan_id').on(table.planId),
  // Subscription ordering for cache miss lookups (ORDER BY createdAt DESC)
  index('idx_subscriptions_user_created').on(table.userId, table.createdAt),
  // NOTE: Partial unique index `idx_one_active_subscription_per_user` exists via manual SQL
  // (prevents duplicate active/trial subscriptions per user)
  // Drizzle doesn't support partial indexes (WHERE clause), maintained in 0001_partial_indexes.sql
]);

export const userEpisodeAccess = sqliteTable('user_episode_access', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  episodeId: text('episode_id').notNull().references(() => episodes.id, { onDelete: 'cascade' }),
  accessGrantedAt: integer('access_granted_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  accessExpiresAt: integer('access_expires_at', { mode: 'timestamp' }), // NULL = permanent access
  grantedBySubscriptionId: text('granted_by_subscription_id').references(() => subscriptions.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  // Prevent duplicate episode access grants per user/episode
  uniqueIndex('idx_user_episode_access_user_episode').on(table.userId, table.episodeId),
  // User episode access lookup (for checking purchased episodes)
  index('idx_user_episode_access_user_id').on(table.userId),
]);

// ============================================
// Webhook & Payment Tables
// ============================================

export const webhookEvents = sqliteTable('webhook_events', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull().unique(), // Solidgate event ID for idempotency
  eventType: text('event_type').notNull(), // subscription.created, subscription.updated.v2, etc.
  eventData: text('event_data').notNull(), // JSON payload
  processedAt: integer('processed_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  // Webhook audit trail (for compliance queries, debugging)
  index('idx_webhook_events_processed_at').on(table.processedAt),
]);

export const paymentTransactions = sqliteTable('payment_transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  subscriptionId: text('subscription_id').references(() => subscriptions.id),
  solidgateOrderId: text('solidgate_order_id').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull(),
  status: text('status').notNull(), // success, failed, pending, refunded
  paymentMethod: text('payment_method'),
  metadata: text('metadata'), // JSON: additional payment info
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  // Payment transactions by user (for payment history)
  index('idx_payment_transactions_user_id').on(table.userId),
]);

// ============================================
// User Activity Tables
// ============================================

export const userLikes = sqliteTable('user_likes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  episodeId: text('episode_id').notNull().references(() => episodes.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  // Prevent duplicate likes per user/episode
  uniqueIndex('idx_user_likes_user_episode').on(table.userId, table.episodeId),
]);

export const watchHistory = sqliteTable('watch_history', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  episodeId: text('episode_id').notNull().references(() => episodes.id, { onDelete: 'cascade' }),
  progress: real('progress').notNull().default(0), // Percentage watched (0-100)
  lastWatchedAt: integer('last_watched_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  // Prevent duplicate watch history entries per user/episode
  uniqueIndex('idx_watch_history_user_episode').on(table.userId, table.episodeId),
  // Watch history lookup by user (for continue watching feature)
  index('idx_watch_history_user_id').on(table.userId),
  // Watch history lookup by episode (for analytics)
  index('idx_watch_history_episode_id').on(table.episodeId),
  // Optimize "continue watching" queries sorted by last watched time
  index('idx_watch_history_user_last_watched').on(table.userId, table.lastWatchedAt),
]);


// ============================================
// Creator Content Tables (Epic 2: Content Discovery)
// ============================================

export const creatorSeries = sqliteTable('creator_series', {
  id: text('id').primaryKey(),
  creatorId: text('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  coverUrl: text('cover_url'),
  genre: text('genre'),
  status: text('status').notNull().default('ongoing'), // ongoing, completed, hiatus
  nsfwRating: text('nsfw_rating').notNull().default('safe'), // safe, suggestive, nsfw
  totalEpisodes: integer('total_episodes').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index('idx_creator_series_creator').on(table.creatorId),
  index('idx_creator_series_slug').on(table.slug),
]);

export const clips = sqliteTable('clips', {
  id: text('id').primaryKey(),
  creatorId: text('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  videoUrl: text('video_url'),
  thumbnailUrl: text('thumbnail_url'),
  duration: integer('duration'), // seconds
  resolution: text('resolution'),
  fileSize: integer('file_size'),
  seriesId: text('series_id').references(() => creatorSeries.id, { onDelete: 'set null' }),
  episodeNumber: integer('episode_number'),
  nsfwRating: text('nsfw_rating').notNull().default('safe'), // safe, suggestive, nsfw
  status: text('status').notNull().default('processing'), // processing, published, rejected, review
  creditCost: integer('credit_cost').notNull().default(1),
  downloadCount: integer('download_count').notNull().default(0),
  views: integer('views').notNull().default(0),
  likes: integer('likes').notNull().default(0),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index('idx_clips_creator').on(table.creatorId),
  index('idx_clips_feed').on(table.status, table.publishedAt),
  index('idx_clips_nsfw_feed').on(table.status, table.nsfwRating, table.publishedAt),
  index('idx_clips_popular').on(table.status, table.views),
  index('idx_clips_series').on(table.seriesId, table.episodeNumber),
]);

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index('idx_categories_slug').on(table.slug),
  index('idx_categories_sort').on(table.sortOrder),
]);

export const clipCategories = sqliteTable('clip_categories', {
  clipId: text('clip_id').notNull().references(() => clips.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
}, (table) => [
  uniqueIndex('idx_clip_categories_unique').on(table.clipId, table.categoryId),
  index('idx_clip_categories_category').on(table.categoryId, table.clipId),
]);

// ============================================
// Moderation Tables (Epic 1: Content Moderation)
// ============================================

export const moderationLogs = sqliteTable('moderation_logs', {
  id: text('id').primaryKey(),
  clipId: text('clip_id').notNull().references(() => clips.id, { onDelete: 'cascade' }),
  moderatorId: text('moderator_id').references(() => users.id, { onDelete: 'set null' }), // null = AI action
  action: text('action').notNull(), // approve, reject, flag
  reason: text('reason').notNull(),
  confidence: real('confidence'), // AI confidence score (null for human actions)
  aiModel: text('ai_model'), // e.g. "@cf/microsoft/resnet-50"
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index('idx_moderation_logs_clip').on(table.clipId),
  index('idx_moderation_logs_moderator').on(table.moderatorId),
]);
