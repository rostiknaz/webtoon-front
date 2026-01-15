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

// ==================== Type Exports ====================

export type IdParam = z.infer<typeof idParamSchema>;
export type SubscribeBody = z.infer<typeof subscribeBodySchema>;
