// src/api.ts
import {
    seriesCoreMetadataSchema,
    seriesStatsSchema,
    seriesMetadataSchema,
    subscriptionPlansResponseSchema,
    subscriptionCheckResponseSchema,
    subscriptionStatusResponseSchema,
    subscribeResponseSchema,
    feedResponseSchema,
    categoriesResponseSchema,
    creatorClipsResponseSchema,
    creatorSeriesListResponseSchema,
    creatorSeriesDetailResponseSchema,
    creatorSeriesCreateResponseSchema,
    creditsBalanceResponseSchema,
    downloadClipResponseSchema,
    type DownloadClipResponse,
    SerialNotFoundError,
    type SeriesMetadata,
    type SubscriptionPlansResponse,
    type SubscriptionCheckResponse,
    type SubscriptionStatusResponse,
    type SubscribeResponse,
    type FeedResponse,
    type CategoriesResponse,
    type CreatorClipsResponse,
    type CreatorSeriesListResponse,
    type CreatorSeriesDetailResponse,
    type CreatorSeriesCreateResponse,
} from './types';

// ==================== Fetch Helper ====================

interface FetchOptions extends RequestInit {
    /** Custom error message prefix */
    errorMessage?: string;
    /** Whether to throw SerialNotFoundError on 404 */
    throw404AsNotFound?: boolean;
}

/**
 * Reusable fetch wrapper with error handling and JSON parsing
 */
async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
    const { errorMessage = 'Request failed', throw404AsNotFound = false, ...fetchOptions } = options;

    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...fetchOptions,
    });

    if (!response.ok) {
        if (response.status === 404 && throw404AsNotFound) {
            throw new SerialNotFoundError(`Not found: ${url}`);
        }

        // Try to extract error message from response body
        // Server returns { error: { code, message } } format
        const errorData = await response.json().catch(() => ({}));
        const errorObj = (errorData as { error?: { message?: string } | string }).error;
        const message = typeof errorObj === 'object'
            ? errorObj?.message ?? response.statusText
            : errorObj ?? response.statusText;
        throw new Error(`${errorMessage}: ${message}`);
    }

    return response.json();
}

// ==================== Series API ====================

/**
 * Fetch series core metadata by slug (long cache - 24 hours)
 * Static data: title, description, episodes list, etc.
 */
export const getSeriesCoreMetadataBySlug = async (slug: string) => {
    const data = await fetchJson(`/api/series/by-slug/${slug}`, {
        errorMessage: 'Failed to fetch series',
        throw404AsNotFound: true,
    });
    return seriesCoreMetadataSchema.parse(data);
};

/**
 * Fetch series core metadata by ID (long cache - 24 hours)
 * @deprecated Use getSeriesCoreMetadataBySlug for cleaner URLs
 */
export const getSeriesCoreMetadata = async (seriesId: string) => {
    const data = await fetchJson(`/api/series/${seriesId}`, {
        errorMessage: 'Failed to fetch series',
        throw404AsNotFound: true,
    });
    return seriesCoreMetadataSchema.parse(data);
};

/**
 * Fetch series statistics by ID (short cache - 1 minute)
 * Dynamic data: views, likes
 * @deprecated Use getSeriesStatsBySlug for slug-based routes
 */
export const getSeriesStats = async (seriesId: string) => {
    const data = await fetchJson(`/api/series/${seriesId}/stats`, {
        errorMessage: 'Failed to fetch series stats',
        throw404AsNotFound: true,
    });
    return seriesStatsSchema.parse(data);
};

/**
 * Fetch series statistics by slug (short cache - 1 minute)
 * Dynamic data: views, likes
 * Enables parallel fetching with core metadata (no ID dependency)
 */
export const getSeriesStatsBySlug = async (slug: string) => {
    const data = await fetchJson(`/api/series/by-slug/${slug}/stats`, {
        errorMessage: 'Failed to fetch series stats',
        throw404AsNotFound: true,
    });
    return seriesStatsSchema.parse(data);
};

/**
 * Merge core metadata with stats into a complete SeriesMetadata object.
 * isLocked and hlsUrl are computed client-side based on subscription status.
 */
