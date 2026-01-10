/**
 * KV Cache Usage Examples
 *
 * These examples show how to use the caching layer in your API endpoints
 * to dramatically improve performance.
 */

import { createCacheLayer } from './cache';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

// Example: Fast session lookup for authentication
export async function authenticateRequest(
  token: string,
  kv: KVNamespace,
  db: D1Database
) {
  const cache = createCacheLayer(kv);

  // Try cache first (1-5ms)
  let session = await cache.sessions.getSession(token);

  if (!session) {
    // Cache miss - query D1 (50-100ms)
    const dbSession = await db
      .prepare(
        `SELECT s.*, u.email, sub.status as subscriptionStatus, sub.plan_id
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         LEFT JOIN subscriptions sub ON u.id = sub.user_id AND sub.status = 'active'
         WHERE s.token = ?`
      )
      .bind(token)
      .first();

    if (dbSession) {
      session = {
        userId: dbSession.user_id,
        email: dbSession.email,
        expiresAt: dbSession.expires_at,
        subscriptionStatus: dbSession.subscriptionStatus || 'none',
        subscriptionPlanId: dbSession.plan_id || null,
      };

      // Store in cache for next time (background, don't await)
      cache.sessions.setSession(token, session);
    }
  }

  return session;
}

// Example: Fast access control check
export async function canAccessEpisode(
  userId: string,
  episodeId: string,
  kv: KVNamespace,
  db: D1Database
): Promise<boolean> {
  const cache = createCacheLayer(kv);

  // 1. Get episode data (check if paid)
  const episode = await db
    .prepare('SELECT is_paid FROM episodes WHERE id = ?')
    .bind(episodeId)
    .first();

  if (!episode) return false;
  if (!episode.is_paid) return true; // Free episode

  // 2. Check subscription status from cache (FAST!)
  let userSub = await cache.subscriptions.getUserSubscription(userId);

  if (!userSub) {
    // Cache miss - query D1
    const dbSub = await db
      .prepare(
        `SELECT s.status, s.plan_id, s.current_period_end, p.features
         FROM subscriptions s
         JOIN plans p ON s.plan_id = p.id
         WHERE s.user_id = ? AND s.status IN ('active', 'trial')`
      )
      .bind(userId)
      .first();

    if (dbSub) {
      const features = JSON.parse(dbSub.features);
      userSub = {
        status: dbSub.status,
        planId: dbSub.plan_id,
        planFeatures: features,
        currentPeriodEnd: dbSub.current_period_end,
        hasAccess: features.episodeAccess === 'all',
        cachedAt: Date.now(),
      };

      // Cache for next access check
      await cache.subscriptions.setUserSubscription(userId, userSub);
    }
  }

  return userSub?.hasAccess || false;
}

// Example: Fast series page load
export async function getSeriesPageData(
  serialId: string,
  kv: KVNamespace,
  db: D1Database
) {
  const cache = createCacheLayer(kv);

  // Try to get both series metadata and episodes from cache
  const [seriesData, episodesData] = await Promise.all([
    cache.series.getSeries(serialId),
    cache.series.getSeriesEpisodes(serialId),
  ]);

  // If both cached, return immediately (2-10ms total!)
  if (seriesData && episodesData) {
    return {
      series: seriesData,
      episodes: episodesData.episodes,
    };
  }

  // Cache miss - query D1 (100-200ms)
  const [dbSeries, dbEpisodes] = await Promise.all([
    db
      .prepare('SELECT * FROM series WHERE id = ?')
      .bind(serialId)
      .first(),
    db
      .prepare(
        `SELECT id, episode_number, title, thumbnail_url, duration,
                is_paid, views, likes, published_at
         FROM episodes
         WHERE serial_id = ?
         ORDER BY episode_number ASC`
      )
      .bind(serialId)
      .all(),
  ]);

  // Cache for next request (background)
  if (dbSeries) {
    cache.series.setSeries(serialId, dbSeries);
  }
  if (dbEpisodes) {
    cache.series.setSeriesEpisodes(serialId, {
      episodes: dbEpisodes.results,
      totalEpisodes: dbEpisodes.results.length,
    });
  }

  return {
    series: dbSeries,
    episodes: dbEpisodes.results,
  };
}

