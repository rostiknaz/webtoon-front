/**
 * Type definitions for authentication and subscription system
 */

/**
 * User from Better Auth
 */
export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Session from Better Auth
 */
export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  token: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Subscription plan
 */
export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billingPeriod: 'monthly' | 'yearly';
  trialDays: number;
  features: {
    episodeAccess: 'all' | 'limited';
    adFree: boolean;
    downloadable: boolean;
    earlyAccess: boolean;
    [key: string]: any;
  };
  solidgateProductId: string;
  isActive: boolean;
  displayOrder: number;
}

/**
 * User subscription
 */
export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  solidgateOrderId: string | null;
  solidgateSubscriptionId: string | null;
  status: 'pending' | 'active' | 'trial' | 'canceled' | 'expired' | 'past_due';
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  canceledAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Subscription with plan details (joined)
 */
export interface SubscriptionWithPlan extends Subscription {
  plan: Plan;
}

/**
 * Series metadata
 */
export interface Series {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  bannerUrl: string | null;
  genre: string;
  author: string;
  status: 'ongoing' | 'completed' | 'hiatus';
  totalViews: number;
  totalLikes: number;
  episodeCount: number;
  ageRating: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Episode metadata
 */
export interface Episode {
  id: string;
  serialId: string;
  episodeNumber: number;
  title: string;
  description: string | null;
  thumbnailUrl: string;
  duration: number;
  isPaid: boolean;
  views: number;
  likes: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Episode with series info (joined)
 */
export interface EpisodeWithSeries extends Episode {
  series: Series;
}

/**
 * Payment transaction
 */
export interface PaymentTransaction {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  provider: 'solidgate';
  providerTransactionId: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  metadata: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Webhook event log
 */
export interface WebhookEvent {
  id: string;
  provider: 'solidgate';
  eventType: string;
  payload: string; // JSON string
  processed: boolean;
  createdAt: Date;
}

/**
 * User episode access (for individual episode purchases)
 */
export interface UserEpisodeAccess {
  id: string;
  userId: string;
  episodeId: string;
  grantedAt: Date;
  expiresAt: Date | null;
  source: 'subscription' | 'purchase' | 'free';
}

/**
 * Cloudflare Workers environment bindings
 */
export interface Env {
  // Cloudflare bindings
  DB: D1Database;
  CACHE: KVNamespace;
  SESSIONS: KVNamespace;

  // Better Auth
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;

  // Solidgate
  SOLIDGATE_MERCHANT_ID: string;
  SOLIDGATE_SECRET_KEY: string;
  SOLIDGATE_PUBLIC_KEY: string;
  SOLIDGATE_WEBHOOK_SECRET: string;

  // Cloudflare Stream
  CLOUDFLARE_STREAM_CUSTOMER_CODE: string;

  // OAuth (optional)
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Cached subscription data
 */
export interface CachedSubscription {
  status: string;
  planId: string;
  planFeatures: Record<string, any>;
  currentPeriodEnd: number;
  hasAccess: boolean;
  cachedAt: number;
}

/**
 * Cached series data
 */
export interface CachedSeries {
  episodes: Episode[];
  totalEpisodes: number;
  cachedAt: number;
}

/**
 * Homepage data
 */
export interface HomepageData {
  featuredSeries: Series[];
  trending: Series[];
  newReleases: Episode[];
  cachedAt?: number;
}
