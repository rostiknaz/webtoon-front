/**
 * Shared subscription utilities
 *
 * Pure functions for subscription logic used by both worker and lib code.
 */

/**
 * Check if subscription grants access based on expiration time
 * Access is purely time-based, status is informational only
 *
 * @param currentPeriodEnd - Unix timestamp (seconds) when subscription expires
 * @returns true if subscription has not expired
 */
export function subscriptionHasAccess(currentPeriodEnd: number | null): boolean {
  if (!currentPeriodEnd) return false;
  return currentPeriodEnd > Math.floor(Date.now() / 1000);
}