function mergeSeriesData(
    coreData: Awaited<ReturnType<typeof getSeriesCoreMetadataBySlug>>,
    statsData: Awaited<ReturnType<typeof getSeriesStatsBySlug>>,
): SeriesMetadata {
    const statsMap = new Map(statsData.episodes.map(s => [s._id, s]));

    return seriesMetadataSchema.parse({
        ...coreData,
        totalViews: statsData.totalViews,
        totalLikes: statsData.totalLikes,
        episodes: coreData.episodes
            .map((ep) => ({
                ...ep,
                isLocked: ep.isPaid,
                hlsUrl: undefined,
                views: statsMap.get(ep._id)?.views ?? 0,
                likes: statsMap.get(ep._id)?.likes ?? 0,
            }))
            .sort((a, b) => a.episodeNumber - b.episodeNumber),
    });
}

/**
 * Fetch complete series metadata by slug
 *
 * Uses Promise.all to fetch core data and stats in parallel.
 */
export const getSeriesMetadataBySlug = async (slug: string): Promise<SeriesMetadata> => {
    const [coreData, statsData] = await Promise.all([
        getSeriesCoreMetadataBySlug(slug),
        getSeriesStatsBySlug(slug),
    ]);
    return mergeSeriesData(coreData, statsData);
};

/**
 * Fetch complete series metadata by ID
 * @deprecated Use getSeriesMetadataBySlug for cleaner URLs
 */
export const getSeriesMetadata = async (seriesId: string): Promise<SeriesMetadata> => {
    const [coreData, statsData] = await Promise.all([
        getSeriesCoreMetadata(seriesId),
        getSeriesStats(seriesId),
    ]);
    return mergeSeriesData(coreData, statsData);
};

// ==================== Subscription API ====================

/**
 * Fetch available subscription plans
 */
export const getSubscriptionPlans = async (): Promise<SubscriptionPlansResponse> => {
    const data = await fetchJson('/api/subscription/plans', {
        errorMessage: 'Failed to fetch subscription plans',
    });
    return subscriptionPlansResponseSchema.parse(data);
};

/**
 * Check if user has an active subscription (simple boolean check)
 */
export const checkSubscription = async (): Promise<SubscriptionCheckResponse> => {
    const data = await fetchJson('/api/subscription/check', {
        credentials: 'include',
        errorMessage: 'Failed to check subscription',
    });
    return subscriptionCheckResponseSchema.parse(data);
};

/**
 * Get full subscription status with details (cache-first on server)
 * Used by hybrid cookie/API subscription checking
 */
export const getSubscriptionStatus = async (): Promise<SubscriptionStatusResponse> => {
    const data = await fetchJson('/api/subscription/status', {
        credentials: 'include',
        errorMessage: 'Failed to get subscription status',
    });
    return subscriptionStatusResponseSchema.parse(data);
};

/**
 * Subscribe to a plan
 */
export const subscribeToPlan = async (planId: string): Promise<SubscribeResponse> => {
    const data = await fetchJson('/api/subscription/subscribe', {
        method: 'POST',
        body: JSON.stringify({ planId }),
        credentials: 'include',
        errorMessage: 'Failed to create subscription',
    });
    return subscribeResponseSchema.parse(data);
};

// ==================== Episode Likes API ====================

interface LikeResponse {
    likes: number;
    liked: boolean;
}

/**
 * Like an episode (anonymous, increments counter)
 */
export const likeEpisode = async (episodeId: string): Promise<LikeResponse> => {
    return fetchJson(`/api/episodes/${episodeId}/like`, {
        method: 'POST',
        errorMessage: 'Failed to like episode',
    });
};

/**
 * Unlike an episode (anonymous, decrements counter)
 */
export const unlikeEpisode = async (episodeId: string): Promise<LikeResponse> => {
    return fetchJson(`/api/episodes/${episodeId}/like`, {
        method: 'DELETE',
        errorMessage: 'Failed to unlike episode',
    });
};

// ==================== Feed API ====================

interface FeedParams {
    cursor?: string;
    limit?: number;
    category?: string;
    nsfw?: string;
    sort?: string;
    search?: string;
}

/**
 * Fetch paginated feed of published clips
 * Public endpoint — no auth required
 */
export const getFeed = async (params: FeedParams = {}): Promise<FeedResponse> => {
    const searchParams = new URLSearchParams();
    if (params.cursor) searchParams.set('cursor', params.cursor);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.category) searchParams.set('category', params.category);
    if (params.nsfw) searchParams.set('nsfw', params.nsfw);
    if (params.sort) searchParams.set('sort', params.sort);
    if (params.search) searchParams.set('search', params.search);

    const query = searchParams.toString();
    const url = `/api/feed${query ? `?${query}` : ''}`;

    const data = await fetchJson(url, {
        errorMessage: 'Failed to fetch feed',
    });
    return feedResponseSchema.parse(data);
};

// ==================== Categories API ====================

