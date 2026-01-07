import { z } from "zod"

const episodeSchema = z.object({
    _id: z.string(),
    episodeNumber: z.number().int().positive(),
    title: z.string().optional(),
    thumbnail: z.string().url().optional(),
    duration: z.number().optional(), // in seconds
    isLocked: z.boolean(),
    hlsUrl: z.string().url().optional(), // only if unlocked
    videoId: z.string().optional(), // Cloudflare Stream video ID
    releaseDate: z.string().optional(),
    views: z.number().optional(),
});

export const seriesMetadataSchema = z.object({
    _id: z.string(),
    title: z.string().min(1),
    description: z.string().optional(),
    thumbnail: z.string().url().optional(),
    coverImage: z.string().url().optional(),
    rating: z.number().min(0).max(10).optional(),
    totalViews: z.number().optional(),
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
})

export type SeriesMetadata = z.infer<typeof seriesMetadataSchema>
export type Episode = z.infer<typeof episodeSchema>

export class SerialNotFoundError extends Error {}