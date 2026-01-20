/**
 * KV Cache Layer for Performance Optimization
 *
 * This module provides caching utilities for frequently-accessed data
 * using Cloudflare KV storage to reduce D1 database queries.
 */

/** Check if subscription is still valid based on expiration time */
function isSubscriptionActive(currentPeriodEnd: number | null): boolean {
  if (!currentPeriodEnd) return false;
  return currentPeriodEnd > Math.floor(Date.now() / 1000);
}

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  SESSION: 60 * 60 * 24 * 7, // 7 days
  USER_SUBSCRIPTION: 60 * 10, // 10 minutes (optimized for freshness)
  USER_PROFILE: 60 * 60, // 1 hour
  SERIES_METADATA: 60 * 60 * 24, // 1 day
  SERIES_EPISODES: 60 * 60 * 6, // 6 hours
  SUBSCRIPTION_PLANS: 60 * 60 * 24 * 7, // 1 week
  HOMEPAGE_DATA: 60 * 30, // 30 minutes
} as const;

// Cache key prefixes for organization
export const CACHE_PREFIX = {
  SESSION: 'session:',
  USER_SUB: 'user_sub:',
  USER_PROFILE: 'user_profile:',
  SERIES: 'series:',
  SERIES_EPISODES: 'series_episodes:',
  PLANS: 'plans:all',
  HOMEPAGE: 'homepage:featured',
} as const;

interface CacheOptions {
  ttl?: number;
  metadata?: Record<string, string>;
}

/**
 * Generic cache wrapper with get/set/delete operations
 */
export class CacheManager {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  /**
   * Get cached data with automatic JSON parsing
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.kv.get(key, 'json');
      return value as T | null;
    } catch (error) {
      console.error(`KV get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached data with TTL
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      await this.kv.put(key, JSON.stringify(value), {
        expirationTtl: options?.ttl,
        metadata: options?.metadata,
      });
    } catch (error) {
      console.error(`KV set error for key ${key}:`, error);
    }
  }

  /**
   * Delete cached data
   */
  async delete(key: string): Promise<void> {
    try {
      await this.kv.delete(key);
    } catch (error) {
      console.error(`KV delete error for key ${key}:`, error);
    }
  }

  /**
   * Delete multiple keys (cache invalidation)
   */
  async deleteMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map(key => this.delete(key)));
  }

  /**
   * Get or fetch pattern: Try cache first, fallback to fetcher
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch from source
    const data = await fetcher();

    // Store in cache for next time (don't await)
    this.set(key, data, options).catch(err =>
      console.error('Background cache set failed:', err)
    );

    return data;
  }

  /**
   * Get or fetch with lock pattern (prevents cache stampede)
   *
   * P0 FIX: Prevents thundering herd problem where multiple concurrent
   * requests all hit the database on cache miss.
   *
   * Uses a short-lived lock key to ensure only one request fetches from DB.
   * Other requests will retry cache after a brief delay.
   *
   * @param key - Cache key
   * @param fetcher - Function to fetch data on cache miss
   * @param options - Cache options including TTL
   * @returns Cached or fetched data, or null if lock contention
   */
  async getOrFetchWithLock<T>(
    key: string,
    fetcher: () => Promise<T | null>,
    options?: CacheOptions & { lockTtl?: number; retries?: number }
  ): Promise<T | null> {
    const lockKey = `lock:${key}`;
    const lockTtl = options?.lockTtl ?? 5; // 5 second lock by default
    const maxRetries = options?.retries ?? 2;

    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - try to acquire lock
    // Check if another request is already fetching
    const existingLock = await this.kv.get(lockKey);
    if (existingLock) {
      // Another request is fetching - wait and retry cache
      for (let i = 0; i < maxRetries; i++) {
        await new Promise(resolve => setTimeout(resolve, 50 * (i + 1))); // 50ms, 100ms delays
        const retryCache = await this.get<T>(key);
        if (retryCache !== null) {
          return retryCache;
        }
      }
      // Still no cache after retries - fetch anyway to prevent starvation
    }

    // Set lock (short TTL)
    try {
      await this.kv.put(lockKey, '1', { expirationTtl: lockTtl });
    } catch {
      // Lock set failed - continue anyway
    }

    try {
      // Fetch from source
      const data = await fetcher();

      if (data !== null) {
        // Store in cache
        await this.set(key, data, options);
      }

      return data;
    } finally {
      // Release lock
      try {
        await this.kv.delete(lockKey);
      } catch {
        // Lock delete failed - will expire anyway
      }
    }
  }
}

/**
 * Session Cache Operations
 * Used by Better Auth for fast session lookups
 */
