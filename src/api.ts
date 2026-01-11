// src/api.ts
import {
    seriesCoreMetadataSchema,
    seriesStatsSchema,
    seriesMetadataSchema,
    subscriptionPlansResponseSchema,
    subscriptionCheckResponseSchema,
    subscribeResponseSchema,
    SerialNotFoundError,
    type SeriesMetadata,
    type SubscriptionPlansResponse,
    type SubscriptionCheckResponse,
    type SubscribeResponse,
} from './types';

/**
 * Fetch series core metadata (long cache - 24 hours)
 * Static data: title, description, episodes list, etc.
 */
export const getSeriesCoreMetadata = async (seriesId: string) => {
    const response = await fetch(`/api/series/${seriesId}`, {
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
        if (response.status === 404) {
            throw new SerialNotFoundError(`Series not found: ${seriesId}`);
        }
        throw new Error(`Failed to fetch series: ${response.statusText}`);
    }

    const data = await response.json();
    return seriesCoreMetadataSchema.parse(data);
};

/**
 * Fetch series statistics (short cache - 1 minute)
 * Dynamic data: views, likes
 */
export const getSeriesStats = async (seriesId: string) => {
    const response = await fetch(`/api/series/${seriesId}/stats`, {
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
        if (response.status === 404) {
            throw new SerialNotFoundError(`Series not found: ${seriesId}`);
        }
        throw new Error(`Failed to fetch series stats: ${response.statusText}`);
    }

    const data = await response.json();
    return seriesStatsSchema.parse(data);
};

/**
 * Fetch complete series metadata by combining core data and stats
 * Access control (isLocked) is computed on the client using subscription status
 * This is the main function used by components
 */
export const getSeriesMetadata = async (
    seriesId: string,
    hasSubscription: boolean = false
): Promise<SeriesMetadata> => {
    try {
        // Fetch core metadata and stats in parallel (no need for access endpoint)
        const [coreData, statsData] = await Promise.all([
            getSeriesCoreMetadata(seriesId),
            getSeriesStats(seriesId),
        ]);

        // Merge episodes data and compute access on client side
        const episodes = coreData.episodes.map((ep) => {
            // Simple access logic: paid episodes are locked unless user has subscription
            const isLocked = ep.isPaid && !hasSubscription;

            // Get stats for this episode
            const episodeStats = statsData.episodes.find(s => s._id === ep._id);

            return {
                ...ep,
                isLocked,
                // HLS URL will be fetched when user clicks play (separate endpoint)
                hlsUrl: !isLocked && ep.videoId
                    ? `https://customer-${import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE || 'demo'}.cloudflarestream.com/${ep.videoId}/manifest/video.m3u8`
                    : undefined,
                views: episodeStats?.views || 0,
                likes: episodeStats?.likes || 0,
            };
        });

        // Build combined response
        const combinedData: SeriesMetadata = {
            ...coreData,
            totalViews: statsData.totalViews,
            totalLikes: statsData.totalLikes,
            episodes: episodes.sort((a, b) => a.episodeNumber - b.episodeNumber),
            user: {
                isAuthenticated: hasSubscription, // Simplified: if it has subscription, must be authenticated
                hasSubscription,
            },
        };

        return seriesMetadataSchema.parse(combinedData);
    } catch (error) {
        if (error instanceof SerialNotFoundError) {
            throw error;
        }
        console.error('Failed to fetch series metadata:', error);
        throw new Error('Failed to load series data');
    }
};

// ==================== Subscription API ====================

/**
 * Fetch available subscription plans
 */
export const getSubscriptionPlans = async (): Promise<SubscriptionPlansResponse> => {
    const response = await fetch('/api/subscription/plans', {
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch subscription plans: ${response.statusText}`);
    }

    const data = await response.json();
    return subscriptionPlansResponseSchema.parse(data);
};

/**
 * Check if user has an active subscription
 */
export const checkSubscription = async (): Promise<SubscriptionCheckResponse> => {
    const response = await fetch('/api/subscription/check', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error(`Failed to check subscription: ${response.statusText}`);
    }

    const data = await response.json();
    return subscriptionCheckResponseSchema.parse(data);
};

/**
 * Subscribe to a plan
 */
export const subscribeToPlan = async (planId: string): Promise<SubscribeResponse> => {
    const response = await fetch('/api/subscription/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
        credentials: 'include',
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const errorMessage = (data as { error?: string }).error || 'Failed to create subscription';
        throw new Error(errorMessage);
    }

    const data = await response.json();
    return subscribeResponseSchema.parse(data);
};
