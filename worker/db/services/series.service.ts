/**
 * Series & Episodes Service
 *
 * Type-safe queries for series/episodes data
 */

import { eq, sql } from 'drizzle-orm';
import { series, episodes, userLikes } from '../../../db/schema';
import type { DB } from '../index';

/**
 * Series data with core metadata
 */
export interface SeriesCore {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  genre: string | null;
  author: string | null;
  status: string;
  createdAt: number;
}

/**
 * Episode data with full details
 */
export interface EpisodeData {
  id: string;
  episodeNumber: number;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  videoId: string | null;
  duration: number | null;
  isPaid: boolean;
  publishedAt: number | null;
}

/**
 * Episode data for access checking
 */
export interface EpisodeAccess {
  id: string;
  episodeNumber: number;
  videoId: string | null;
  isPaid: boolean;
}

/**
 * Episode statistics
 */
export interface EpisodeStats {
  id: string;
  episodeNumber: number;
  views: number;
  likes: number;
}

/**
 * Get series by ID with core metadata
 *
 * @param db - Drizzle database instance
 * @param seriesId - Series UUID
 * @returns Series metadata or null if not found
 */
export async function getSeriesById(db: DB, seriesId: string): Promise<SeriesCore | null> {
  const result = await db
    .select({
      id: series.id,
      title: series.title,
      description: series.description,
      thumbnailUrl: series.thumbnailUrl,
      genre: series.genre,
      author: series.author,
      status: series.status,
      createdAt: series.createdAt,
    })
    .from(series)
    .where(eq(series.id, seriesId))
    .limit(1);

  if (!result[0]) return null;

  return {
    ...result[0],
    createdAt: Math.floor(result[0].createdAt.getTime() / 1000),
  };
}

/**
 * Get all episodes for a series
 *
 * @param db - Drizzle database instance
 * @param seriesId - Series UUID
 * @returns Array of episodes ordered by episode number
 */
export async function getSeriesEpisodes(db: DB, seriesId: string): Promise<EpisodeData[]> {
  const results = await db
    .select({
      id: episodes.id,
      episodeNumber: episodes.episodeNumber,
      title: episodes.title,
      description: episodes.description,
      thumbnailUrl: episodes.thumbnailUrl,
      videoId: episodes.videoId,
      duration: episodes.duration,
      isPaid: episodes.isPaid,
      publishedAt: episodes.publishedAt,
    })
    .from(episodes)
    .where(eq(episodes.serialId, seriesId))
    .orderBy(episodes.episodeNumber);

  return results.map((ep) => ({
    ...ep,
    title: ep.title || 'Untitled',
    publishedAt: ep.publishedAt ? Math.floor(ep.publishedAt.getTime() / 1000) : null,
  }));
}

/**
 * Get episodes with access info (for access endpoint)
 *
 * @param db - Drizzle database instance
 * @param seriesId - Series UUID
 * @returns Array of episodes with minimal access data
 */
export async function getEpisodesForAccess(
  db: DB,
  seriesId: string
): Promise<EpisodeAccess[]> {
  return await db
    .select({
      id: episodes.id,
      episodeNumber: episodes.episodeNumber,
      videoId: episodes.videoId,
      isPaid: episodes.isPaid,
    })
    .from(episodes)
    .where(eq(episodes.serialId, seriesId))
    .orderBy(episodes.episodeNumber);
}

/**
 * Get series statistics (views, likes)
 *
 * @param db - Drizzle database instance
 * @param seriesId - Series UUID
 * @returns Series statistics with episode breakdown
 */
export async function getSeriesStats(db: DB, seriesId: string) {
  const [seriesData, episodesData, likesData] = await Promise.all([
    // Get series total views
    db
      .select({ totalViews: series.totalViews })
      .from(series)
      .where(eq(series.id, seriesId))
      .limit(1),

    // Get per-episode stats
    db
      .select({
        id: episodes.id,
        episodeNumber: episodes.episodeNumber,
        views: episodes.views,
        likes: episodes.likes,
      })
      .from(episodes)
      .where(eq(episodes.serialId, seriesId))
      .orderBy(episodes.episodeNumber),

    // Get total user likes (from user_likes table)
    db
      .select({ count: sql<number>`COUNT(*)`.as('total_likes') })
      .from(userLikes)
      .innerJoin(episodes, eq(userLikes.episodeId, episodes.id))
      .where(eq(episodes.serialId, seriesId)),
  ]);

  return {
    totalViews: seriesData[0]?.totalViews ?? 0,
    totalLikes: likesData[0]?.count ?? 0,
    episodes: episodesData.map((ep) => ({
      id: ep.id,
      episodeNumber: ep.episodeNumber,
      views: ep.views ?? 0,
      likes: ep.likes ?? 0,
    })),
  };
}
