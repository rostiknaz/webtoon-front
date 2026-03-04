/**
 * Clips Service
 *
 * Feed queries with cursor pagination, category batch loading,
 * clip CRUD for upload pipeline.
 */

import { eq, and, lt, gt, desc, inArray, like, sql, type SQL } from 'drizzle-orm';
import { clips, users, creatorSeries, clipCategories, moderationLogs } from '../../../db/schema';
import type { DB } from '../index';

/**
 * Single clip item in the feed response
 */
export interface ClipFeedItem {
  _id: string;
  title: string;
  creatorId: string;
  creatorName: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  downloadCount: number;
  views: number;
  likes: number;
  nsfwRating: string;
  seriesId: string | null;
  episodeNumber: number | null;
  seriesTotalEpisodes: number | null;
  publishedAt: string | null;
  categoryIds: string[];
}

export interface FeedQueryOptions {
  cursor?: string;
  limit?: number;
  category?: string;
  nsfw?: string;
  sort?: 'latest' | 'popular' | 'trending';
  search?: string;
}

export interface FeedResult {
  clips: ClipFeedItem[];
  nextCursor: string | null;
}

const feedSelectColumns = {
  id: clips.id,
  title: clips.title,
  creatorId: clips.creatorId,
  creatorDisplayName: users.displayName,
  creatorName: users.name,
  videoUrl: clips.videoUrl,
  thumbnailUrl: clips.thumbnailUrl,
  duration: clips.duration,
  downloadCount: clips.downloadCount,
  views: clips.views,
  likes: clips.likes,
  nsfwRating: clips.nsfwRating,
  seriesId: clips.seriesId,
  episodeNumber: clips.episodeNumber,
  seriesTotalEpisodes: creatorSeries.totalEpisodes,
  publishedAt: clips.publishedAt,
} as const;

/**
 * Get feed clips with cursor-based pagination
 *
 * Uses "limit + 1" pattern to determine if there's a next page.
 * Joins users for creatorName, creatorSeries for seriesTotalEpisodes.
 *
 * Sort modes:
 * - latest: keyset cursor on publishedAt (existing behavior)
 * - popular: offset cursor on views DESC
 * - trending: offset cursor on views DESC, filtered to last 7 days
 */
export async function getFeedClips(db: DB, options: FeedQueryOptions): Promise<FeedResult> {
  const { cursor, limit = 20, category, nsfw = 'safe', sort = 'latest', search } = options;
  const useOffsetPagination = sort !== 'latest';

  const conditions: SQL[] = [eq(clips.status, 'published')];
  if (nsfw === 'safe') conditions.push(eq(clips.nsfwRating, 'safe'));

  // Keyset cursor for latest sort
  if (!useOffsetPagination && cursor) {
    conditions.push(lt(clips.publishedAt, new Date(cursor)));
  }

  // Trending: only clips published in the last 7 days
  if (sort === 'trending') {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    conditions.push(gt(clips.publishedAt, sevenDaysAgo));
  }

  // Search: case-insensitive LIKE on title (escape wildcards in user input)
  if (search) {
    const escaped = search.replace(/[%_]/g, '\\$&');
    conditions.push(like(clips.title, `%${escaped}%`));
  }

  // Determine ORDER BY (secondary sort on id for stable tie-breaking)
  const orderBy = sort === 'latest'
    ? [desc(clips.publishedAt), desc(clips.id)]
    : [desc(clips.views), desc(clips.id)];

  // Offset for non-latest sorts (validated: NaN → 0, clamped to 0..10000)
  const rawOffset = useOffsetPagination && cursor ? parseInt(cursor, 10) : 0;
  const offset = Number.isNaN(rawOffset) ? 0 : Math.max(0, Math.min(rawOffset, 10000));

  if (category) {
    let query = db
      .select(feedSelectColumns)
      .from(clips)
      .innerJoin(clipCategories, eq(clips.id, clipCategories.clipId))
      .leftJoin(users, eq(clips.creatorId, users.id))
      .leftJoin(creatorSeries, eq(clips.seriesId, creatorSeries.id))
      .where(and(...conditions, eq(clipCategories.categoryId, category)))
      .orderBy(...orderBy)
      .limit(limit + 1);
    if (useOffsetPagination && offset > 0) query = query.offset(offset) as typeof query;

    const results = await query;
    return buildFeedResult(results, limit, useOffsetPagination ? offset : undefined);
  }

  let query = db
    .select(feedSelectColumns)
    .from(clips)
    .leftJoin(users, eq(clips.creatorId, users.id))
    .leftJoin(creatorSeries, eq(clips.seriesId, creatorSeries.id))
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(limit + 1);
  if (useOffsetPagination && offset > 0) query = query.offset(offset) as typeof query;

  const results = await query;
  return buildFeedResult(results, limit, useOffsetPagination ? offset : undefined);
}

