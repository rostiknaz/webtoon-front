// src/api.ts
import {
    seriesCoreMetadataSchema,
    seriesAccessSchema,
    seriesStatsSchema,
    seriesMetadataSchema,
    SerialNotFoundError,
    type SeriesMetadata,
    type Episode,
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
 * Fetch series access info (medium cache - 1 hour per subscription level)
 * User-specific: isLocked, hlsUrl based on subscription
 */
export const getSeriesAccess = async (seriesId: string) => {
    const response = await fetch(`/api/series/${seriesId}/access`, {
        credentials: 'include', // Include cookies for auth
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
        if (response.status === 404) {
            throw new SerialNotFoundError(`Series not found: ${seriesId}`);
        }
        throw new Error(`Failed to fetch series access: ${response.statusText}`);
    }

    const data = await response.json();
    return seriesAccessSchema.parse(data);
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
 * Fetch complete series metadata by combining all 3 endpoints
 * This is the main function used by components
 */
export const getSeriesMetadata = async (seriesId: string): Promise<SeriesMetadata> => {
    try {
        // Fetch all 3 endpoints in parallel
        const [coreData, accessData, statsData] = await Promise.all([
            getSeriesCoreMetadata(seriesId),
            getSeriesAccess(seriesId),
            getSeriesStats(seriesId),
        ]);

        // Merge episodes data from all 3 sources
        const episodesMap = new Map<string, Episode>();

        // Start with core metadata
        coreData.episodes.forEach((ep) => {
            episodesMap.set(ep._id, {
                ...ep,
                isLocked: false, // Will be updated from access data
                hlsUrl: undefined,
                views: 0, // Will be updated from stats
                likes: 0,
            });
        });

        // Merge access data (isLocked, hlsUrl)
        accessData.episodes.forEach((ep) => {
            const existing = episodesMap.get(ep._id);
            if (existing) {
                existing.isLocked = ep.isLocked;
                existing.hlsUrl = ep.hlsUrl;
            }
        });

        // Merge stats data (views, likes)
        statsData.episodes.forEach((ep) => {
            const existing = episodesMap.get(ep._id);
            if (existing) {
                existing.views = ep.views;
                existing.likes = ep.likes;
            }
        });

        // Build combined response
        const combinedData: SeriesMetadata = {
            ...coreData,
            totalViews: statsData.totalViews,
            totalLikes: statsData.totalLikes,
            episodes: Array.from(episodesMap.values()).sort(
                (a, b) => a.episodeNumber - b.episodeNumber
            ),
            user: accessData.user,
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
