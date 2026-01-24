// src/api.ts
import {
    seriesCoreMetadataSchema,
    seriesStatsSchema,
    seriesMetadataSchema,
    subscriptionPlansResponseSchema,
    subscriptionCheckResponseSchema,
    subscriptionStatusResponseSchema,
    subscribeResponseSchema,
    SerialNotFoundError,
    type SeriesMetadata,
    type SubscriptionPlansResponse,
    type SubscriptionCheckResponse,
    type SubscriptionStatusResponse,
    type SubscribeResponse,
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
 * Fetch complete series metadata by slug
 *
 * Uses Promise.all to fetch core data and stats in parallel.
 * Eliminates waterfall: both requests start immediately.
 *
 * Note: isLocked and hlsUrl are computed on the client side based on
 * subscription status to prevent cache invalidation issues.
 */
export const getSeriesMetadataBySlug = async (slug: string): Promise<SeriesMetadata> => {
    // Fetch core metadata and stats in parallel (no waterfall!)
    const [coreData, statsData] = await Promise.all([
        getSeriesCoreMetadataBySlug(slug),
        getSeriesStatsBySlug(slug),
    ]);

    // Create a Map for O(1) episode stats lookup instead of O(n) find()
    const statsMap = new Map(statsData.episodes.map(s => [s._id, s]));

    // Merge episodes with their stats
    const episodes = coreData.episodes.map((ep) => {
        const stats = statsMap.get(ep._id);
        return {
            ...ep,
            // Default values - isLocked and hlsUrl computed on client
            isLocked: ep.isPaid,
            hlsUrl: undefined,
            views: stats?.views ?? 0,
            likes: stats?.likes ?? 0,
        };
    });

    // Build combined response
    const combinedData: SeriesMetadata = {
        ...coreData,
        totalViews: statsData.totalViews,
        totalLikes: statsData.totalLikes,
        episodes: episodes.sort((a, b) => a.episodeNumber - b.episodeNumber),
    };

    return seriesMetadataSchema.parse(combinedData);
};

/**
 * Fetch complete series metadata by ID
 * @deprecated Use getSeriesMetadataBySlug for cleaner URLs
 */
export const getSeriesMetadata = async (seriesId: string): Promise<SeriesMetadata> => {
    // Fetch core metadata and stats in parallel
    const [coreData, statsData] = await Promise.all([
        getSeriesCoreMetadata(seriesId),
        getSeriesStats(seriesId),
    ]);

    // Create a Map for O(1) episode stats lookup instead of O(n) find()
    const statsMap = new Map(statsData.episodes.map(s => [s._id, s]));

    // Merge episodes with their stats
    const episodes = coreData.episodes.map((ep) => {
        const stats = statsMap.get(ep._id);
        return {
            ...ep,
            // Default values - isLocked and hlsUrl computed on client
            isLocked: ep.isPaid,
            hlsUrl: undefined,
            views: stats?.views ?? 0,
            likes: stats?.likes ?? 0,
        };
    });

    // Build combined response
    const combinedData: SeriesMetadata = {
        ...coreData,
        totalViews: statsData.totalViews,
        totalLikes: statsData.totalLikes,
        episodes: episodes.sort((a, b) => a.episodeNumber - b.episodeNumber),
    };

    return seriesMetadataSchema.parse(combinedData);
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
