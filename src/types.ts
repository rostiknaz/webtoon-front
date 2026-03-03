import { z } from "zod"

// ==================== Core Metadata Schemas ====================

const coreEpisodeSchema = z.object({
    _id: z.string(),
    episodeNumber: z.number().int().positive(),
    title: z.string().optional(),
    description: z.string().optional(),
    thumbnail: z.string().url().optional(),
    duration: z.number().optional(), // in seconds
    releaseDate: z.string().optional(),
    isPaid: z.boolean(),
});

export const seriesCoreMetadataSchema = z.object({
    _id: z.string(),
    slug: z.string(), // URL-safe identifier for R2 video paths
    title: z.string().min(1),
    description: z.string().optional(),
    thumbnail: z.string().url().optional(),
    coverImage: z.string().url().optional(),
    year: z.number().optional(),
    status: z.enum(['ongoing', 'completed']).optional(),
    genres: z.array(z.string()).optional(),
    cast: z.array(z.string()).optional(),
    director: z.string().optional(),
    episodes: z.array(coreEpisodeSchema),
});

// ==================== Access Schemas ====================

const episodeAccessSchema = z.object({
    _id: z.string(),
    episodeNumber: z.number().int().positive(),
    isLocked: z.boolean(),
    hlsUrl: z.string().url().optional(), // only if unlocked
});

export const seriesAccessSchema = z.object({
    user: z.object({
        isAuthenticated: z.boolean(),
        hasSubscription: z.boolean(),
    }),
    episodes: z.array(episodeAccessSchema),
});

// ==================== Stats Schemas ====================

const episodeStatsSchema = z.object({
    _id: z.string(),
    episodeNumber: z.number().int().positive(),
    views: z.number(),
    likes: z.number(),
});

export const seriesStatsSchema = z.object({
    totalViews: z.number(),
    totalLikes: z.number(),
    episodes: z.array(episodeStatsSchema),
});

// ==================== Combined Schemas (for frontend use) ====================

// Combined episode with all data merged
export const episodeSchema = z.object({
    _id: z.string(),
    episodeNumber: z.number().int().positive(),
    title: z.string().optional(),
    description: z.string().optional(),
    thumbnail: z.string().url().optional(),
    duration: z.number().optional(),
    releaseDate: z.string().optional(),
    isPaid: z.boolean(),
    isLocked: z.boolean(),
    hlsUrl: z.string().url().optional(),
    views: z.number().optional(),
    likes: z.number().optional(),
});

// Combined series metadata (merged from core data and stats)
// Note: isLocked and hlsUrl are computed on the client based on subscription status
export const seriesMetadataSchema = z.object({
    _id: z.string(),
    slug: z.string(), // URL-safe identifier for R2 video paths
    title: z.string().min(1),
    description: z.string().optional(),
    thumbnail: z.string().url().optional(),
    coverImage: z.string().url().optional(),
    rating: z.number().min(0).max(10).optional(),
    totalViews: z.number().optional(),
    totalLikes: z.number().optional(),
    year: z.number().optional(),
    status: z.enum(['ongoing', 'completed']).optional(),
    genres: z.array(z.string()).optional(),
    cast: z.array(z.string()).optional(),
    director: z.string().optional(),
    episodes: z.array(episodeSchema),
});

// ==================== Type Exports ====================

export type SeriesCoreMetadata = z.infer<typeof seriesCoreMetadataSchema>;
export type CoreEpisode = z.infer<typeof coreEpisodeSchema>;

export type SeriesAccess = z.infer<typeof seriesAccessSchema>;
export type EpisodeAccess = z.infer<typeof episodeAccessSchema>;

export type SeriesStats = z.infer<typeof seriesStatsSchema>;
export type EpisodeStats = z.infer<typeof episodeStatsSchema>;

export type SeriesMetadata = z.infer<typeof seriesMetadataSchema>;
export type Episode = z.infer<typeof episodeSchema>;

