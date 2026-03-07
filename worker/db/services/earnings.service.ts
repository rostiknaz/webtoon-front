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
import { Errors } from '../../lib/errors';

// ==================== Constants ====================

/** Maximum batch size for D1 insert operations to avoid query size limits */
const BATCH_SIZE = 128;

/** Revenue share percentage for founding creators */
const FOUNDING_CREATOR_SHARE = 70;

/** Revenue share percentage for standard creators */
const STANDARD_CREATOR_SHARE = 50;

/** CSV injection trigger characters that need escaping */
const CSV_FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

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

export interface PayoutEntry {
  id: string;
  creatorId: string;
  creatorName: string | null;
  creatorEmail: string;
  month: string;
  totalDownloads: number;
  platformRevenue: number;
  totalPlatformDownloads: number;
  earningsAmount: number;
  revenueShare: number;
  status: string;
  paidAt: Date | null;
  createdAt: Date;
}

export interface PayoutMonth {
  month: string;
  creatorCount: number;
  totalPayout: number;
  pendingCount: number;
  approvedCount: number;
  paidCount: number;
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

// ==================== Helpers ====================

/**
 * Parse YYYY-MM month string to Unix timestamp range
 * @returns [startUnix, endUnix] for the month (inclusive start, exclusive end)
 */
function parseMonthToUnixRange(month: string): [number, number] {
  const monthStart = new Date(`${month}-01T00:00:00Z`);
  const nextMonth = new Date(monthStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  return [
    Math.floor(monthStart.getTime() / 1000),
    Math.floor(nextMonth.getTime() / 1000),
  ];
}

/**
 * Calculate revenue share percentage based on creator status
 */
function getRevenueShare(isFoundingCreator: boolean): number {
  return isFoundingCreator ? FOUNDING_CREATOR_SHARE : STANDARD_CREATOR_SHARE;
}

/**
 * Calculate earnings for a single creator based on download proportion
 */
function calculateCreatorEarnings(
  creatorDownloads: number,
  totalPlatformDownloads: number,
  totalRevenue: number,
  revenueShare: number,
): number {
  if (totalPlatformDownloads === 0 || totalRevenue === 0) {
    return 0;
  }
  const proportion = creatorDownloads / totalPlatformDownloads;
  return Math.round(totalRevenue * (revenueShare / 100) * proportion);
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
  const [monthStartUnix, monthEndUnix] = parseMonthToUnixRange(month);

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

  // Calculate earnings for each creator
  const earningsRows: EarningsUpsertRow[] = creatorsResult.map((creator) => {
    const creatorDownloads = downloadMap.get(creator.id) ?? 0;
    const revenueShare = getRevenueShare(creator.isFoundingCreator);
    const earnings = calculateCreatorEarnings(
      creatorDownloads,
      totalPlatformDownloads,
      totalRevenue,
      revenueShare,
    );

    return {
      id: crypto.randomUUID(),
      creatorId: creator.id,
      month,
      totalDownloads: creatorDownloads,
      platformRevenue: totalRevenue,
      totalPlatformDownloads,
      earningsAmount: earnings,
      revenueShare,
      status: 'pending',
    };
  });

  const totalPayout = earningsRows.reduce((sum, row) => sum + row.earningsAmount, 0);

  // Batch upsert all earnings rows (chunk to avoid D1 query size limits)
  if (earningsRows.length > 0) {
    for (let i = 0; i < earningsRows.length; i += BATCH_SIZE) {
      const chunk = earningsRows.slice(i, i + BATCH_SIZE);
      const statements = chunk.map((row) =>
        db
          .insert(creatorEarnings)
          .values(row)
          .onConflictDoUpdate({
            target: [creatorEarnings.creatorId, creatorEarnings.month],
            // Only update financials; preserve status if already approved/paid
            set: {
              totalDownloads: sql`excluded.total_downloads`,
              platformRevenue: sql`excluded.platform_revenue`,
              totalPlatformDownloads: sql`excluded.total_platform_downloads`,
              earningsAmount: sql`excluded.earnings_amount`,
              revenueShare: sql`excluded.revenue_share`,
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

// ==================== Admin Payout Queries ====================

/**
 * Get all earnings for a given month with creator info.
 * Returns all creators' earnings for admin payout review.
 */
export async function getPayoutsByMonth(
  db: DB,
  month: string,
): Promise<PayoutEntry[]> {
  const rows = await db
    .select({
      id: creatorEarnings.id,
      creatorId: creatorEarnings.creatorId,
      creatorName: users.name,
      creatorEmail: users.email,
      month: creatorEarnings.month,
      totalDownloads: creatorEarnings.totalDownloads,
      platformRevenue: creatorEarnings.platformRevenue,
      totalPlatformDownloads: creatorEarnings.totalPlatformDownloads,
      earningsAmount: creatorEarnings.earningsAmount,
      revenueShare: creatorEarnings.revenueShare,
      status: creatorEarnings.status,
      paidAt: creatorEarnings.paidAt,
      createdAt: creatorEarnings.createdAt,
    })
    .from(creatorEarnings)
    .innerJoin(users, eq(creatorEarnings.creatorId, users.id))
    .where(eq(creatorEarnings.month, month))
    .orderBy(sql`${creatorEarnings.earningsAmount} DESC`);

  return rows;
}

/**
 * Get available months with summary stats for admin payout overview.
 * Returns counts per status instead of MIN(status) for accurate overall status.
 */
export async function getPayoutMonths(db: DB): Promise<PayoutMonth[]> {
  const rows = await db
    .select({
      month: creatorEarnings.month,
      creatorCount: sql<number>`COUNT(*)`,
      totalPayout: sql<number>`COALESCE(SUM(${creatorEarnings.earningsAmount}), 0)`,
      pendingCount: sql<number>`SUM(CASE WHEN ${creatorEarnings.status} = 'pending' THEN 1 ELSE 0 END)`,
      approvedCount: sql<number>`SUM(CASE WHEN ${creatorEarnings.status} = 'approved' THEN 1 ELSE 0 END)`,
      paidCount: sql<number>`SUM(CASE WHEN ${creatorEarnings.status} = 'paid' THEN 1 ELSE 0 END)`,
    })
    .from(creatorEarnings)
    .groupBy(creatorEarnings.month)
    .orderBy(sql`${creatorEarnings.month} DESC`)
    .limit(24);

  return rows.map((row) => ({
    month: row.month,
    creatorCount: Number(row.creatorCount),
    totalPayout: Number(row.totalPayout),
    pendingCount: Number(row.pendingCount),
    approvedCount: Number(row.approvedCount),
    paidCount: Number(row.paidCount),
  }));
}

// ==================== Admin Payout Actions ====================

/**
 * Approve all pending earnings for a given month.
 * Sets status to 'approved'. Returns count of updated rows.
 */
export async function approvePayoutBatch(
  db: DB,
  month: string,
): Promise<number> {
  const updated = await db
    .update(creatorEarnings)
    .set({
      status: 'approved',
      updatedAt: sql`(unixepoch())`,
    })
    .where(sql`${creatorEarnings.month} = ${month} AND ${creatorEarnings.status} = 'pending'`)
    .returning({ id: creatorEarnings.id });

  if (updated.length === 0) {
    throw Errors.validation('No pending entries found for this month');
  }

  return updated.length;
}

/**
 * Mark all approved earnings for a given month as paid.
 * Records paidAt timestamp. Returns count of updated rows.
 */
export async function markPayoutBatchPaid(
  db: DB,
  month: string,
): Promise<number> {
  const updated = await db
    .update(creatorEarnings)
    .set({
      status: 'paid',
      paidAt: sql`(unixepoch())`,
      updatedAt: sql`(unixepoch())`,
    })
    .where(sql`${creatorEarnings.month} = ${month} AND ${creatorEarnings.status} = 'approved'`)
    .returning({ id: creatorEarnings.id });

  if (updated.length === 0) {
    throw Errors.validation('No approved entries found for this month');
  }

  return updated.length;
}

// ==================== CSV Export ====================

/**
 * Escape a CSV field value (handle commas, quotes, newlines, formula injection).
 * Prefixes formula-trigger characters to prevent Excel/Sheets code execution.
 */
function escapeCsvField(value: string): string {
  // Neutralize CSV injection: prefix formula-triggering characters with a single quote
  let safe = value;
  if (CSV_FORMULA_TRIGGERS.test(safe)) {
    safe = `'${safe}`;
  }
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * Generate CSV string for all earnings in a given month.
 * Includes creator info and formats earnings as dollars.
 */
export async function generatePayoutCsv(
  db: DB,
  month: string,
): Promise<string> {
  const payouts = await getPayoutsByMonth(db, month);

  const headers = 'Creator Name,Email,Downloads,Revenue Share %,Earnings ($),Status,Paid At';
  const rows = payouts.map((p) => {
    const paidAt = p.paidAt ? new Date(p.paidAt).toISOString() : '';
    return [
      escapeCsvField(p.creatorName ?? 'Unknown'),
      escapeCsvField(p.creatorEmail),
      String(p.totalDownloads),
      String(p.revenueShare),
      (Number(p.earningsAmount) / 100).toFixed(2),
      p.status,
      paidAt,
    ].join(',');
  });

  return [headers, ...rows].join('\n');
}
