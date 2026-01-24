/**
 * Series & Episodes Service
 *
 * Type-safe queries for series/episodes data
 */

import { eq, sql } from 'drizzle-orm';
import { series, episodes } from '../../../db/schema';
import type { DB } from '../index';

/**
 * Series data with core metadata
 */
export interface SeriesCore {
  id: string;
  slug: string; // URL-safe identifier for R2 video paths
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
  duration: number | null;
  isPaid: boolean;
  publishedAt: number | null;
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
      slug: series.slug,
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
 * Get series by slug with core metadata
 *
 * @param db - Drizzle database instance
 * @param seriesSlug - URL-safe series slug (e.g., "midnight-confessions")
 * @returns Series metadata or null if not found
 */
export async function getSeriesBySlug(db: DB, seriesSlug: string): Promise<SeriesCore | null> {
  const result = await db
    .select({
      id: series.id,
      slug: series.slug,
      title: series.title,
      description: series.description,
      thumbnailUrl: series.thumbnailUrl,
      genre: series.genre,
      author: series.author,
      status: series.status,
      createdAt: series.createdAt,
    })
    .from(series)
    .where(eq(series.slug, seriesSlug))
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
 * Get series statistics (views, likes) by ID
 *
 * @param db - Drizzle database instance
 * @param seriesId - Series UUID
 * @returns Series statistics with episode breakdown
 */
export async function getSeriesStats(db: DB, seriesId: string) {
  const [seriesData, episodesData] = await Promise.all([
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
  ]);

  // Calculate total likes from episode counters (anonymous likes)
  const totalLikes = episodesData.reduce((sum, ep) => sum + (ep.likes ?? 0), 0);

  return {
    totalViews: seriesData[0]?.totalViews ?? 0,
    totalLikes,
    episodes: episodesData.map((ep) => ({
      id: ep.id,
      episodeNumber: ep.episodeNumber,
      views: ep.views ?? 0,
      likes: ep.likes ?? 0,
    })),
  };
}

/**
 * Get series statistics (views, likes) by slug
 *
 * Uses subquery to lookup series ID by slug in a single query batch.
 * Enables parallel fetching on frontend without needing series ID first.
 *
 * @param db - Drizzle database instance
 * @param seriesSlug - URL-safe series slug
 * @returns Series statistics with episode breakdown, or null if not found
 */
export async function getSeriesStatsBySlug(db: DB, seriesSlug: string) {
  // First get series ID and totalViews in one query (uses slug index)
  const seriesData = await db
    .select({
      id: series.id,
      totalViews: series.totalViews,
    })
    .from(series)
    .where(eq(series.slug, seriesSlug))
    .limit(1);

  if (!seriesData[0]) return null;

  const seriesId = seriesData[0].id;

  // Get per-episode stats using the series ID
  const episodesData = await db
    .select({
      id: episodes.id,
      episodeNumber: episodes.episodeNumber,
      views: episodes.views,
      likes: episodes.likes,
    })
    .from(episodes)
    .where(eq(episodes.serialId, seriesId))
    .orderBy(episodes.episodeNumber);

  // Calculate total likes from episode counters
  const totalLikes = episodesData.reduce((sum, ep) => sum + (ep.likes ?? 0), 0);

  return {
    totalViews: seriesData[0].totalViews ?? 0,
    totalLikes,
    episodes: episodesData.map((ep) => ({
      id: ep.id,
      episodeNumber: ep.episodeNumber,
      views: ep.views ?? 0,
      likes: ep.likes ?? 0,
    })),
  };
}

/**
 * Increment likes counter for an episode (anonymous)
 *
 * Uses RETURNING clause to get new value in single query (50% fewer DB operations)
 */
export async function incrementEpisodeLikes(db: DB, episodeId: string): Promise<number> {
  const result = await db
    .update(episodes)
    .set({ likes: sql`${episodes.likes} + 1` })
    .where(eq(episodes.id, episodeId))
    .returning({ likes: episodes.likes });

  return result[0]?.likes ?? 0;
}

/**
 * Decrement likes counter for an episode (anonymous)
 *
 * Uses RETURNING clause to get new value in single query (50% fewer DB operations)
 * Ensures likes never go below 0
 */
export async function decrementEpisodeLikes(db: DB, episodeId: string): Promise<number> {
  const result = await db
    .update(episodes)
    .set({ likes: sql`MAX(0, ${episodes.likes} - 1)` })
    .where(eq(episodes.id, episodeId))
    .returning({ likes: episodes.likes });

  return result[0]?.likes ?? 0;
}
