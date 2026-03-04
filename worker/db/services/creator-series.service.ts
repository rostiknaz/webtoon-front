/**
 * Creator Series Service
 *
 * CRUD operations for the creatorSeries table.
 * Handles slug generation with uniqueness, ownership verification reused from clips.service.ts.
 */

import { eq, desc, like } from 'drizzle-orm';
import { creatorSeries, clips } from '../../../db/schema';
import type { DB } from '../index';

// ==================== Types ====================

export interface CreateSeriesInput {
  creatorId: string;
  title: string;
  description?: string;
  genre?: string;
  nsfwRating: string;
  status?: string;
}

export interface UpdateSeriesInput {
  title?: string;
  description?: string;
  genre?: string;
  nsfwRating?: string;
  status?: string;
  coverUrl?: string;
}

export interface SeriesListItem {
  _id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  genre: string | null;
  status: string;
  nsfwRating: string;
  totalEpisodes: number;
  createdAt: string;
  updatedAt: string;
}

export interface SeriesDetail extends SeriesListItem {
  episodes: SeriesEpisode[];
}

export interface SeriesEpisode {
  _id: string;
  title: string;
  status: string;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  duration: number | null;
  views: number;
  episodeNumber: number | null;
  publishedAt: string | null;
  createdAt: string;
}

// ==================== Helpers ====================

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function toIso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

// ==================== Service Functions ====================

/**
 * Create a new series with a unique slug derived from the title.
 * If the slug already exists, appends -2, -3, etc.
 * Retries once on unique constraint violation (race condition safety).
 */
export async function createSeries(db: DB, input: CreateSeriesInput): Promise<{ id: string; slug: string }> {
  const baseSlug = slugify(input.title);

  async function attempt(): Promise<{ id: string; slug: string }> {
    let slug = baseSlug;

    // Check for slug collisions
    const existing = await db
      .select({ slug: creatorSeries.slug })
      .from(creatorSeries)
      .where(like(creatorSeries.slug, `${baseSlug}%`));

    if (existing.length > 0) {
      const taken = new Set(existing.map((r) => r.slug));
      if (taken.has(slug)) {
        let suffix = 2;
        while (taken.has(`${baseSlug}-${suffix}`)) suffix++;
        slug = `${baseSlug}-${suffix}`;
      }
    }

    const id = crypto.randomUUID();
    const now = new Date();

    await db.insert(creatorSeries).values({
      id,
      creatorId: input.creatorId,
      slug,
      title: input.title,
      description: input.description || null,
      genre: input.genre || null,
      status: input.status || 'ongoing',
      nsfwRating: input.nsfwRating,
      createdAt: now,
      updatedAt: now,
    });

    return { id, slug };
  }

  try {
    return await attempt();
  } catch (err: unknown) {
    // Retry once on unique constraint violation (slug race condition)
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      return await attempt();
    }
    throw err;
  }
}

/**
 * Get all series for a creator, ordered by newest first.
 */
export async function getCreatorSeries(db: DB, creatorId: string): Promise<SeriesListItem[]> {
  const results = await db
    .select({
      id: creatorSeries.id,
      slug: creatorSeries.slug,
      title: creatorSeries.title,
      description: creatorSeries.description,
      coverUrl: creatorSeries.coverUrl,
      genre: creatorSeries.genre,
      status: creatorSeries.status,
      nsfwRating: creatorSeries.nsfwRating,
      totalEpisodes: creatorSeries.totalEpisodes,
      createdAt: creatorSeries.createdAt,
      updatedAt: creatorSeries.updatedAt,
    })
    .from(creatorSeries)
    .where(eq(creatorSeries.creatorId, creatorId))
    .orderBy(desc(creatorSeries.createdAt));

  return results.map((r) => ({
    _id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    coverUrl: r.coverUrl,
    genre: r.genre,
    status: r.status,
    nsfwRating: r.nsfwRating,
    totalEpisodes: r.totalEpisodes,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/**
 * Get series detail with its episodes (clips ordered by episodeNumber).
 */
export async function getSeriesDetail(db: DB, seriesId: string): Promise<SeriesDetail | null> {
  const seriesResult = await db
    .select({
      id: creatorSeries.id,
      slug: creatorSeries.slug,
      title: creatorSeries.title,
      description: creatorSeries.description,
      coverUrl: creatorSeries.coverUrl,
      genre: creatorSeries.genre,
      status: creatorSeries.status,
      nsfwRating: creatorSeries.nsfwRating,
      totalEpisodes: creatorSeries.totalEpisodes,
      createdAt: creatorSeries.createdAt,
      updatedAt: creatorSeries.updatedAt,
    })
    .from(creatorSeries)
    .where(eq(creatorSeries.id, seriesId))
    .limit(1);

  if (seriesResult.length === 0) return null;

  const series = seriesResult[0];

  const episodeResults = await db
    .select({
      id: clips.id,
      title: clips.title,
      status: clips.status,
      thumbnailUrl: clips.thumbnailUrl,
      videoUrl: clips.videoUrl,
      duration: clips.duration,
      views: clips.views,
      episodeNumber: clips.episodeNumber,
      publishedAt: clips.publishedAt,
      createdAt: clips.createdAt,
    })
    .from(clips)
    .where(eq(clips.seriesId, seriesId))
    .orderBy(clips.episodeNumber);

  return {
    _id: series.id,
    slug: series.slug,
    title: series.title,
    description: series.description,
    coverUrl: series.coverUrl,
    genre: series.genre,
    status: series.status,
    nsfwRating: series.nsfwRating,
    totalEpisodes: series.totalEpisodes,
    createdAt: series.createdAt.toISOString(),
    updatedAt: series.updatedAt.toISOString(),
    episodes: episodeResults.map((ep) => ({
      _id: ep.id,
      title: ep.title,
      status: ep.status,
      thumbnailUrl: ep.thumbnailUrl,
      videoUrl: ep.videoUrl,
      duration: ep.duration,
      views: ep.views,
      episodeNumber: ep.episodeNumber,
      publishedAt: toIso(ep.publishedAt),
      createdAt: ep.createdAt.toISOString(),
    })),
  };
}

/**
 * Partial update of series metadata.
 */
export async function updateSeries(db: DB, seriesId: string, input: UpdateSeriesInput): Promise<void> {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.genre !== undefined) updates.genre = input.genre;
  if (input.nsfwRating !== undefined) updates.nsfwRating = input.nsfwRating;
  if (input.status !== undefined) updates.status = input.status;
  if (input.coverUrl !== undefined) updates.coverUrl = input.coverUrl;

  await db
    .update(creatorSeries)
    .set(updates)
    .where(eq(creatorSeries.id, seriesId));
}

/**
 * Delete a series. Clips retain but seriesId set to null via FK cascade.
 */
export async function deleteSeries(db: DB, seriesId: string): Promise<void> {
  await db
    .delete(creatorSeries)
    .where(eq(creatorSeries.id, seriesId));
}
