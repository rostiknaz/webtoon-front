/**
 * Platform Metrics Service
 *
 * Aggregates business metrics for the admin dashboard.
 * All queries run in parallel via Promise.all against D1 read replicas.
 */

import { sql, desc } from 'drizzle-orm';
import { clips, users, subscriptions, downloads, paymentTransactions, creatorEarnings } from '../../../db/schema';
import type { DB } from '../index';

// ==================== Types ====================

interface MetricWithTrend {
  value: number;
  trend: number | null;
}

export interface PlatformMetrics {
  totalVideos: MetricWithTrend;
  registeredUsers: MetricWithTrend;
  activeSubscribers: MetricWithTrend;
  totalDownloads: MetricWithTrend;
  monthlyRevenue: MetricWithTrend;
  creatorPoolBalance: MetricWithTrend;
}

// ==================== Helpers ====================

/**
 * Get current and previous month boundaries as Unix timestamps
 */
function getMonthBoundaries(): {
  currentMonthStart: number;
  currentMonthEnd: number;
  prevMonthStart: number;
} {
  const now = new Date();
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const currentMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  return {
    currentMonthStart: Math.floor(currentMonthStart.getTime() / 1000),
    currentMonthEnd: Math.floor(currentMonthEnd.getTime() / 1000),
    prevMonthStart: Math.floor(prevMonthStart.getTime() / 1000),
  };
}

/**
 * Calculate percentage change between two values.
 * Returns null if not applicable, handles division by zero.
 */
