/**
 * Cookie Utilities
 *
 * Helper functions for checking cookie existence.
 * Used to optimize auth checks by avoiding unnecessary API calls.
 */

/**
 * Check if a cookie exists by name
 * Note: Cannot read HttpOnly cookie values, but can check non-HttpOnly cookies
 */
export function hasCookie(name: string): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some(c => c.trim().startsWith(`${name}=`));
}

/**
 * Check if user might have an active session based on cookie presence
 *
 * Better Auth sets these cookies:
 * - webtoon.session_token (HttpOnly - cannot check from JS)
 * - webtoon.session_data (cookie cache - CAN check from JS)
 *
 * If session_data cookie exists, user likely has a session.
 * If it doesn't exist, user is definitely a guest (no need for API call).
 */
export function mightHaveSession(): boolean {
  // Check for the cookie cache data (non-HttpOnly)
  return hasCookie('webtoon.session_data');
}
