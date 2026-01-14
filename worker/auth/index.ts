/**
 * Better Auth Configuration for Cloudflare Workers
 *
 * Provides both CLI export (for schema generation) and runtime factory (for request handling)
 *
 * @see https://github.com/zpg6/better-auth-cloudflare
 */

import { betterAuth } from 'better-auth';
import { withCloudflare } from 'better-auth-cloudflare';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../db/schema';
import type { Bindings } from '../lib/types';
import { hashPassword, verifyPassword } from '../lib/password';

/**
 * Create Better Auth instance for runtime (per-request)
 *
 * Called for each incoming request with environment bindings
 */
export function createAuth(env: Bindings, cf?: IncomingRequestCfProperties) {
  // Create Drizzle instance with D1 binding
  const db = drizzle(env.DB, { schema }) as any;

  return betterAuth({
    ...withCloudflare(
      // First parameter: Cloudflare-specific configuration
      {
        autoDetectIpAddress: !!cf,
        geolocationTracking: false, // Disabled - requires additional schema fields
        cf: cf || {},
        d1: {
          db,
          options: {
            usePlural: true,
            debugLogs: false,
          },
        },
        kv: env.SESSIONS,
      },
      // Second parameter: Better Auth configuration
      {
        secret: env.BETTER_AUTH_SECRET,
        baseURL: env.BETTER_AUTH_URL,
        emailAndPassword: {
          enabled: true,
          minPasswordLength: 8,
          maxPasswordLength: 128,
          requireEmailVerification: false,
          password: {
            // Use PBKDF2 instead of scrypt (scrypt exceeds Workers CPU limits)
            hash: hashPassword,
            verify: verifyPassword,
          },
        },
        rateLimit: {
          enabled: true,
          window: 60, // 60 seconds (minimum for KV)
          max: 100,
          customRules: {
            '/sign-in/email': {
              window: 60,
              max: 10,
            },
            '/sign-up/email': {
              window: 60,
              max: 5,
            },
          },
        },
        session: {
          cookieCache: {
            enabled: true,
            maxAge: 60 * 5, // 5 minutes
          },
          expiresIn: 60 * 60 * 24 * 7, // 7 days
          updateAge: 60 * 60 * 24, // Update if older than 1 day
        },
        advanced: {
          useSecureCookies: env.BETTER_AUTH_URL.startsWith('https'),
          cookiePrefix: 'webtoon',
          crossSubDomainCookies: {
            enabled: false,
          },
          generateId: () => crypto.randomUUID(),
        },
        trustedOrigins: [env.BETTER_AUTH_URL],
      }
    ),
  });
}

/**
 * Static auth instance for CLI usage (schema generation)
 *
 * The CLI needs a static export to infer types
 */
export const auth = betterAuth({
  database: drizzleAdapter({} as any, {
    provider: 'sqlite',
    usePlural: true,
    schema: schema,
  }),
  secret: 'cli-secret-placeholder',
  baseURL: 'http://localhost:5173',
  emailAndPassword: {
    enabled: true,
  },
});