export class SessionCache {
  private cache: CacheManager;

  constructor(kv: KVNamespace) {
    this.cache = new CacheManager(kv);
  }

  async getSession(token: string) {
    return this.cache.get<{
      userId: string;
      email: string;
      expiresAt: number;
      subscriptionStatus: string;
      subscriptionPlanId: string | null;
    }>(`${CACHE_PREFIX.SESSION}${token}`);
  }

  async setSession(token: string, sessionData: any) {
    return this.cache.set(
      `${CACHE_PREFIX.SESSION}${token}`,
      sessionData,
      { ttl: CACHE_TTL.SESSION }
    );
  }

  async deleteSession(token: string) {
    return this.cache.delete(`${CACHE_PREFIX.SESSION}${token}`);
  }
}

/**
 * Cached subscription data structure
 */
export interface CachedSubscription {
  status: string;
  planId: string;
  planFeatures: {
    episodeAccess: string;
    adFree: boolean;
  };
  currentPeriodEnd: number;
  hasAccess: boolean;
  cachedAt: number;
}

/**
 * User Subscription Cache
 * Critical for access control performance
 */
export class SubscriptionCache {
  private cache: CacheManager;

  constructor(kv: KVNamespace) {
    this.cache = new CacheManager(kv);
  }

  /**
   * Get cached subscription with time-based access validation
   *
   * Always re-validates hasAccess using isSubscriptionActive()
   * to handle edge cases where cached data becomes stale.
   */
  async getUserSubscription(userId: string): Promise<CachedSubscription | null> {
    const cached = await this.cache.get<CachedSubscription>(`${CACHE_PREFIX.USER_SUB}${userId}`);
    if (!cached) return null;

    // Re-validate hasAccess based on time (don't trust cached hasAccess)
    const hasAccess = isSubscriptionActive(cached.currentPeriodEnd);

    // If subscription expired, invalidate cache and return null
    if (!hasAccess) {
      await this.invalidateUserSubscription(userId);
      return null;
    }

    return { ...cached, hasAccess };
  }

  async setUserSubscription(userId: string, subData: Omit<CachedSubscription, 'cachedAt'>, ttlSeconds?: number) {
    return this.cache.set(
      `${CACHE_PREFIX.USER_SUB}${userId}`,
      { ...subData, cachedAt: Date.now() },
      { ttl: ttlSeconds || CACHE_TTL.USER_SUBSCRIPTION }
    );
  }

  async invalidateUserSubscription(userId: string) {
    return this.cache.delete(`${CACHE_PREFIX.USER_SUB}${userId}`);
  }

  /**
   * Get subscription with lock to prevent cache stampede
   *
   * P0 FIX: Prevents thundering herd when multiple concurrent requests
   * experience cache miss for the same user.
   *
   * Also validates expiration time - if cached subscription is expired,
   * invalidates cache and fetches fresh data.
   *
   * @param userId - User ID
   * @param fetcher - Function to fetch subscription from database
   * @param ttlSeconds - Optional TTL override
   */
  async getOrFetchUserSubscription(
    userId: string,
    fetcher: () => Promise<CachedSubscription | null>,
    ttlSeconds?: number
  ): Promise<CachedSubscription | null> {
    const key = `${CACHE_PREFIX.USER_SUB}${userId}`;

    // Check cache first
    const cached = await this.cache.get<CachedSubscription>(key);

    if (cached) {
      // Validate expiration time using shared helper
      if (isSubscriptionActive(cached.currentPeriodEnd)) {
        // Still valid
        return { ...cached, hasAccess: true };
      }

      // Expired - invalidate cache
      await this.cache.delete(key);
    }

    // Cache miss or expired - fetch with lock
    return this.cache.getOrFetchWithLock<CachedSubscription>(
      key,
      fetcher,
      { ttl: ttlSeconds || CACHE_TTL.USER_SUBSCRIPTION }
    );
  }
}

/**
 * Series Metadata Cache
 * High-impact caching for series pages and homepage
 */
export class SeriesCache {
  private cache: CacheManager;

  constructor(kv: KVNamespace) {
    this.cache = new CacheManager(kv);
  }

  async getSeries(serialId: string) {
    return this.cache.get<{
      id: string;
      title: string;
      description: string;
      thumbnailUrl: string;
      genre: string;
      author: string;
      totalViews: number;
      totalLikes: number;
      episodeCount: number;
    }>(`${CACHE_PREFIX.SERIES}${serialId}`);
  }

  async setSeries(serialId: string, seriesData: any) {
    return this.cache.set(
      `${CACHE_PREFIX.SERIES}${serialId}`,
      seriesData,
      { ttl: CACHE_TTL.SERIES_METADATA }
    );
  }

