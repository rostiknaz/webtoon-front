/**
 * Shared types for Worker
 */

/**
 * Environment bindings type
 */
export type Bindings = {
  DB: D1Database;
  CACHE: KVNamespace;
  SESSIONS: KVNamespace;
  // Analytics Engine for high-volume event tracking (likes, views, engagement)
  // TODO: Uncomment when Analytics Engine is enabled in dashboard
  // ENGAGEMENT_EVENTS: AnalyticsEngineDataset;
  CLOUDFLARE_STREAM_CUSTOMER_CODE: string;
  CLOUDFLARE_STREAM_FALLBACK_VIDEO_ID: string;
  SOLIDGATE_MERCHANT_ID: string;
  SOLIDGATE_SECRET_KEY: string;
  SOLIDGATE_PUBLIC_KEY: string;
  SOLIDGATE_WEBHOOK_SECRET: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  VITE_BETTER_AUTH_URL: string;
  // Google OAuth
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  // Workers AI for content moderation (optional — falls back to manual review)
  AI?: Ai;
  // R2 presigned URL credentials (S3-compatible API)
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  R2_CDN_URL: string;
  VIDEO_STORAGE: R2Bucket;
  ASSETS: Fetcher;
};

/**
 * Hono app type with bindings
 */
export type AppEnv = {
  Bindings: Bindings;
};
