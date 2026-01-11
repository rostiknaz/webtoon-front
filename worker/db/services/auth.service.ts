/**
 * Authentication Service
 *
 * Type-safe queries for user sessions and subscription checks
 */

import { eq, and, gt, inArray, sql } from 'drizzle-orm';
import { sessions, users, subscriptions } from '../../../db/schema';
import type { DB } from '../index';

/**
 * Session data returned from database
 */
export interface SessionData {
  userId: string;
  email: string;
}

/**
 * Subscription data returned from database
 */
export interface SubscriptionData {
  status: string;
  currentPeriodEnd: number | null;
}

/**
 * Get user session by token
 *
 * Validates session token and returns user data if session is active.
 *
 * @param db - Drizzle database instance
 * @param token - Session token from cookie
 * @returns Session data with user info, or null if invalid/expired
 */
export async function getSessionByToken(
  db: DB,
  token: string
): Promise<SessionData | null> {
  const result = await db
    .select({
      userId: sessions.userId,
      email: users.email,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.token, token),
        gt(sessions.expiresAt, sql`unixepoch()`)
      )
    )
    .limit(1);

  return result[0] ?? null;
}

/**
 * Check if user has active subscription
 *
 * Returns true if user has active or trial subscription
 * that hasn't expired yet.
 *
 * @param db - Drizzle database instance
 * @param userId - User ID to check
 * @returns true if user has active subscription
 */
export async function hasActiveSubscription(
  db: DB,
  userId: string
): Promise<boolean> {
  const result = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, ['active', 'trial']),
        sql`(${subscriptions.currentPeriodEnd} IS NULL OR ${subscriptions.currentPeriodEnd} > unixepoch())`
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Get user's subscription details
 *
 * Returns subscription status and expiration for caching.
 *
 * @param db - Drizzle database instance
 * @param userId - User ID to check
 * @returns Subscription data or null if no active subscription
 */
export async function getUserSubscription(
  db: DB,
  userId: string
): Promise<SubscriptionData | null> {
  const result = await db
    .select({
      status: subscriptions.status,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, ['active', 'trial']),
        sql`(${subscriptions.currentPeriodEnd} IS NULL OR ${subscriptions.currentPeriodEnd} > unixepoch())`
      )
    )
    .limit(1);

  if (!result[0]) return null;

  return {
    status: result[0].status,
    currentPeriodEnd: result[0].currentPeriodEnd ? Math.floor(result[0].currentPeriodEnd.getTime() / 1000) : null,
  };
}
