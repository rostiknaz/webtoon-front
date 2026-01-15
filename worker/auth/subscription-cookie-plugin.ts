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
import { getUserSubscription } from '../db/services/subscription.service';
import type { DB } from '../db';

interface PluginOptions {
  db: DB;
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
  const { db, secret, isSecure } = options;

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
            // newSession is available after successful auth
            const newSession = ctx.context.newSession;
            if (!newSession?.user?.id) return;

            try {
              // Fetch user's subscription from database
              const subscription = await getUserSubscription(db, newSession.user.id);

              // Determine expiration: active/trial with valid period, or 0 (no subscription)
              const expiresAt =
                subscription &&
                ['active', 'trial'].includes(subscription.status) &&
                subscription.currentPeriodEnd
                  ? subscription.currentPeriodEnd
                  : 0;

              const planId = subscription?.planId || null;

              // Create signed cookie
              const cookie = await createSubscriptionSetCookie(
                expiresAt,
                planId,
                secret,
                isSecure
              );

              // Append to response headers
              ctx.context.responseHeaders?.append('Set-Cookie', cookie);
            } catch (error) {
              // Don't fail auth if cookie creation fails
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
            // Append clear cookie to response headers
            ctx.context.responseHeaders?.append('Set-Cookie', clearSubscriptionCookie());
          }),
        },
      ],
    },
  };
}
