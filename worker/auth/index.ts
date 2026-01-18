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
import { subscriptionCookiePlugin } from './subscription-cookie-plugin';

/**
 * Create Better Auth instance for runtime (per-request)
 *
 * Called for each incoming request with environment bindings
 */
export function createAuth(env: Bindings, cf?: IncomingRequestCfProperties) {
  // Create Drizzle instance with D1 binding
  const db = drizzle(env.DB, { schema }) as any;
  const isSecure = env.BETTER_AUTH_URL.startsWith('https');

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
          useSecureCookies: isSecure,
          cookiePrefix: 'webtoon',
          crossSubDomainCookies: {
            enabled: false,
          },
          generateId: () => crypto.randomUUID(),
          // Explicit cookie config for OAuth state to survive redirects
          defaultCookieAttributes: {
            sameSite: 'lax', // Required for OAuth redirects to work
            path: '/',
            httpOnly: true,
          },
        },
        trustedOrigins: [
          env.BETTER_AUTH_URL,
          // Include both localhost ports for development (Vite uses next available port)
          'http://localhost:5173',
          'http://localhost:5174',
        ],
        // Error handling for OAuth - redirect to frontend instead of showing HTML error page
        onAPIError: {
          errorURL: '/auth-error',
        },
        // Account linking - allow OAuth to link to existing email accounts
        account: {
          accountLinking: {
            enabled: true,
            trustedProviders: ['google'],
          },
        },
        // OAuth Social Providers
        socialProviders: {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        },
        // Plugins
        plugins: [
          subscriptionCookiePlugin({
            db,
            cache: env.CACHE,
            secret: env.BETTER_AUTH_SECRET,
            isSecure,
          }),
        ],
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
  socialProviders: {
    google: {
      clientId: 'cli-placeholder',
      clientSecret: 'cli-placeholder',
    },
  },
});
