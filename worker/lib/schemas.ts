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

// ==================== Type Exports ====================

export type IdParam = z.infer<typeof idParamSchema>;
export type SubscribeBody = z.infer<typeof subscribeBodySchema>;
export type CreatorRegistration = z.infer<typeof creatorRegistrationSchema>;
export type FeedQuery = z.infer<typeof feedQuerySchema>;
