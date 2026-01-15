/**
 * Client-side Subscription Cookie Reader
 *
 * Reads the signed subscription cookie set by the server.
 * The cookie is tamper-proof (signed), but we only read it here.
 * No verification needed on client - server validates on API calls.
 */

const COOKIE_NAME = 'webtoon.sub';

interface SubscriptionPayload {
  exp: number; // Unix timestamp when subscription expires (0 = no subscription)
  pid: string | null; // Plan ID
}

/**
 * Base64 decode (URL-safe)
 */
function b64Decode(str: string): string {
  try {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/');
    return atob(padded);
  } catch {
    return '';
  }
}

/**
 * Get a cookie value by name
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [cookieName, ...cookieValue] = cookie.split('=');
    if (cookieName.trim() === name) {
      return cookieValue.join('=').trim();
    }
  }
  return null;
}

/**
 * Parse the subscription cookie payload
 *
 * @returns Subscription payload or null if cookie doesn't exist/is invalid
 */
export function parseSubscriptionCookie(): SubscriptionPayload | null {
  const cookieValue = getCookie(COOKIE_NAME);
  if (!cookieValue) return null;

  try {
    const [payloadB64] = cookieValue.split('.');
    if (!payloadB64) return null;

    const payloadStr = b64Decode(payloadB64);
    if (!payloadStr) return null;

    return JSON.parse(payloadStr) as SubscriptionPayload;
  } catch {
    return null;
  }
}

/**
 * Check if user has an active subscription based on cookie
 *
 * @returns true if subscription is active and not expired
 */
export function hasActiveSubscription(): boolean {
  const payload = parseSubscriptionCookie();
  if (!payload || payload.exp === 0) return false;

  const now = Math.floor(Date.now() / 1000);
  return payload.exp > now;
}

/**
 * Get subscription expiration timestamp from cookie
 *
 * @returns Unix timestamp or 0 if no subscription
 */
export function getSubscriptionExpiry(): number {
  const payload = parseSubscriptionCookie();
  return payload?.exp ?? 0;
}

/**
 * Get plan ID from subscription cookie
 *
 * @returns Plan ID or null if no subscription
 */
export function getSubscriptionPlanId(): string | null {
  const payload = parseSubscriptionCookie();
  return payload?.pid ?? null;
}

/**
 * Check if subscription cookie exists (user might have subscription)
 *
 * Useful for optimistic checks before making API calls.
 * Note: Cookie existing doesn't mean it's valid/not expired.
 */
export function hasSubscriptionCookie(): boolean {
  return getCookie(COOKIE_NAME) !== null;
}
