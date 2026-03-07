/**
 * Admin Routes
 *
 * GET  /api/admin/metrics — Platform business metrics dashboard
 * GET  /api/admin/moderation — List clips in review queue
 * POST /api/admin/moderation/:clipId — Approve or reject a clip
 * GET  /api/admin/creators/activity — Creator upload activity with flagging
 * POST /api/admin/payouts/calculate — Calculate monthly creator earnings
 * GET  /api/admin/payouts/months — List payout months
 * GET  /api/admin/payouts/:month — List payouts for a month
 * POST /api/admin/payouts/approve — Approve pending payouts
 * POST /api/admin/payouts/mark-paid — Mark approved payouts as paid
 * GET  /api/admin/payouts/:month/export — Export payouts as CSV
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppEnvWithDB } from '../db/types';
import { requireAdmin } from '../middleware/auth-guard';
import { validationHook } from '../lib/schemas';
import { getModerationQueue, adminModerateClip } from '../db/services/moderation.service';
import {
  calculateMonthlyEarnings,
  getPayoutMonths,
  getPayoutsByMonth,
  approvePayoutBatch,
  markPayoutBatchPaid,
  generatePayoutCsv,
} from '../db/services/earnings.service';
import { getPlatformMetrics, getCreatorActivity } from '../db/services/metrics.service';

const admin = new Hono<AppEnvWithDB>();

// ==================== Validation Schemas ====================

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_ERROR_MESSAGE = 'Month must be in YYYY-MM format (01-12)';

const monthSchema = z.string().regex(MONTH_REGEX, MONTH_ERROR_MESSAGE);

const moderationActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional(),
});

const payoutCalculateSchema = z.object({
  month: monthSchema,
});

const payoutMonthBodySchema = z.object({
  month: monthSchema,
});

const creatorActivitySortSchema = z.object({
  sort: z.enum(['recent', 'total', 'flagged']).default('recent'),
});

// ==================== Logging Helper ====================

/**
 * Structured logging for admin actions
 * Logs to stdout in JSON format for observability tools
 */
function logAdminAction(event: string, data: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...data, timestamp: Date.now() }));
}

/**
 * Validate month parameter and return error response if invalid
 */
function validateMonthParam(month: string) {
  const result = monthSchema.safeParse(month);
  if (!result.success) {
    return { error: { code: 'VALIDATION_ERROR', message: MONTH_ERROR_MESSAGE } };
  }
  return null;
}

// ==================== Metrics Route ====================

/**
 * GET /api/admin/metrics
 *
 * Platform business metrics with period-over-period trends.
 */
admin.get(
  '/metrics',
  requireAdmin(),
  async (c) => {
    const db = c.get('db');
    const metrics = await getPlatformMetrics(db);
    return c.json({ metrics });
  },
);

// ==================== Moderation Routes ====================

/**
 * GET /api/admin/moderation
 *
 * List clips with status='review' for admin moderation.
 */
admin.get(
  '/moderation',
  requireAdmin(),
  async (c) => {
    const db = c.get('db');
    const queue = await getModerationQueue(db);
    return c.json({ clips: queue });
  },
);

/**
 * POST /api/admin/moderation/:clipId
 *
 * Admin approves or rejects a clip in review.
 */
admin.post(
  '/moderation/:clipId',
  requireAdmin(),
  zValidator('json', moderationActionSchema, validationHook),
  async (c) => {
    const adminId = c.get('userId')!;
    const db = c.get('db');
    const clipId = c.req.param('clipId');
    const { action, reason } = c.req.valid('json');

    await adminModerateClip(db, clipId, adminId, action, reason);

    return c.json({
      _id: clipId,
      status: action === 'approve' ? 'published' : 'rejected',
      action,
    });
  },
);

// ==================== Payout Calculation ====================

/**
 * POST /api/admin/payouts/calculate
 *
 * Calculate monthly creator earnings based on download proportions.
 * Idempotent — re-running for the same month replaces existing results.
 */
admin.post(
  '/payouts/calculate',
  requireAdmin(),
  zValidator('json', payoutCalculateSchema, validationHook),
  async (c) => {
    const db = c.get('db');
    const { month } = c.req.valid('json');

    const summary = await calculateMonthlyEarnings(db, month);

    logAdminAction('payout_calculation', {
      month: summary.month,
      totalRevenue: summary.totalRevenue,
      creatorsProcessed: summary.creatorsProcessed,
    });

    return c.json(summary);
  },
);

// ==================== Payout Management ====================

/**
 * GET /api/admin/payouts/months
 *
 * List available payout months with summary stats.
 */
admin.get(
  '/payouts/months',
  requireAdmin(),
  async (c) => {
    const db = c.get('db');
    const months = await getPayoutMonths(db);
    return c.json({ months });
  },
);

/**
 * GET /api/admin/payouts/:month
 *
 * List all creator payouts for a specific month.
 */
admin.get(
  '/payouts/:month',
  requireAdmin(),
  async (c) => {
    const db = c.get('db');
    const month = c.req.param('month');

    const validationError = validateMonthParam(month);
    if (validationError) {
      return c.json(validationError, 400);
    }

    const payouts = await getPayoutsByMonth(db, month);
    return c.json({ payouts });
  },
);

/**
 * POST /api/admin/payouts/approve
 *
 * Approve all pending payouts for a given month.
 */
admin.post(
  '/payouts/approve',
  requireAdmin(),
  zValidator('json', payoutMonthBodySchema, validationHook),
  async (c) => {
    const db = c.get('db');
    const { month } = c.req.valid('json');

    const approved = await approvePayoutBatch(db, month);

    logAdminAction('payout_batch_approved', { month, approved });

    return c.json({ approved, month });
  },
);

/**
 * POST /api/admin/payouts/mark-paid
 *
 * Mark all approved payouts for a given month as paid.
 */
admin.post(
  '/payouts/mark-paid',
  requireAdmin(),
  zValidator('json', payoutMonthBodySchema, validationHook),
  async (c) => {
    const db = c.get('db');
    const { month } = c.req.valid('json');

    const paid = await markPayoutBatchPaid(db, month);

    logAdminAction('payout_batch_paid', { month, paid });

    return c.json({ paid, month });
  },
);

/**
 * GET /api/admin/payouts/:month/export
 *
 * Export payouts for a month as CSV file download.
 */
admin.get(
  '/payouts/:month/export',
  requireAdmin(),
  async (c) => {
    const db = c.get('db');
    const month = c.req.param('month');

    const validationError = validateMonthParam(month);
    if (validationError) {
      return c.json(validationError, 400);
    }

    const csv = await generatePayoutCsv(db, month);

    c.header('Content-Type', 'text/csv');
    c.header('Content-Disposition', `attachment; filename="payouts-${month}.csv"`);
    return c.body(csv);
  },
);

// ==================== Creator Activity Routes ====================

/**
 * GET /api/admin/creators/activity
 *
 * List creator upload activity with flagging for abuse patterns.
 * Query param: sort = 'recent' | 'total' | 'flagged'
 */
admin.get(
  '/creators/activity',
  requireAdmin(),
  zValidator('query', creatorActivitySortSchema, validationHook),
  async (c) => {
    const db = c.get('db');
    const { sort } = c.req.valid('query');
    const creators = await getCreatorActivity(db, sort);
    return c.json({ creators });
  },
);

export default admin;
