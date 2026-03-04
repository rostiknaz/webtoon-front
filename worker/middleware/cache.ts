/**
 * Caching middleware for Cloudflare Workers
 *
 * Uses KV storage for caching with proper Cache-Status headers
 * Following Cloudflare best practices and modern HTTP caching standards
 *
 * @see https://developers.cloudflare.com/workers/runtime-apis/cache/
 * @see https://httptoolkit.com/blog/status-targeted-caching-headers/
 */

import type { Context, Next } from 'hono';
import type { AppEnv } from '../lib/types';

interface CacheOptions {
  /**
   * Cache key (if not provided, uses request URL)
   */
  key?: string;

  /**
   * TTL in seconds
   */
  ttl: number;

  /**
   * Cache-Control header value for client-side caching
   */
  cacheControl?: string;

  /**
   * Whether this is private (user-specific) or public data
   */
  isPrivate?: boolean;

  /**
   * Function to generate cache key from context.
   * Return null to skip caching for this request.
   */
  keyGenerator?: (c: Context<AppEnv>) => string | null;
}

/**
 * KV-based caching middleware
 *
 * This middleware:
 * 1. Checks KV cache for existing response
 * 2. Returns cached response with Cache-Status: HIT header
 * 3. If cache miss, calls next() to generate response
 * 4. Stores response in KV cache
 * 5. Returns response with Cache-Status: MISS header
 *
 * Unlike the X-Cache header (used by origin servers),
 * Cache-Status is the modern HTTP standard for cache reporting.
 *
 * @see https://httpwg.org/specs/rfc9211.html
 */
export function kvCache(options: CacheOptions) {
  return async (c: Context<AppEnv>, next: Next) => {
    const { ttl, cacheControl, isPrivate = false, keyGenerator } = options;

    // Generate cache key (null = skip caching)
    const cacheKey = keyGenerator ? keyGenerator(c) : c.req.url;
    if (cacheKey === null) {
      await next();
      return;
    }

    // Try to get from KV cache
    try {
      const cached = await c.env.CACHE.get(cacheKey, 'json');

      if (cached) {
        // Cache HIT - return cached response
        return c.json(cached, 200, {
          'Cache-Control':
            cacheControl || (isPrivate ? 'private, max-age=300' : 'public, max-age=3600'),
          'Cache-Status': 'HIT; ttl=' + ttl,
        });
      }
    } catch (error) {
      console.error('KV cache read error:', error);
      // Continue to next() on cache read errors
    }

    // Cache MISS - generate response
    await next();

    // Only cache successful JSON responses
    if (c.res.status === 200 && c.res.headers.get('Content-Type')?.includes('application/json')) {
      try {
        // Clone response to read body
        const responseClone = c.res.clone();
        const data = await responseClone.json();

        // Store in KV cache
        await c.env.CACHE.put(cacheKey, JSON.stringify(data), {
          expirationTtl: ttl,
        });

        // Add Cache-Status header to original response
        c.res.headers.set(
          'Cache-Control',
          cacheControl || (isPrivate ? 'private, max-age=300' : 'public, max-age=3600')
        );
        c.res.headers.set('Cache-Status', 'MISS; stored; ttl=' + ttl);
      } catch (error) {
        console.error('KV cache write error:', error);
        // Don't fail the request on cache write errors
      }
    }
  };
}

/**
 * Cache invalidation helper
 *
 * Invalidates one or more cache keys from KV storage
 */
export async function invalidateCache(c: Context<AppEnv>, keys: string | string[]) {
  const keysArray = Array.isArray(keys) ? keys : [keys];

  try {
    await Promise.all(keysArray.map((key) => c.env.CACHE.delete(key)));
    console.log(`Invalidated ${keysArray.length} cache keys`);
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}

/**
 * Helper to build cache key with prefix
 */
export function buildCacheKey(prefix: string, ...parts: string[]): string {
  return `${prefix}:${parts.join(':')}`;
}
