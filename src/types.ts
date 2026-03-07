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
    paymentUrl: z.string(),
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

// ==================== Credits Schemas ====================

export const creditsBalanceResponseSchema = z.object({
    balance: z.number(),
    freeDownloads: z.number(),
});

export type CreditsBalanceResponse = z.infer<typeof creditsBalanceResponseSchema>;

// ==================== Download Schemas ====================

export const downloadClipResponseSchema = z.object({
    downloadUrl: z.string(),
    creditsRemaining: z.number(),
    freeDownloadsRemaining: z.number(),
    alreadyDownloaded: z.boolean(),
    creditCost: z.number(),
});

export type DownloadClipResponse = z.infer<typeof downloadClipResponseSchema>;

// ==================== Download History Schemas ====================

export const downloadHistoryItemSchema = z.object({
    clipId: z.string(),
    title: z.string(),
    creatorName: z.string(),
    thumbnailUrl: z.string().nullable(),
    downloadDate: z.string(),
    creditCost: z.number(),
});

export const downloadHistoryResponseSchema = z.object({
    downloads: z.array(downloadHistoryItemSchema),
    nextCursor: z.string().nullable(),
});

export type DownloadHistoryItem = z.infer<typeof downloadHistoryItemSchema>;
export type DownloadHistoryResponse = z.infer<typeof downloadHistoryResponseSchema>;

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

// ==================== Creator Series Schemas ====================

export const creatorSeriesItemSchema = z.object({
    _id: z.string(),
    slug: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    coverUrl: z.string().nullable(),
    genre: z.string().nullable(),
    status: z.string(),
    nsfwRating: z.string(),
    totalEpisodes: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export const seriesEpisodeSchema = z.object({
    _id: z.string(),
    title: z.string(),
    status: z.string(),
    thumbnailUrl: z.string().nullable(),
    videoUrl: z.string().nullable(),
    duration: z.number().nullable(),
    views: z.number(),
    episodeNumber: z.number().nullable(),
    publishedAt: z.string().nullable(),
    createdAt: z.string(),
});

export const creatorSeriesListResponseSchema = z.object({
    series: z.array(creatorSeriesItemSchema),
});

export const creatorSeriesDetailResponseSchema = creatorSeriesItemSchema.extend({
    episodes: z.array(seriesEpisodeSchema),
});

export const creatorSeriesCreateResponseSchema = z.object({
    _id: z.string(),
    slug: z.string(),
});

export type CreatorSeriesItem = z.infer<typeof creatorSeriesItemSchema>;
export type SeriesEpisodeItem = z.infer<typeof seriesEpisodeSchema>;
export type CreatorSeriesListResponse = z.infer<typeof creatorSeriesListResponseSchema>;
export type CreatorSeriesDetailResponse = z.infer<typeof creatorSeriesDetailResponseSchema>;
export type CreatorSeriesCreateResponse = z.infer<typeof creatorSeriesCreateResponseSchema>;

// ==================== Creator Stats Schemas ====================

export const creatorStatsResponseSchema = z.object({
    totalUploads: z.number(),
    totalViews: z.number(),
    totalDownloads: z.number(),
    monthlyEarnings: z.number(),
    lifetimeEarnings: z.number(),
    revenueSharePercent: z.number(),
    isFoundingCreator: z.boolean(),
});

export type CreatorStatsResponse = z.infer<typeof creatorStatsResponseSchema>;

// ==================== Creator Earnings Schemas ====================

export const creatorEarningsEntrySchema = z.object({
    month: z.string(),
    totalDownloads: z.number(),
    earningsAmount: z.number(),
    revenueShare: z.number(),
    status: z.string(),
    paidAt: z.string().nullable(),
});

export const creatorEarningsResponseSchema = z.object({
    earnings: z.array(creatorEarningsEntrySchema),
});

export type CreatorEarningsEntry = z.infer<typeof creatorEarningsEntrySchema>;
export type CreatorEarningsResponse = z.infer<typeof creatorEarningsResponseSchema>;

// ==================== Upload Schemas ====================

export const uploadInitResponseSchema = z.object({
    _id: z.string(),
    presignedUrl: z.string().url(),
    expiresIn: z.number(),
});

export const uploadCompleteResponseSchema = z.object({
    _id: z.string(),
    status: z.enum(['processing', 'published', 'rejected', 'review']),
    reason: z.string().nullable(),
});

export const uploadRetryResponseSchema = z.object({
    _id: z.string(),
    presignedUrl: z.string().url(),
    expiresIn: z.number(),
});

export type UploadInitResponse = z.infer<typeof uploadInitResponseSchema>;
export type UploadCompleteResponse = z.infer<typeof uploadCompleteResponseSchema>;
export type UploadRetryResponse = z.infer<typeof uploadRetryResponseSchema>;

export interface UploadInitInput {
    title: string;
    categoryIds: string[];
    aiToolUsed: string;
    nsfwRating: 'safe' | 'suggestive' | 'explicit';
    fileSize: number;
    duration: number;
    resolution: string;
    seriesId?: string;
    episodeNumber?: number;
}
