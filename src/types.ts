import { z } from "zod"

// ==================== Core Metadata Schemas ====================

const coreEpisodeSchema = z.object({
    _id: z.string(),
    episodeNumber: z.number().int().positive(),
    title: z.string().optional(),
    description: z.string().optional(),
    thumbnail: z.string().url().optional(),
    duration: z.number().optional(), // in seconds
    videoId: z.string().optional(), // Cloudflare Stream video ID
    releaseDate: z.string().optional(),
    isPaid: z.boolean(),
});

export const seriesCoreMetadataSchema = z.object({
    _id: z.string(),
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
    videoId: z.string().optional(),
    releaseDate: z.string().optional(),
    isPaid: z.boolean(),
    isLocked: z.boolean(),
    hlsUrl: z.string().url().optional(),
    views: z.number().optional(),
    likes: z.number().optional(),
});

// Combined series metadata (merged from all 3 endpoints)
export const seriesMetadataSchema = z.object({
    _id: z.string(),
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
    user: z.object({
        isAuthenticated: z.boolean(),
        hasSubscription: z.boolean(),
    }).optional(),
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

export const subscriptionStatusResponseSchema = z.object({
    hasSubscription: z.boolean(),
    subscription: z.object({
        planId: z.string(),
        planName: z.string(),
        status: z.string(),
        currentPeriodStart: z.string(),
        currentPeriodEnd: z.string(),
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