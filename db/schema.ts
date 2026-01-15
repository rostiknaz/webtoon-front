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
});

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
});

export const episodes = sqliteTable('episodes', {
  id: text('id').primaryKey(),
  serialId: text('serial_id').notNull().references(() => series.id, { onDelete: 'cascade' }),
  episodeNumber: integer('episode_number').notNull(),
  title: text('title'),
  description: text('description'),
  thumbnailUrl: text('thumbnail_url'),
  videoId: text('video_id'), // Cloudflare Stream video ID
  duration: integer('duration'), // Duration in seconds
  isPaid: integer('is_paid', { mode: 'boolean' }).notNull().default(false),
  views: integer('views').notNull().default(0),
  likes: integer('likes').notNull().default(0),
  isLocked: integer('is_locked', { mode: 'boolean' }).notNull().default(false),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  // Prevent duplicate episode numbers within a series
  uniqueIndex('idx_episodes_serial_episode').on(table.serialId, table.episodeNumber),
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
});

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
  // Optimize subscription analytics queries by plan
  index('idx_subscriptions_plan_id').on(table.planId),
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
});

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
});

// ============================================
// User Activity Tables
// ============================================

export const userLikes = sqliteTable('user_likes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  episodeId: text('episode_id').notNull().references(() => episodes.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

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
  // Optimize "continue watching" queries sorted by last watched time
  index('idx_watch_history_user_last_watched').on(table.userId, table.lastWatchedAt),
]);
