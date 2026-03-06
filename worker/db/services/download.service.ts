/**
 * Download Service
 *
 * Handles download transactions with atomic credit deduction.
 * Priority: free downloads > paid credits > subscription (subscribers skip credits entirely).
 * Re-downloads are free (enforced by unique index on userId + clipId).
 */

import { eq, and, sql } from 'drizzle-orm';
import { downloads, credits, creditTransactions, clips } from '../../../db/schema';
import type { DB } from '../index';
import { getUserActiveSubscription } from './subscription.service';
import { Errors } from '../../lib/errors';

export interface DownloadResult {
  alreadyDownloaded: boolean;
  creditCost: number;
  creditsRemaining: number;
  freeDownloadsRemaining: number;
  /** R2 object key for presigned URL generation */
  r2Key: string;
}

/**
 * Extract R2 object key from CDN video URL
 */
async function getUserCreditsBalance(db: DB, userId: string) {
  const rows = await db
    .select({ balance: credits.balance, freeDownloadsRemaining: credits.freeDownloadsRemaining })
    .from(credits)
    .where(eq(credits.userId, userId))
    .limit(1);
  return rows[0] ?? { balance: 0, freeDownloadsRemaining: 0 };
}

function extractR2Key(videoUrl: string, cdnUrl: string): string {
  const base = cdnUrl.endsWith('/') ? cdnUrl.slice(0, -1) : cdnUrl;
  return videoUrl.replace(base + '/', '');
}

/**
 * Process a download request with atomic credit deduction
 *
 * Flow:
 * 1. Validate clip exists and is published
 * 2. Check for existing download (re-download = free)
 * 3. Check subscription (subscriber = free)
 * 4. Check free downloads, then paid credits
 * 5. Insert download record + credit transaction
 * 6. Increment clip downloadCount (first download only)
 */
/**
 * Get all clip IDs a user has downloaded
 */
export async function getDownloadedClipIds(db: DB, userId: string): Promise<string[]> {
  const rows = await db
    .select({ clipId: downloads.clipId })
    .from(downloads)
    .where(eq(downloads.userId, userId));
  return rows.map((r) => r.clipId);
}

export async function processDownload(
  db: DB,
  userId: string,
  clipId: string,
  cdnUrl: string,
): Promise<DownloadResult> {
  // 1-3. Parallel: validate clip + check existing download + check subscription
  const [clipRows, existingDownload, subscription] = await Promise.all([
    db
      .select({
        id: clips.id,
        videoUrl: clips.videoUrl,
        creditCost: clips.creditCost,
        status: clips.status,
      })
      .from(clips)
      .where(eq(clips.id, clipId))
      .limit(1),
    db
      .select({ id: downloads.id })
      .from(downloads)
      .where(and(eq(downloads.userId, userId), eq(downloads.clipId, clipId)))
      .limit(1),
    getUserActiveSubscription(db, userId),
  ]);

  if (!clipRows[0] || clipRows[0].status !== 'published') {
    throw Errors.notFound('Clip', clipId);
  }

  if (!clipRows[0].videoUrl) {
    throw Errors.notFound('Clip video', clipId);
  }

  const clip = clipRows;
  const r2Key = extractR2Key(clip[0].videoUrl, cdnUrl);

  // Re-download is free
  if (existingDownload[0]) {
    const userCredits = await getUserCreditsBalance(db, userId);
    return {
      alreadyDownloaded: true,
      creditCost: 0,
      creditsRemaining: userCredits.balance,
      freeDownloadsRemaining: userCredits.freeDownloadsRemaining,
      r2Key,
    };
  }
  if (subscription) {
    // Batch: download record + increment count + fetch credits (all independent)
    const [, , creditsRows] = await db.batch([
      db.insert(downloads).values({ userId, clipId, creditCost: 0 }),
      db.update(clips)
        .set({ downloadCount: sql`${clips.downloadCount} + 1` })
        .where(eq(clips.id, clipId)),
      db.select({ balance: credits.balance, freeDownloadsRemaining: credits.freeDownloadsRemaining })
        .from(credits)
        .where(eq(credits.userId, userId))
        .limit(1),
    ]);

    const userCredits = (creditsRows as { balance: number; freeDownloadsRemaining: number }[])[0]
      ?? { balance: 0, freeDownloadsRemaining: 0 };
    return {
      alreadyDownloaded: false,
      creditCost: 0,
      creditsRemaining: userCredits.balance,
      freeDownloadsRemaining: userCredits.freeDownloadsRemaining,
      r2Key,
    };
  }

  // 4. Check free downloads first, then paid credits
  const userCredits = await getUserCreditsBalance(db, userId);
  const balance = userCredits.balance;
  const freeDownloads = userCredits.freeDownloadsRemaining;
  const clipCost = clip[0].creditCost;

  if (freeDownloads > 0) {
    // Use free download — db.batch() for D1-native atomic execution
    const [updated] = await db.batch([
      // Atomic decrement with WHERE guard
      db.update(credits)
        .set({
          freeDownloadsRemaining: sql`${credits.freeDownloadsRemaining} - 1`,
          updatedAt: sql`(unixepoch())`,
        })
        .where(and(
          eq(credits.userId, userId),
          sql`${credits.freeDownloadsRemaining} > 0`,
        ))
        .returning({ freeDownloadsRemaining: credits.freeDownloadsRemaining, balance: credits.balance }),
      // Insert credit transaction ledger entry
      db.insert(creditTransactions).values({
        userId,
        amount: -1,
        type: 'download',
        clipId,
      }),
      // Insert download record
      db.insert(downloads).values({ userId, clipId, creditCost: 1 }),
      // Increment download count
      db.update(clips)
        .set({ downloadCount: sql`${clips.downloadCount} + 1` })
        .where(eq(clips.id, clipId)),
    ]);

    const row = (updated as { freeDownloadsRemaining: number; balance: number }[])[0];
    if (!row) {
      throw Errors.forbidden('Insufficient credits');
    }

    return {
      alreadyDownloaded: false,
      creditCost: 1,
      creditsRemaining: row.balance,
      freeDownloadsRemaining: row.freeDownloadsRemaining,
      r2Key,
    };
  }

  if (balance >= clipCost) {
    // Use paid credits — db.batch() for D1-native atomic execution
    const [updated] = await db.batch([
      // Atomic decrement with WHERE guard
      db.update(credits)
        .set({
          balance: sql`${credits.balance} - ${clipCost}`,
          updatedAt: sql`(unixepoch())`,
        })
        .where(and(
          eq(credits.userId, userId),
          sql`${credits.balance} >= ${clipCost}`,
        ))
        .returning({ balance: credits.balance, freeDownloadsRemaining: credits.freeDownloadsRemaining }),
      // Insert credit transaction ledger entry
      db.insert(creditTransactions).values({
        userId,
        amount: -clipCost,
        type: 'download',
        clipId,
      }),
      // Insert download record
      db.insert(downloads).values({ userId, clipId, creditCost: clipCost }),
      // Increment download count
      db.update(clips)
        .set({ downloadCount: sql`${clips.downloadCount} + 1` })
        .where(eq(clips.id, clipId)),
    ]);

    const row = (updated as { balance: number; freeDownloadsRemaining: number }[])[0];
    if (!row) {
      throw Errors.forbidden('Insufficient credits');
    }

    return {
      alreadyDownloaded: false,
      creditCost: clipCost,
      creditsRemaining: row.balance,
      freeDownloadsRemaining: row.freeDownloadsRemaining,
      r2Key,
    };
  }

  // 5. Insufficient credits
  throw Errors.forbidden('Insufficient credits');
}
