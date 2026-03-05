/**
 * Download History Service
 *
 * Queries download history with clip + creator metadata.
 * Uses cursor-based pagination on downloads.createdAt descending.
 */

import { eq, and, lt, desc } from 'drizzle-orm';
import { downloads, clips, users } from '../../../db/schema';
import type { DB } from '../index';

export interface DownloadHistoryItem {
  clipId: string;
  title: string;
  creatorName: string;
  thumbnailUrl: string | null;
  downloadDate: string; // ISO 8601
  creditCost: number;
}

export interface DownloadHistoryResult {
  downloads: DownloadHistoryItem[];
  nextCursor: string | null;
}

/**
 * Get paginated download history for a user.
 *
 * JOINs downloads → clips → users to get title, thumbnail, and creator name.
 * Cursor-based pagination using downloads.createdAt (integer unixepoch) descending.
 */
export async function getDownloadHistory(
  db: DB,
  userId: string,
  cursor?: number,
  limit = 20,
): Promise<DownloadHistoryResult> {
  const conditions = [eq(downloads.userId, userId)];
  if (cursor) {
    conditions.push(lt(downloads.createdAt, new Date(cursor * 1000)));
  }

  const rows = await db
    .select({
      clipId: downloads.clipId,
      title: clips.title,
      creatorName: users.name,
      thumbnailUrl: clips.thumbnailUrl,
      createdAt: downloads.createdAt,
      creditCost: downloads.creditCost,
    })
    .from(downloads)
    .innerJoin(clips, eq(downloads.clipId, clips.id))
    .innerJoin(users, eq(clips.creatorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(downloads.createdAt))
    .limit(limit + 1); // Fetch one extra to detect next page

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  const result: DownloadHistoryItem[] = items.map((row) => ({
    clipId: row.clipId,
    title: row.title,
    creatorName: row.creatorName ?? 'Unknown',
    thumbnailUrl: row.thumbnailUrl,
    downloadDate: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
    creditCost: row.creditCost,
  }));

  const nextCursor = hasMore && items.length > 0
    ? String(Math.floor(items[items.length - 1].createdAt!.getTime() / 1000))
    : null;

  return { downloads: result, nextCursor };
}
