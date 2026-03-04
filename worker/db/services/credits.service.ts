/**
 * Credits Service
 *
 * Manages user credit balances and free download tracking.
 * Standalone functions (never classes) following project conventions.
 */

import { eq } from 'drizzle-orm';
import { credits, creditTransactions } from '../../../db/schema';
import type { DB } from '../index';

const FREE_DOWNLOADS_ON_REGISTRATION = 3;

export interface UserCredits {
  balance: number;
  freeDownloadsRemaining: number;
}

/**
 * Initialize credits for a newly registered user.
 *
 * Inserts a credits row with freeDownloadsRemaining=3, balance=0.
 * Uses INSERT OR IGNORE to handle duplicates gracefully (no error if user already has credits).
 * Also records the registration transaction in the ledger.
 */
export async function initializeCredits(db: DB, userId: string): Promise<void> {
  // Insert credits row — ignore if user already has one (idempotent)
  const inserted = await db
    .insert(credits)
    .values({
      userId,
      balance: 0,
      freeDownloadsRemaining: FREE_DOWNLOADS_ON_REGISTRATION,
    })
    .onConflictDoNothing()
    .returning({ userId: credits.userId });

  // Only record registration transaction if credits row was actually created
  if (inserted.length > 0) {
    await db
      .insert(creditTransactions)
      .values({
        userId,
        amount: FREE_DOWNLOADS_ON_REGISTRATION,
        type: 'registration',
      });
  }
}

/**
 * Get credit balance for a user.
 *
 * @returns UserCredits or null if user has no credits row
 */
export async function getUserCredits(db: DB, userId: string): Promise<UserCredits | null> {
  const result = await db
    .select({
      balance: credits.balance,
      freeDownloadsRemaining: credits.freeDownloadsRemaining,
    })
    .from(credits)
    .where(eq(credits.userId, userId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get credit balance for a user, initializing if needed (combined query optimization).
 *
 * Optimized for auth flow: Most sign-ins are existing users, so SELECT first (fast path).
 * If user has no credits, initialize and return the new values.
 * Avoids double query (initializeCredits + getUserCredits) in the auth plugin.
 *
 * @returns UserCredits (never null — always initializes if missing)
 */
export async function getOrInitializeCredits(db: DB, userId: string): Promise<UserCredits> {
  // Fast path: try SELECT first (covers 99% of sign-ins)
  const existing = await getUserCredits(db, userId);
  if (existing) return existing;

  // Slow path: user has no credits row, initialize it
  await initializeCredits(db, userId);

  // Return the initialized values (avoid another SELECT)
  return {
    balance: 0,
    freeDownloadsRemaining: FREE_DOWNLOADS_ON_REGISTRATION,
  };
}
