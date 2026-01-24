/**
 * Analytics Engine helpers for tracking engagement events
 *
 * Analytics Engine is optimized for high-volume, non-blocking event tracking.
 * Writes are fire-and-forget (no await needed) and don't impact request latency.
 *
 * Use cases:
 * - Track likes/unlikes without hitting D1
 * - Detect viral episodes (>100 likes/min)
 * - Build trending/popular episode features
 * - Monitor user engagement patterns
 *
 * @see https://developers.cloudflare.com/analytics/analytics-engine/
 */

import type { Bindings } from './types';

/**
 * Event types for engagement tracking
 */
export type EngagementEventType =
  | 'like'
  | 'unlike'
  | 'view'
  | 'view_complete'
  | 'subscribe'
  | 'unsubscribe';

/**
 * Track an episode engagement event (like, view, etc.)
 *
 * This is non-blocking - do NOT await. The write happens asynchronously
 * and won't slow down the request.
 *
 * @example
 * ```ts
 * // In your route handler:
 * trackEpisodeEngagement(c.env, {
 *   eventType: 'like',
 *   episodeId: 'ep_123',
 *   seriesId: 'series_456',
 *   userId: 'user_789',
 * });
 * // Don't await - continues immediately
 * ```
 */
export function trackEpisodeEngagement(
  env: Bindings,
  event: {
    eventType: EngagementEventType;
    episodeId: string;
    seriesId?: string;
    userId?: string;
    metadata?: string;
  }
): void {
  // Non-blocking write - no await
  env.ENGAGEMENT_EVENTS.writeDataPoint({
    // Blobs: Text dimensions for filtering/grouping (up to 20)
    blobs: [
      event.episodeId,           // blob1: episode ID
      event.eventType,           // blob2: event type
      event.seriesId ?? '',      // blob3: series ID
      event.userId ?? 'anon',    // blob4: user ID (for fraud detection)
      event.metadata ?? '',      // blob5: additional metadata
    ],
    // Doubles: Numeric values for aggregation (up to 20)
    doubles: [
      Date.now(),                // double1: timestamp (Unix ms)
      1,                         // double2: count (always 1 per event)
    ],
    // Index: Sampling key - events with same index are sampled together
    // Use episodeId so viral episodes get sampled consistently
    indexes: [event.episodeId],
  });
}

/**
 * Track a subscription event
 *
 * @example
 * ```ts
 * trackSubscriptionEvent(c.env, {
 *   eventType: 'subscribe',
 *   userId: 'user_789',
 *   planId: 'plan_premium',
 * });
 * ```
 */
export function trackSubscriptionEvent(
  env: Bindings,
  event: {
    eventType: 'subscribe' | 'unsubscribe' | 'renew' | 'cancel';
    userId: string;
    planId?: string;
    amount?: number;
  }
): void {
  env.ENGAGEMENT_EVENTS.writeDataPoint({
    blobs: [
      'subscription',            // blob1: event category
      event.eventType,           // blob2: event type
      event.userId,              // blob3: user ID
      event.planId ?? '',        // blob4: plan ID
    ],
    doubles: [
      Date.now(),                // double1: timestamp
      event.amount ?? 0,         // double2: amount (for revenue tracking)
    ],
    indexes: [event.userId],
  });
}

/**
 * SQL queries for Analytics Engine (use via Cloudflare Dashboard or API)
 *
 * Top liked episodes in last hour:
 * ```sql
 * SELECT
 *   blob1 AS episode_id,
 *   SUM(_sample_interval) AS estimated_likes
 * FROM engagement_events
 * WHERE blob2 = 'like'
 *   AND timestamp > NOW() - INTERVAL '1' HOUR
 * GROUP BY blob1
 * ORDER BY estimated_likes DESC
 * LIMIT 10;
 * ```
 *
 * Detect viral episodes (>100 likes in 1 minute):
 * ```sql
 * SELECT
 *   blob1 AS episode_id,
 *   SUM(_sample_interval) AS like_count
 * FROM engagement_events
 * WHERE blob2 = 'like'
 *   AND timestamp > NOW() - INTERVAL '1' MINUTE
 * GROUP BY blob1
 * HAVING like_count > 100;
 * ```
 *
 * Daily active users:
 * ```sql
 * SELECT
 *   COUNT(DISTINCT blob4) AS unique_users
 * FROM engagement_events
 * WHERE timestamp > NOW() - INTERVAL '24' HOUR;
 * ```
 */
