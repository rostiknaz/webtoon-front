/**
 * Credit Cookie Plugin for Better Auth
 *
 * Automatically initializes credits for new users and sets a signed
 * credit cookie after successful authentication (sign-in, sign-up, OAuth callback).
 * Clears the cookie on sign-out.
 *
 * Follows the exact same pattern as subscription-cookie-plugin.ts.
 */

import { createAuthMiddleware } from 'better-auth/api';
import type { BetterAuthPlugin } from 'better-auth';
import {
  createCreditSetCookie,
  clearCreditCookie,
} from '../lib/credit-cookie';
import { getOrInitializeCredits } from '../db/services/credits.service';
import type { DB } from '../db';

interface PluginOptions {
  db: DB;
  secret: string;
  isSecure: boolean;
}

/**
 * Creates a Better Auth plugin that manages credit initialization and cookies.
 *
 * - Initializes credits on sign-up and OAuth callback (new users)
 * - Sets cookie on sign-in, sign-up, and OAuth callback
 * - Clears cookie on sign-out
 * - Cookie contains signed balance + free downloads (tamper-proof)
 */
export function creditCookiePlugin(options: PluginOptions): BetterAuthPlugin {
  const { db, secret, isSecure } = options;

  return {
    id: 'credit-cookie',

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
              // Get or initialize credits (single query for existing users)
              const userCredits = await getOrInitializeCredits(db, userId);
              const balance = userCredits.balance;
              const freeDownloads = userCredits.freeDownloadsRemaining;

              const cookie = await createCreditSetCookie(
                balance,
                freeDownloads,
                secret,
                isSecure,
              );

              ctx.context.responseHeaders?.append('Set-Cookie', cookie);
            } catch (error) {
              console.error('Failed to set credit cookie:', error);
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
            ctx.context.responseHeaders?.append('Set-Cookie', clearCreditCookie());
          }),
        },
      ],
    },
  };
}