// ==================== Subscription Schemas ====================

export const planFeaturesSchema = z.object({
    episodeAccess: z.string(),
    adFree: z.boolean(),
    downloadable: z.boolean(),
    earlyAccess: z.boolean(),
});

export const planSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    price: z.number(),
    currency: z.string(),
    billingPeriod: z.string(),
    trialDays: z.number(),
    features: planFeaturesSchema,
});

export const subscriptionPlansResponseSchema = z.object({
    plans: z.array(planSchema),
});

export const subscriptionCheckResponseSchema = z.object({
    hasSubscription: z.boolean(),
});

/**
 * Subscription status response from GET /api/subscription/status
 * Used by hybrid cookie/API subscription checking
 */
export const subscriptionStatusResponseSchema = z.object({
    hasSubscription: z.boolean(),
    subscription: z.object({
        status: z.string(),
        planId: z.string(),
        currentPeriodEnd: z.number(), // Unix timestamp (seconds)
        planFeatures: planFeaturesSchema,
    }).optional(),
});

export const subscribeResponseSchema = z.object({
    success: z.boolean(),
});

// ==================== Type Exports ====================

export type PlanFeatures = z.infer<typeof planFeaturesSchema>;
export type Plan = z.infer<typeof planSchema>;
export type SubscriptionPlansResponse = z.infer<typeof subscriptionPlansResponseSchema>;
export type SubscriptionCheckResponse = z.infer<typeof subscriptionCheckResponseSchema>;
export type SubscriptionStatusResponse = z.infer<typeof subscriptionStatusResponseSchema>;
export type SubscribeResponse = z.infer<typeof subscribeResponseSchema>;

export class SerialNotFoundError extends Error {}

// ==================== Feed Schemas ====================

export const feedClipSchema = z.object({
    _id: z.string(),
    title: z.string(),
    creatorId: z.string(),
    creatorName: z.string(),
    videoUrl: z.string().nullable(),
    thumbnailUrl: z.string().nullable(),
    duration: z.number().nullable(),
    downloadCount: z.number(),
    views: z.number(),
    likes: z.number(),
    nsfwRating: z.string(),
    seriesId: z.string().nullable(),
    episodeNumber: z.number().nullable(),
    seriesTotalEpisodes: z.number().nullable(),
    publishedAt: z.string().nullable(),
    categoryIds: z.array(z.string()),
});

export const feedResponseSchema = z.object({
    clips: z.array(feedClipSchema),
    nextCursor: z.string().nullable(),
});

export type FeedClip = z.infer<typeof feedClipSchema>;
export type FeedResponse = z.infer<typeof feedResponseSchema>;

// ==================== Category Schemas ====================

export const categoryItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    sortOrder: z.number(),
});

export const categoriesResponseSchema = z.object({
    categories: z.array(categoryItemSchema),
});

export type CategoryItem = z.infer<typeof categoryItemSchema>;
export type CategoriesResponse = z.infer<typeof categoriesResponseSchema>;

// ==================== Creator Clips Schemas ====================

export const creatorClipSchema = z.object({
    _id: z.string(),
    title: z.string(),
    status: z.enum(['processing', 'published', 'rejected', 'review']),
    thumbnailUrl: z.string().nullable(),
    videoUrl: z.string().nullable(),
    duration: z.number().nullable(),
    views: z.number(),
    downloadCount: z.number(),
    nsfwRating: z.string(),
    seriesId: z.string().nullable(),
    episodeNumber: z.number().nullable(),
    moderationReason: z.string().nullable(),
    moderationAction: z.string().nullable(),
    publishedAt: z.string().nullable(),
    createdAt: z.string(),
});

export const creatorClipsResponseSchema = z.object({
    clips: z.array(creatorClipSchema),
});

export type CreatorClip = z.infer<typeof creatorClipSchema>;
export type CreatorClipsResponse = z.infer<typeof creatorClipsResponseSchema>;