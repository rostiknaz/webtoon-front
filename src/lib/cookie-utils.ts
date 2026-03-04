/**
 * Shared Cookie Utilities
 *
 * Common helpers for reading and decoding browser cookies.
 * Used by subscription-cookie.ts and credit-cookie.ts.
 */

/**
 * Base64 decode (URL-safe)
 */
export function b64Decode(str: string): string {
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
export function getCookie(name: string): string | null {
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
 * Parse a signed cookie's base64 payload (format: base64(payload).base64(signature))
 */
export function parseSignedCookiePayload<T>(cookieName: string): T | null {
  const cookieValue = getCookie(cookieName);
  if (!cookieValue) return null;

  try {
    const [payloadB64] = cookieValue.split('.');
    if (!payloadB64) return null;

    const payloadStr = b64Decode(payloadB64);
    if (!payloadStr) return null;

    return JSON.parse(payloadStr) as T;
  } catch {
    return null;
  }
}