  async invalidateSeries(serialId: string) {
    // Invalidate both series and its episodes
    await this.cache.deleteMany([
      `${CACHE_PREFIX.SERIES}${serialId}`,
      `${CACHE_PREFIX.SERIES_EPISODES}${serialId}`,
    ]);
  }

  async getSeriesEpisodes(serialId: string) {
    return this.cache.get<{
      episodes: Array<{
        id: string;
        episodeNumber: number;
        title: string;
        thumbnailUrl: string;
        duration: number;
        isPaid: boolean;
        views: number;
        likes: number;
      }>;
      totalEpisodes: number;
      cachedAt: number;
    }>(`${CACHE_PREFIX.SERIES_EPISODES}${serialId}`);
  }

  async setSeriesEpisodes(serialId: string, episodesData: any) {
    return this.cache.set(
      `${CACHE_PREFIX.SERIES_EPISODES}${serialId}`,
      { ...episodesData, cachedAt: Date.now() },
      { ttl: CACHE_TTL.SERIES_EPISODES }
    );
  }
}

/**
 * Subscription Plans Cache
 * Rarely changes, perfect for long-term caching
 */
export class PlansCache {
  private cache: CacheManager;

  constructor(kv: KVNamespace) {
    this.cache = new CacheManager(kv);
  }

  async getAllPlans() {
    return this.cache.get<{
      plans: Array<{
        id: string;
        name: string;
        price: number;
        currency: string;
        billingPeriod: string;
        features: Record<string, any>;
        solidgateProductId: string;
      }>;
      cachedAt: number;
    }>(CACHE_PREFIX.PLANS);
  }

  async setAllPlans(plansData: any) {
    return this.cache.set(
      CACHE_PREFIX.PLANS,
      { ...plansData, cachedAt: Date.now() },
      { ttl: CACHE_TTL.SUBSCRIPTION_PLANS }
    );
  }

  async invalidatePlans() {
    return this.cache.delete(CACHE_PREFIX.PLANS);
  }
}

/**
 * Homepage Data Cache
 * Aggregated data for homepage (same for all users)
 */
export class HomepageCache {
  private cache: CacheManager;

  constructor(kv: KVNamespace) {
    this.cache = new CacheManager(kv);
  }

  async getHomepageData() {
    return this.cache.get<{
      featuredSeries: any[];
      trending: any[];
      newReleases: any[];
      cachedAt: number;
    }>(CACHE_PREFIX.HOMEPAGE);
  }

  async setHomepageData(homepageData: any) {
    return this.cache.set(
      CACHE_PREFIX.HOMEPAGE,
      { ...homepageData, cachedAt: Date.now() },
      { ttl: CACHE_TTL.HOMEPAGE_DATA }
    );
  }

  async invalidateHomepage() {
    return this.cache.delete(CACHE_PREFIX.HOMEPAGE);
  }
}

/**
 * User Profile Cache
 * Includes denormalized subscription info for fast access
 */
export class UserProfileCache {
  private cache: CacheManager;

  constructor(kv: KVNamespace) {
    this.cache = new CacheManager(kv);
  }

  async getUserProfile(userId: string) {
    return this.cache.get<{
      id: string;
      name: string;
      email: string;
      image: string | null;
      isSubscribed: boolean;
      subscriptionTier: string | null;
      permissions: string[];
      cachedAt: number;
    }>(`${CACHE_PREFIX.USER_PROFILE}${userId}`);
  }

  async setUserProfile(userId: string, profileData: any) {
    return this.cache.set(
      `${CACHE_PREFIX.USER_PROFILE}${userId}`,
      { ...profileData, cachedAt: Date.now() },
      { ttl: CACHE_TTL.USER_PROFILE }
    );
  }

  async invalidateUserProfile(userId: string) {
    return this.cache.delete(`${CACHE_PREFIX.USER_PROFILE}${userId}`);
  }
}

/**
 * Master cache instance factory
 * Creates all cache managers with a single KV namespace
 */
export function createCacheLayer(kv: KVNamespace) {
  return {
    sessions: new SessionCache(kv),
    subscriptions: new SubscriptionCache(kv),
    series: new SeriesCache(kv),
    plans: new PlansCache(kv),
    homepage: new HomepageCache(kv),
    userProfiles: new UserProfileCache(kv),
    raw: new CacheManager(kv), // For custom caching
  };
}

/**
 * Type for the cache layer returned by createCacheLayer
 */
export type CacheLayer = ReturnType<typeof createCacheLayer>;
