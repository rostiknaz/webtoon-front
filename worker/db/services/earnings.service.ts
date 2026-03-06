/**
 * Earnings Service
 *
 * Monthly earnings calculation and ledger queries for creator payouts.
 * Uses download proportion model: each creator's share of total downloads
 * determines their share of the revenue pool.
 */

import { eq, sql } from 'drizzle-orm';
import { creatorEarnings, paymentTransactions, downloads, clips, users } from '../../../db/schema';
import type { DB } from '../index';

// ==================== Interfaces ====================

export interface EarningsCalculationSummary {
  month: string;
  totalRevenue: number;
  totalDownloads: number;
  creatorsProcessed: number;
  totalPayout: number;
}

export interface CreatorEarningsRow {
  id: string;
  month: string;
  totalDownloads: number;
  earningsAmount: number;
  revenueShare: number;
  status: string;
  paidAt: Date | null;
}

interface EarningsUpsertRow {
  id: string;
  creatorId: string;
  month: string;
  totalDownloads: number;
  platformRevenue: number;
  totalPlatformDownloads: number;
  earningsAmount: number;
  revenueShare: number;
  status: string;
}

// ==================== Calculation ====================

/**
 * Calculate monthly earnings for all creators.
 *
 * Formula per creator:
 *   earnings = totalRevenue × (revenueShare / 100) × (creatorDownloads / totalPlatformDownloads)
 *
 * Idempotent: uses ON CONFLICT DO UPDATE on (creatorId, month) unique index.
 */
export async function calculateMonthlyEarnings(
  db: DB,
  month: string,
): Promise<EarningsCalculationSummary> {
  // Parse month to Unix timestamp range
  const monthStart = new Date(`${month}-01T00:00:00Z`);
  const nextMonth = new Date(monthStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const monthStartUnix = Math.floor(monthStart.getTime() / 1000);
  const monthEndUnix = Math.floor(nextMonth.getTime() / 1000);

  // 3 parallel queries
  const [revenueResult, downloadsByCreator, creatorsResult] = await Promise.all([
    // Query 1: Total platform revenue for the month
    db.select({
      total: sql<number>`COALESCE(SUM(${paymentTransactions.amount}), 0)`,
    })
      .from(paymentTransactions)
      .where(sql`${paymentTransactions.status} = 'success' AND ${paymentTransactions.createdAt} >= ${monthStartUnix} AND ${paymentTransactions.createdAt} < ${monthEndUnix}`),

    // Query 2: Downloads by creator for the month
    db.select({
      creatorId: clips.creatorId,
      downloadCount: sql<number>`COUNT(*)`,
    })
      .from(downloads)
      .innerJoin(clips, eq(downloads.clipId, clips.id))
      .where(sql`${downloads.createdAt} >= ${monthStartUnix} AND ${downloads.createdAt} < ${monthEndUnix}`)
      .groupBy(clips.creatorId),

    // Query 3: Creator founding status
    db.select({
      id: users.id,
      isFoundingCreator: users.isFoundingCreator,
    })
      .from(users)
      .where(sql`${users.role} IN ('creator', 'admin')`),
  ]);

  const totalRevenue = Number(revenueResult[0]?.total ?? 0);
  const totalPlatformDownloads = downloadsByCreator.reduce(
    (sum, row) => sum + Number(row.downloadCount),
    0,
  );

  // Build download lookup map
  const downloadMap = new Map(
    downloadsByCreator.map((row) => [row.creatorId, Number(row.downloadCount)]),
  );

  // Calculate earnings for each creator with downloads
  const earningsRows: EarningsUpsertRow[] = [];

  let totalPayout = 0;

  for (const creator of creatorsResult) {
    const creatorDownloads = downloadMap.get(creator.id) ?? 0;
    const revenueShare = creator.isFoundingCreator ? 70 : 50;

    let earnings = 0;
    if (totalPlatformDownloads > 0 && totalRevenue > 0) {
      const proportion = creatorDownloads / totalPlatformDownloads;
      earnings = Math.round(totalRevenue * (revenueShare / 100) * proportion);
    }

    totalPayout += earnings;

    earningsRows.push({
      id: crypto.randomUUID(),
      creatorId: creator.id,
      month,
      totalDownloads: creatorDownloads,
      platformRevenue: totalRevenue,
      totalPlatformDownloads,
      earningsAmount: earnings,
      revenueShare,
      status: 'pending',
    });
  }

  // Batch upsert all earnings rows (chunk if > 128)
  if (earningsRows.length > 0) {
    const BATCH_SIZE = 128;
    for (let i = 0; i < earningsRows.length; i += BATCH_SIZE) {
      const chunk = earningsRows.slice(i, i + BATCH_SIZE);
      const statements = chunk.map((row) =>
        db
          .insert(creatorEarnings)
          .values(row)
          .onConflictDoUpdate({
            target: [creatorEarnings.creatorId, creatorEarnings.month],
            set: {
              totalDownloads: sql`excluded.total_downloads`,
              platformRevenue: sql`excluded.platform_revenue`,
              totalPlatformDownloads: sql`excluded.total_platform_downloads`,
              earningsAmount: sql`excluded.earnings_amount`,
              revenueShare: sql`excluded.revenue_share`,
              status: 'pending' as const,
              updatedAt: sql`(unixepoch())`,
            },
          }),
      );
      await db.batch(statements as [typeof statements[0], ...typeof statements]);
    }
  }

  return {
    month,
    totalRevenue,
    totalDownloads: totalPlatformDownloads,
    creatorsProcessed: creatorsResult.length,
    totalPayout,
  };
}

// ==================== Ledger Queries ====================

/**
 * Get a creator's earnings ledger (last 12 months, newest first)
 */
export async function getCreatorEarningsLedger(
  db: DB,
  creatorId: string,
): Promise<CreatorEarningsRow[]> {
  const rows = await db
    .select({
      id: creatorEarnings.id,
      month: creatorEarnings.month,
      totalDownloads: creatorEarnings.totalDownloads,
      earningsAmount: creatorEarnings.earningsAmount,
      revenueShare: creatorEarnings.revenueShare,
      status: creatorEarnings.status,
      paidAt: creatorEarnings.paidAt,
    })
    .from(creatorEarnings)
    .where(eq(creatorEarnings.creatorId, creatorId))
    .orderBy(sql`${creatorEarnings.month} DESC`)
    .limit(12);

  return rows;
}