/**
 * Fetch all categories ordered by sortOrder
 * Public endpoint — no auth required, cached 24 hours
 */
export const getCategories = async (): Promise<CategoriesResponse> => {
    const data = await fetchJson('/api/categories', {
        errorMessage: 'Failed to fetch categories',
    });
    return categoriesResponseSchema.parse(data);
};

// ==================== Credits API ====================

/**
 * Fetch current user's credit balance (auth required)
 * Also refreshes the credit cookie server-side
 */
export const getCreditsBalance = async () => {
    const data = await fetchJson('/api/credits/balance', {
        credentials: 'include',
        errorMessage: 'Failed to fetch credits',
    });
    return creditsBalanceResponseSchema.parse(data);
};

// ==================== Download API ====================

/**
 * Fetch clip IDs the current user has downloaded
 */
export const getMyDownloadIds = async (): Promise<string[]> => {
    const data = await fetchJson<{ clipIds: string[] }>('/api/download/mine', {
        credentials: 'include',
        errorMessage: 'Failed to fetch downloads',
    });
    return data.clipIds;
};

/**
 * Download a clip (auth required, deducts credits)
 * Returns presigned R2 URL for direct download
 */
export const downloadClip = async (clipId: string): Promise<DownloadClipResponse> => {
    const data = await fetchJson(`/api/download/${clipId}`, {
        method: 'POST',
        credentials: 'include',
        errorMessage: 'Failed to download clip',
    });
    return downloadClipResponseSchema.parse(data);
};

// ==================== Creator Clips API ====================

/**
 * Fetch authenticated creator's clips with status and moderation reasons
 * Auth required — creator role
 */
export const getCreatorClips = async (): Promise<CreatorClipsResponse> => {
    const data = await fetchJson('/api/clips/mine', {
        credentials: 'include',
        errorMessage: 'Failed to fetch creator clips',
    });
    return creatorClipsResponseSchema.parse(data);
};

// ==================== Creator Series API ====================

export const getCreatorSeriesList = async (): Promise<CreatorSeriesListResponse> => {
    const data = await fetchJson('/api/creator-series', {
        credentials: 'include',
        errorMessage: 'Failed to fetch series list',
    });
    return creatorSeriesListResponseSchema.parse(data);
};

export const getCreatorSeriesDetail = async (seriesId: string): Promise<CreatorSeriesDetailResponse> => {
    const data = await fetchJson(`/api/creator-series/${seriesId}`, {
        credentials: 'include',
        errorMessage: 'Failed to fetch series detail',
    });
    return creatorSeriesDetailResponseSchema.parse(data);
};

interface CreateSeriesInput {
    title: string;
    description?: string;
    genre?: string;
    nsfwRating: string;
    status?: string;
}

export const createCreatorSeries = async (input: CreateSeriesInput): Promise<CreatorSeriesCreateResponse> => {
    const data = await fetchJson('/api/creator-series', {
        method: 'POST',
        body: JSON.stringify(input),
        credentials: 'include',
        errorMessage: 'Failed to create series',
    });
    return creatorSeriesCreateResponseSchema.parse(data);
};

interface UpdateSeriesInput {
    title?: string;
    description?: string;
    genre?: string;
    nsfwRating?: string;
    status?: string;
}

export const updateCreatorSeries = async (seriesId: string, input: UpdateSeriesInput): Promise<void> => {
    await fetchJson(`/api/creator-series/${seriesId}`, {
        method: 'PUT',
        body: JSON.stringify(input),
        credentials: 'include',
        errorMessage: 'Failed to update series',
    });
};

export const deleteCreatorSeries = async (seriesId: string): Promise<void> => {
    await fetchJson(`/api/creator-series/${seriesId}`, {
        method: 'DELETE',
        credentials: 'include',
        errorMessage: 'Failed to delete series',
    });
};

export const getSeriesCoverUploadUrl = async (seriesId: string, contentType = 'image/jpeg'): Promise<{ presignedUrl: string; key: string; expiresIn: number }> => {
    return fetchJson(`/api/creator-series/${seriesId}/cover`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-content-type': contentType },
        errorMessage: 'Failed to get cover upload URL',
    });
};

export const completeSeriesCoverUpload = async (seriesId: string, contentType = 'image/jpeg'): Promise<{ _id: string; coverUrl: string }> => {
    return fetchJson(`/api/creator-series/${seriesId}/cover/complete`, {
        method: 'POST',
        body: JSON.stringify({ contentType }),
        credentials: 'include',
        errorMessage: 'Failed to complete cover upload',
    });
};
