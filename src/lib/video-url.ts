/**
 * Video URL Signing
 *
 * Fetches signed tokens from the Worker and caches them.
 * Tokens are cached for their TTL minus a buffer to ensure they don't expire mid-use.
 */

export const R2_CDN_URL = import.meta.env.VITE_R2_CDN_URL || 'https://pub-e8eb9b2155904feeb0e7c5e0712a87e2.r2.dev';

interface CachedToken {
  token: string;
  expires: number;
}

const TOKEN_CACHE_MAX = 50;
const tokenCache = new Map<string, CachedToken>();

// Buffer: refresh tokens 2 minutes before expiry
const REFRESH_BUFFER_S = 2 * 60;

/**
 * Get a cached token or fetch a new one.
 * Returns null if fetch fails (caller should handle gracefully).
 */
async function getToken(path: string): Promise<CachedToken | null> {
  const cached = tokenCache.get(path);
  const now = Date.now() / 1000;

  if (cached && cached.expires - REFRESH_BUFFER_S > now) {
    return cached;
  }

  try {
    const res = await fetch(`/api/video/token?path=${encodeURIComponent(path)}`);
    if (!res.ok) return cached ?? null; // Fall back to stale cache
    const data = await res.json() as { token: string; expires: number; path: string };
    const entry: CachedToken = { token: data.token, expires: data.expires };
    // Evict oldest entries if cache exceeds max size
    if (tokenCache.size >= TOKEN_CACHE_MAX) {
      const firstKey = tokenCache.keys().next().value;
      if (firstKey) tokenCache.delete(firstKey);
    }
    tokenCache.set(path, entry);
    return entry;
  } catch {
    return cached ?? null;
  }
}

/**
 * Build a signed video proxy URL.
 * Async because it may need to fetch a token.
 */
export async function getSignedVideoUrl(r2Path: string): Promise<string | null> {
  const tokenData = await getToken(r2Path);
  if (!tokenData) return null;
  return `/api/video/${r2Path}?token=${tokenData.token}&expires=${tokenData.expires}`;
}

/**
 * Pre-fetch tokens for multiple paths in parallel.
 * Call this on component mount to warm the cache.
 */
export async function prefetchVideoTokens(paths: string[]): Promise<void> {
  await Promise.allSettled(paths.map((p) => getToken(p)));
}

/**
 * Build a signed video URL synchronously if token is cached.
 * Returns the direct R2 CDN URL as fallback if no cached token.
 * This is used by the player which needs sync URLs at creation time.
 */
export function getSignedVideoUrlSync(r2Path: string, cdnFallback: string): string {
  const cached = tokenCache.get(r2Path);
  const now = Date.now() / 1000;

  if (cached && cached.expires > now) {
    return `/api/video/${r2Path}?token=${cached.token}&expires=${cached.expires}`;
  }

  // No cached token — fall back to CDN URL (will be replaced once token arrives)
  // Also trigger async fetch so it's ready next time
  getToken(r2Path);
  return `${cdnFallback}/${r2Path}`;
}

/**
 * Check if a token for a path is cached and still valid.
 */
export function hasValidToken(r2Path: string): boolean {
  const cached = tokenCache.get(r2Path);
  return !!cached && cached.expires > Date.now() / 1000;
}

/**
 * Clear all cached tokens (e.g., on auth change).
 */
export function clearVideoTokenCache(): void {
  tokenCache.clear();
}
