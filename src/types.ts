import { z } from "zod"

const episodeSchema = z.object({
    _id: z.string(),
    episodeNumber: z.number().int().positive(),
    isLocked: z.boolean(),
    hlsUrl: z.url().optional(), // only if unlocked
});

export const seriesMetadataSchema = z.object({
    _id: z.string(),
    title: z.string().min(1),
    description: z.string().optional(),
    episodes: z.array(episodeSchema),
})

export type seriesMetadata = z.infer<typeof seriesMetadataSchema>
export type episode = z.infer<typeof episodeSchema>

export class SerialNotFoundError extends Error {}