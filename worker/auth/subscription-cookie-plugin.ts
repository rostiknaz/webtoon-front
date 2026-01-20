/**
 * Subscription Cookie Plugin for Better Auth
 *
 * Automatically sets a signed subscription cookie after successful authentication.
 * This allows the frontend to check subscription status without API calls.
 *
 * The cookie is tamper-proof: users can read it but cannot forge a valid signature.
 */

import { createAuthMiddleware } from 'better-auth/api';
import type { BetterAuthPlugin } from 'better-auth';
import {
  createSubscriptionSetCookie,
  clearSubscriptionCookie,
} from '../lib/subscription-cookie';
import { getCachedSubscription } from '../lib/subscription-helpers';
import { createCacheLayer } from '../../lib/cache';
import type { DB } from '../db';

interface PluginOptions {
  db: DB;
  cache: KVNamespace;
  secret: string;
  isSecure: boolean;
}

/**
 * Creates a Better Auth plugin that manages subscription cookies
 *
 * - Sets cookie on sign-in, sign-up, and OAuth callback
 * - Clears cookie on sign-out
 * - Cookie contains signed expiration timestamp (tamper-proof)
 */
export function subscriptionCookiePlugin(options: PluginOptions): BetterAuthPlugin {
  const { db, cache: kvCache, secret, isSecure } = options;
  const cacheLayer = createCacheLayer(kvCache);

  return {
    id: 'subscription-cookie',

    hooks: {
      after: [
        {
          // Run on auth endpoints that create sessions
          matcher: (ctx) => {
            const path = ctx.path ?? '';
            return (
              path.startsWith('/sign-in') ||
              path.startsWith('/sign-up') ||
              path.includes('/callback')
            );
          },

          handler: createAuthMiddleware(async (ctx) => {
            const newSession = ctx.context.newSession;
            if (!newSession?.user?.id) return;

            const userId = newSession.user.id;

            try {
              const cachedSub = await getCachedSubscription(cacheLayer, db, userId);

              // Determine cookie values from cached subscription
              const expiresAt = cachedSub?.hasAccess && cachedSub.currentPeriodEnd > Date.now() / 1000
                ? cachedSub.currentPeriodEnd
                : 0;
              const planId = cachedSub?.planId || null;

              const cookie = await createSubscriptionSetCookie(
                expiresAt,
                planId,
                secret,
                isSecure
              );

              ctx.context.responseHeaders?.append('Set-Cookie', cookie);
            } catch (error) {
              console.error('Failed to set subscription cookie:', error);
            }
          }),
        },
        {
          // Clear cookie on sign-out
          matcher: (ctx) => {
            const path = ctx.path ?? '';
            return path === '/sign-out';
          },

          handler: createAuthMiddleware(async (ctx) => {
            ctx.context.responseHeaders?.append('Set-Cookie', clearSubscriptionCookie());
          }),
        },
      ],
    },
  };
}
