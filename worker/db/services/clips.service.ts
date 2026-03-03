/**
 * Clips Service
 *
 * Feed queries with cursor pagination, category batch loading
 */

import { eq, and, lt, desc, inArray } from 'drizzle-orm';
import { clips, users, creatorSeries, clipCategories } from '../../../db/schema';
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
}

export interface FeedResult {
  clips: ClipFeedItem[];
  nextCursor: string | null;
}

/**
 * Get feed clips with cursor-based pagination
 *
 * Uses "limit + 1" pattern to determine if there's a next page.
 * Joins users for creatorName, creatorSeries for seriesTotalEpisodes.
 */
export async function getFeedClips(db: DB, options: FeedQueryOptions): Promise<FeedResult> {
  const { cursor, limit = 20, category, nsfw = 'safe' } = options;

  // Build WHERE conditions
  const conditions: ReturnType<typeof eq>[] = [eq(clips.status, 'published')];

  if (nsfw === 'safe') {
    conditions.push(eq(clips.nsfwRating, 'safe'));
  }

  if (cursor) {
    conditions.push(lt(clips.publishedAt, new Date(cursor)));
  }

  // Category filter uses INNER JOIN on clipCategories
  if (category) {
    const results = await db
      .select({
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
      })
      .from(clips)
      .innerJoin(clipCategories, eq(clips.id, clipCategories.clipId))
      .leftJoin(users, eq(clips.creatorId, users.id))
      .leftJoin(creatorSeries, eq(clips.seriesId, creatorSeries.id))
      .where(and(...conditions, eq(clipCategories.categoryId, category)))
      .orderBy(desc(clips.publishedAt))
      .limit(limit + 1);

    return buildFeedResult(results, limit);
  }

  // No category filter
  const results = await db
    .select({
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
    })
    .from(clips)
    .leftJoin(users, eq(clips.creatorId, users.id))
    .leftJoin(creatorSeries, eq(clips.seriesId, creatorSeries.id))
    .where(and(...conditions))
    .orderBy(desc(clips.publishedAt))
    .limit(limit + 1);

  return buildFeedResult(results, limit);
}

/**
 * Build FeedResult from raw query results using limit+1 pattern
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
): FeedResult {
  const hasMore = results.length > limit;
  const items = hasMore ? results.slice(0, limit) : results;

  const nextCursor = hasMore && items.length > 0 && items[items.length - 1].publishedAt
    ? items[items.length - 1].publishedAt!.toISOString()
    : null;

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
