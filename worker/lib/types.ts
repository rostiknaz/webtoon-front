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
  ASSETS: Fetcher;
};

/**
 * Hono app type with bindings
 */
export type AppEnv = {
  Bindings: Bindings;
};
