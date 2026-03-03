/**
 * API Request Validation Schemas
 *
 * Zod schemas for validating incoming API requests.
 * Used with @hono/zod-validator middleware.
 */

import { z } from 'zod';
import { Errors } from './errors';

// ==================== Validation Hook ====================

/**
 * Standard validation error handler for @hono/zod-validator
 *
 * Converts Zod validation errors to our standardized ApiError format.
 * Use this as the third argument to zValidator().
 *
 * Note: Uses Zod 4 error format (issues instead of errors)
 *
 * @example
 * zValidator('json', schema, validationHook)
 */
export const validationHook = (result: { success: boolean; error?: z.core.$ZodError }) => {
  if (!result.success && result.error) {
    const issues = result.error.issues;
    const firstIssue = issues[0];
    throw Errors.validation(firstIssue.message, {
      field: firstIssue.path.join('.'),
      errors: issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
};

// ==================== Common Schemas ====================

/**
 * UUID/ID parameter validation
 * Accepts UUIDs or simple string IDs
 */
export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

// ==================== Subscription Schemas ====================

/**
 * POST /api/subscription/subscribe request body
 */
export const subscribeBodySchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
});

// ==================== Creator Schemas ====================

/**
 * POST /api/creators/register request body
 */
export const creatorRegistrationSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(50),
  bio: z.string().max(500).optional(),
  payoutMethod: z.enum(['paypal', 'stripe']),
  payoutEmail: z.string().email('Valid email required for payouts'),
  tosAccepted: z.literal(true, 'You must accept the Terms of Service'),
});

// ==================== Feed Schemas ====================

/**
 * GET /api/feed query parameters
 */
export const feedQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  category: z.string().optional(),
  nsfw: z.enum(['safe', 'all']).default('safe'),
});

// ==================== Upload Schemas ====================

/** Resolution string validator: "WIDTHxHEIGHT", min 1080x1920 */
const resolutionSchema = z.string().refine(
  (val) => {
    const match = val.match(/^(\d+)x(\d+)$/);
    if (!match) return false;
    const w = parseInt(match[1], 10);
    const h = parseInt(match[2], 10);
    return w >= 1080 && h >= 1920;
  },
  { message: 'Resolution too low: minimum 1080x1920 required' },
);

/**
 * POST /api/upload/init request body
 */
export const uploadInitSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(100),
  categoryIds: z.array(z.string()).min(1, 'At least one category required').max(5, 'Maximum 5 categories'),
  aiToolUsed: z.string().min(1, 'AI tool used is required'),
  nsfwRating: z.enum(['safe', 'suggestive', 'explicit']),
  fileSize: z.number().int().positive().max(500 * 1024 * 1024, 'File size must be under 500MB'),
  duration: z.number().min(10, 'Duration must be at least 10 seconds').max(600, 'Duration must be under 10 minutes'),
  resolution: resolutionSchema,
  seriesId: z.string().optional(),
  episodeNumber: z.number().int().positive().optional(),
});

// ==================== Type Exports ====================

export type IdParam = z.infer<typeof idParamSchema>;
export type SubscribeBody = z.infer<typeof subscribeBodySchema>;
export type CreatorRegistration = z.infer<typeof creatorRegistrationSchema>;
export type FeedQuery = z.infer<typeof feedQuerySchema>;
export type UploadInit = z.infer<typeof uploadInitSchema>;