/**
 * Build FeedResult from raw query results using limit+1 pattern
 *
 * @param offset - if provided, uses offset-based cursor (for popular/trending)
 */
function buildFeedResult(
  results: Array<{
    id: string;
    title: string;
    creatorId: string;
    creatorDisplayName: string | null;
    creatorName: string | null;
    videoUrl: string | null;
    thumbnailUrl: string | null;
    duration: number | null;
    downloadCount: number;
    views: number;
    likes: number;
    nsfwRating: string;
    seriesId: string | null;
    episodeNumber: number | null;
    seriesTotalEpisodes: number | null;
    publishedAt: Date | null;
  }>,
  limit: number,
  offset?: number,
): FeedResult {
  const hasMore = results.length > limit;
  const items = hasMore ? results.slice(0, limit) : results;

  let nextCursor: string | null = null;
  if (hasMore) {
    if (offset !== undefined) {
      // Offset-based cursor for popular/trending
      nextCursor = String(offset + limit);
    } else if (items.length > 0 && items[items.length - 1].publishedAt) {
      // Keyset cursor for latest
      nextCursor = items[items.length - 1].publishedAt!.toISOString();
    }
  }

  return {
    clips: items.map((row) => ({
      _id: row.id,
      title: row.title,
      creatorId: row.creatorId,
      creatorName: row.creatorDisplayName || row.creatorName || 'Unknown',
      videoUrl: row.videoUrl,
      thumbnailUrl: row.thumbnailUrl,
      duration: row.duration,
      downloadCount: row.downloadCount,
      views: row.views,
      likes: row.likes,
      nsfwRating: row.nsfwRating,
      seriesId: row.seriesId,
      episodeNumber: row.episodeNumber,
      seriesTotalEpisodes: row.seriesTotalEpisodes,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      categoryIds: [], // filled in by route after batch category fetch
    })),
    nextCursor,
  };
}

/**
 * Batch fetch category IDs for multiple clips
 *
 * Returns Map<clipId, categoryId[]> for efficient merging.
 * Avoids N+1 queries by fetching all categories in one query.
 */
export async function getClipCategoryIds(db: DB, clipIds: string[]): Promise<Map<string, string[]>> {
  if (clipIds.length === 0) return new Map();

  const rows = await db
    .select({
      clipId: clipCategories.clipId,
      categoryId: clipCategories.categoryId,
    })
    .from(clipCategories)
    .where(inArray(clipCategories.clipId, clipIds));

  const map = new Map<string, string[]>();
  for (const row of rows) {
    const existing = map.get(row.clipId) || [];
    existing.push(row.categoryId);
    map.set(row.clipId, existing);
  }
  return map;
}

// ==================== Clip CRUD (Upload Pipeline) ====================

export interface CreateClipInput {
  creatorId: string;
  title: string;
  description?: string;
  duration: number;
  resolution: string;
  fileSize: number;
  nsfwRating: string;
  seriesId?: string;
  episodeNumber?: number;
}

/**
 * Create a new clip in 'processing' status. Returns the clip ID.
 * Also inserts category associations and increments series totalEpisodes if applicable.
 */