// Example: Fast subscription plans loading
export async function getSubscriptionPlans(kv: KVNamespace, db: D1Database) {
  const cache = createCacheLayer(kv);

  // Try cache first
  const cachedPlans = await cache.plans.getAllPlans();
  if (cachedPlans) {
    return cachedPlans.plans;
  }

  // Cache miss - query D1
  const dbPlans = await db
    .prepare('SELECT * FROM plans WHERE is_active = 1')
    .all();

  const plans = dbPlans.results.map((p: any) => ({
    ...p,
    features: JSON.parse(p.features),
  }));

  // Cache for a week (pricing rarely changes)
  await cache.plans.setAllPlans({ plans });

  return plans;
}

// Example: Homepage with cached data
export async function getHomepageData(kv: KVNamespace, db: D1Database) {
  const cache = createCacheLayer(kv);

  // Try cache first
  const cachedHomepage = await cache.homepage.getHomepageData();
  if (cachedHomepage) {
    return cachedHomepage;
  }

  // Cache miss - query D1 (expensive aggregations)
  const [featured, trending, newReleases] = await Promise.all([
    db
      .prepare(
        `SELECT * FROM series
         WHERE status = 'ongoing'
         ORDER BY total_views DESC
         LIMIT 10`
      )
      .all(),
    db
      .prepare(
        `SELECT s.*, COUNT(e.id) as episode_count
         FROM series s
         LEFT JOIN episodes e ON s.id = e.serial_id
         WHERE e.published_at > datetime('now', '-7 days')
         GROUP BY s.id
         ORDER BY episode_count DESC
         LIMIT 10`
      )
      .all(),
    db
      .prepare(
        `SELECT * FROM episodes
         WHERE published_at IS NOT NULL
         ORDER BY published_at DESC
         LIMIT 20`
      )
      .all(),
  ]);

  const homepageData = {
    featuredSeries: featured.results,
    trending: trending.results,
    newReleases: newReleases.results,
  };

  // Cache for 30 minutes
  await cache.homepage.setHomepageData(homepageData);

  return homepageData;
}

// Example: Cache invalidation after webhook
export async function handleSubscriptionWebhook(
  userId: string,
  subscriptionData: any,
  kv: KVNamespace,
  db: D1Database
) {
  // Update D1 (source of truth)
  await db
    .prepare(
      `UPDATE subscriptions
       SET status = ?, current_period_end = ?, updated_at = ?
       WHERE user_id = ?`
    )
    .bind(
      subscriptionData.status,
      subscriptionData.currentPeriodEnd,
      Date.now(),
      userId
    )
    .run();

  // Invalidate caches immediately
  const cache = createCacheLayer(kv);
  await Promise.all([
    cache.subscriptions.invalidateUserSubscription(userId),
    cache.userProfiles.invalidateUserProfile(userId),
  ]);

  // User will get fresh data on next request
}

// Example: Cache warming (pre-populate cache)
export async function warmCache(kv: KVNamespace, db: D1Database) {
  const cache = createCacheLayer(kv);

  // Warm homepage cache
  const homepage = await getHomepageData(kv, db);
  console.log('Homepage cache warmed');

  // Warm plans cache
  const plans = await getSubscriptionPlans(kv, db);
  console.log('Plans cache warmed');

  // Warm popular series
  const popularSeries = await db
    .prepare('SELECT id FROM series ORDER BY total_views DESC LIMIT 50')
    .all();

  for (const series of popularSeries.results) {
    await getSeriesPageData(series.id, kv, db);
  }
  console.log(`${popularSeries.results.length} series cached`);
}