function calcTrend(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// ==================== Main Query ====================

/**
 * Fetch all platform metrics with period-over-period trends.
 * Runs ~10 queries in parallel via Promise.all against D1 read replicas.
 */
export async function getPlatformMetrics(db: DB): Promise<PlatformMetrics> {
  const { currentMonthStart, currentMonthEnd, prevMonthStart } = getMonthBoundaries();

  const [
    // Current totals
    totalVideosResult,
    totalUsersResult,
    activeSubsResult,
    totalDownloadsResult,
    currentRevenueResult,
    creatorPoolResult,
    // Trend data
    videosThisMonthResult,
    videosLastMonthResult,
    usersThisMonthResult,
    usersLastMonthResult,
    subsThisMonthResult,
    subsLastMonthResult,
    downloadsThisMonthResult,
    downloadsLastMonthResult,
    prevRevenueResult,
  ] = await Promise.all([
    // ---- Current totals ----
    // Total published videos
    db.select({ count: sql<number>`COUNT(*)` })
      .from(clips)
      .where(sql`${clips.status} = 'published'`),

    // Total registered users
    db.select({ count: sql<number>`COUNT(*)` })
      .from(users),

    // Active subscribers
    db.select({ count: sql<number>`COUNT(*)` })
      .from(subscriptions)
      .where(sql`${subscriptions.status} = 'active'`),

    // Total downloads
    db.select({ count: sql<number>`COUNT(*)` })
      .from(downloads),

    // Current month revenue
    db.select({ total: sql<number>`COALESCE(SUM(${paymentTransactions.amount}), 0)` })
      .from(paymentTransactions)
      .where(sql`${paymentTransactions.status} = 'success' AND ${paymentTransactions.createdAt} >= ${currentMonthStart} AND ${paymentTransactions.createdAt} < ${currentMonthEnd}`),

    // Creator pool balance (pending earnings)
    db.select({ total: sql<number>`COALESCE(SUM(${creatorEarnings.earningsAmount}), 0)` })
      .from(creatorEarnings)
      .where(sql`${creatorEarnings.status} = 'pending'`),

    // ---- Trend: Videos published this month vs last month ----
    db.select({ count: sql<number>`COUNT(*)` })
      .from(clips)
      .where(sql`${clips.status} = 'published' AND ${clips.publishedAt} >= ${currentMonthStart} AND ${clips.publishedAt} < ${currentMonthEnd}`),

    db.select({ count: sql<number>`COUNT(*)` })
      .from(clips)
      .where(sql`${clips.status} = 'published' AND ${clips.publishedAt} >= ${prevMonthStart} AND ${clips.publishedAt} < ${currentMonthStart}`),

    // ---- Trend: Users registered this month vs last month ----
    db.select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(sql`${users.createdAt} >= ${currentMonthStart} AND ${users.createdAt} < ${currentMonthEnd}`),

    db.select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(sql`${users.createdAt} >= ${prevMonthStart} AND ${users.createdAt} < ${currentMonthStart}`),

    // ---- Trend: Active subs created this month vs last month ----
    db.select({ count: sql<number>`COUNT(*)` })
      .from(subscriptions)
      .where(sql`${subscriptions.status} = 'active' AND ${subscriptions.createdAt} >= ${currentMonthStart}`),

    db.select({ count: sql<number>`COUNT(*)` })
      .from(subscriptions)
      .where(sql`${subscriptions.status} = 'active' AND ${subscriptions.createdAt} >= ${prevMonthStart} AND ${subscriptions.createdAt} < ${currentMonthStart}`),

    // ---- Trend: Downloads this month vs last month ----
    db.select({ count: sql<number>`COUNT(*)` })
      .from(downloads)
      .where(sql`${downloads.createdAt} >= ${currentMonthStart} AND ${downloads.createdAt} < ${currentMonthEnd}`),

    db.select({ count: sql<number>`COUNT(*)` })
      .from(downloads)
      .where(sql`${downloads.createdAt} >= ${prevMonthStart} AND ${downloads.createdAt} < ${currentMonthStart}`),

    // ---- Trend: Previous month revenue ----
    db.select({ total: sql<number>`COALESCE(SUM(${paymentTransactions.amount}), 0)` })
      .from(paymentTransactions)
      .where(sql`${paymentTransactions.status} = 'success' AND ${paymentTransactions.createdAt} >= ${prevMonthStart} AND ${paymentTransactions.createdAt} < ${currentMonthStart}`),
  ]);

  const totalVideos = Number(totalVideosResult[0]?.count ?? 0);
  const totalUsers = Number(totalUsersResult[0]?.count ?? 0);
  const activeSubs = Number(activeSubsResult[0]?.count ?? 0);
  const totalDl = Number(totalDownloadsResult[0]?.count ?? 0);
  const currentRevenue = Number(currentRevenueResult[0]?.total ?? 0);
  const creatorPool = Number(creatorPoolResult[0]?.total ?? 0);

  const videosThisMonth = Number(videosThisMonthResult[0]?.count ?? 0);
  const videosLastMonth = Number(videosLastMonthResult[0]?.count ?? 0);
  const usersThisMonth = Number(usersThisMonthResult[0]?.count ?? 0);
  const usersLastMonth = Number(usersLastMonthResult[0]?.count ?? 0);
  const subsThisMonth = Number(subsThisMonthResult[0]?.count ?? 0);
  const subsLastMonth = Number(subsLastMonthResult[0]?.count ?? 0);
  const dlThisMonth = Number(downloadsThisMonthResult[0]?.count ?? 0);
  const dlLastMonth = Number(downloadsLastMonthResult[0]?.count ?? 0);
  const prevRevenue = Number(prevRevenueResult[0]?.total ?? 0);

  return {
    totalVideos: { value: totalVideos, trend: calcTrend(videosThisMonth, videosLastMonth) },
    registeredUsers: { value: totalUsers, trend: calcTrend(usersThisMonth, usersLastMonth) },
    activeSubscribers: { value: activeSubs, trend: calcTrend(subsThisMonth, subsLastMonth) },
    totalDownloads: { value: totalDl, trend: calcTrend(dlThisMonth, dlLastMonth) },
    monthlyRevenue: { value: currentRevenue, trend: calcTrend(currentRevenue, prevRevenue) },
    creatorPoolBalance: { value: creatorPool, trend: null },
  };
}

// ==================== Creator Activity ====================

const UPLOAD_FLAG_THRESHOLD = 30;
const FLAG_WINDOW_SECONDS = 24 * 60 * 60; // 24 hours

export interface CreatorActivity {
  creatorId: string;
  creatorName: string | null;
  creatorEmail: string;
  totalUploads: number;
  uploadsLast24h: number;
  uploadsLast7d: number;
  lastUploadAt: string | null;
  isFlagged: boolean;
}

/**
 * Get creator upload activity with 30+/24h threshold flagging.
 * Sorted by most recent upload by default.
 */
export async function getCreatorActivity(
  db: DB,
  sortBy: 'recent' | 'total' | 'flagged' = 'recent',
): Promise<CreatorActivity[]> {
  const now = Math.floor(Date.now() / 1000);
  const twentyFourHoursAgo = now - FLAG_WINDOW_SECONDS;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60;

  const totalUploadsExpr = sql<number>`COUNT(${clips.id})`.as('total_uploads');
  const uploadsLast24hExpr = sql<number>`SUM(CASE WHEN ${clips.createdAt} >= ${twentyFourHoursAgo} THEN 1 ELSE 0 END)`.as('uploads_24h');
  const uploadsLast7dExpr = sql<number>`SUM(CASE WHEN ${clips.createdAt} >= ${sevenDaysAgo} THEN 1 ELSE 0 END)`.as('uploads_7d');
  const lastUploadAtExpr = sql<number | null>`MAX(${clips.createdAt})`.as('last_upload');

  const ORDER_BY_MAP = {
    total: desc(totalUploadsExpr),
    flagged: desc(uploadsLast24hExpr),
    recent: desc(lastUploadAtExpr),
  } as const;

  const results = await db
    .select({
      creatorId: users.id,
      creatorName: users.displayName,
      creatorEmail: users.email,
      totalUploads: totalUploadsExpr,
      uploadsLast24h: uploadsLast24hExpr,
      uploadsLast7d: uploadsLast7dExpr,
      lastUploadAt: lastUploadAtExpr,
    })
    .from(users)
    .innerJoin(clips, sql`${clips.creatorId} = ${users.id}`)
    .where(sql`${users.role} IN ('creator', 'admin')`)
    .groupBy(users.id)
    .orderBy(ORDER_BY_MAP[sortBy]);

  return results.map((row) => {
    const uploadsLast24h = Number(row.uploadsLast24h ?? 0);
    const lastUploadTs = row.lastUploadAt;
    return {
      creatorId: row.creatorId,
      creatorName: row.creatorName,
      creatorEmail: row.creatorEmail,
      totalUploads: Number(row.totalUploads),
      uploadsLast24h,
      uploadsLast7d: Number(row.uploadsLast7d ?? 0),
      lastUploadAt: lastUploadTs ? new Date(lastUploadTs * 1000).toISOString() : null,
      isFlagged: uploadsLast24h >= UPLOAD_FLAG_THRESHOLD,
    };
  });
}