export async function createClip(
  db: DB,
  input: CreateClipInput,
  categoryIds: string[],
): Promise<string> {
  const clipId = crypto.randomUUID();
  const now = new Date();

  await db.insert(clips).values({
    id: clipId,
    creatorId: input.creatorId,
    title: input.title,
    description: input.description || null,
    duration: input.duration,
    resolution: input.resolution,
    fileSize: input.fileSize,
    nsfwRating: input.nsfwRating,
    status: 'processing',
    seriesId: input.seriesId || null,
    episodeNumber: input.episodeNumber || null,
    createdAt: now,
    updatedAt: now,
  });

  // Batch insert category associations
  if (categoryIds.length > 0) {
    await db.insert(clipCategories).values(
      categoryIds.map((categoryId) => ({ clipId, categoryId })),
    );
  }

  // Increment series totalEpisodes if this is a series episode
  if (input.seriesId) {
    await db
      .update(creatorSeries)
      .set({ totalEpisodes: sql`${creatorSeries.totalEpisodes} + 1`, updatedAt: now })
      .where(eq(creatorSeries.id, input.seriesId));
  }

  return clipId;
}

/**
 * Get a single clip by ID
 */
export async function getClipById(db: DB, clipId: string) {
  const result = await db
    .select({
      id: clips.id,
      creatorId: clips.creatorId,
      title: clips.title,
      videoUrl: clips.videoUrl,
      status: clips.status,
      seriesId: clips.seriesId,
      episodeNumber: clips.episodeNumber,
      nsfwRating: clips.nsfwRating,
      createdAt: clips.createdAt,
    })
    .from(clips)
    .where(eq(clips.id, clipId))
    .limit(1);

  return result[0] || null;
}

/**
 * Update clip status (processing → published/rejected)
 */
export async function updateClipStatus(
  db: DB,
  clipId: string,
  status: 'published' | 'rejected' | 'review',
  publishedAt?: Date,
) {
  await db
    .update(clips)
    .set({
      status,
      publishedAt: publishedAt || null,
      updatedAt: new Date(),
    })
    .where(eq(clips.id, clipId));
}

/**
 * Set the video URL on a clip after upload confirmation
 */
export async function updateClipVideoUrl(db: DB, clipId: string, videoUrl: string) {
  await db
    .update(clips)
    .set({ videoUrl, updatedAt: new Date() })
    .where(eq(clips.id, clipId));
}

/**
 * Verify a series exists and belongs to the given creator
 */
export async function verifySeriesOwnership(
  db: DB,
  seriesId: string,
  creatorId: string,
): Promise<boolean> {
  const result = await db
    .select({ id: creatorSeries.id })
    .from(creatorSeries)
    .where(and(eq(creatorSeries.id, seriesId), eq(creatorSeries.creatorId, creatorId)))
    .limit(1);

  return result.length > 0;
}

// ==================== Creator Clips (Upload Status Tracking) ====================

/**
 * Get all clips belonging to a creator, ordered by newest first.
 */
export async function getCreatorClips(db: DB, creatorId: string) {
  const results = await db
    .select({
      id: clips.id,
      title: clips.title,
      status: clips.status,
      thumbnailUrl: clips.thumbnailUrl,
      videoUrl: clips.videoUrl,
      duration: clips.duration,
      views: clips.views,
      downloadCount: clips.downloadCount,
      nsfwRating: clips.nsfwRating,
      seriesId: clips.seriesId,
      episodeNumber: clips.episodeNumber,
      publishedAt: clips.publishedAt,
      createdAt: clips.createdAt,
    })
    .from(clips)
    .where(eq(clips.creatorId, creatorId))
    .orderBy(desc(clips.createdAt))
    .limit(100);

  return results;
}

/**
 * Batch fetch the latest moderation log reason for multiple clips.
 * Returns Map<clipId, { action, reason }> for efficient merging.
 */
export async function getClipModerationLogs(
  db: DB,
  clipIds: string[],
): Promise<Map<string, { action: string; reason: string }>> {
  if (clipIds.length === 0) return new Map();

  const rows = await db
    .select({
      clipId: moderationLogs.clipId,
      action: moderationLogs.action,
      reason: moderationLogs.reason,
    })
    .from(moderationLogs)
    .where(inArray(moderationLogs.clipId, clipIds))
    .orderBy(desc(moderationLogs.createdAt));

  // Keep only the latest log per clip
  const map = new Map<string, { action: string; reason: string }>();
  for (const row of rows) {
    if (!map.has(row.clipId)) {
      map.set(row.clipId, { action: row.action, reason: row.reason });
    }
  }
  return map;
}
