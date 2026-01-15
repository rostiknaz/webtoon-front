/**
 * Subscription Hook
 *
 * Reads subscription status from a signed cookie (set by server on login/subscribe).
 * Zero API calls - instant access control checks.
 *
 * The cookie is tamper-proof: users can read but cannot forge valid signatures.
 */

import { useMemo, useState, useCallback } from 'react';
import {
  hasActiveSubscription,
  getSubscriptionExpiry,
  getSubscriptionPlanId,
} from '@/lib/subscription-cookie';

/**
 * Hook to get user's subscription status from cookie
 *
 * - Reads from signed cookie (instant, no API call)
 * - Call `refresh()` after auth/subscribe to re-read the cookie
 * - Use `checkSubscriptionStatus()` for imperative checks (e.g., on episode switch)
 */
export function useSubscription() {
  // Version state to trigger re-computation when cookie changes
  const [version, setVersion] = useState(0);

  const data = useMemo(() => ({
    hasSubscription: hasActiveSubscription(),
    expiresAt: getSubscriptionExpiry(),
    planId: getSubscriptionPlanId(),
  }), [version]);

  // Call refresh() after login/subscribe to re-read the cookie
  const refresh = useCallback(() => {
    setVersion(v => v + 1);
    // Return fresh data immediately (useful for conditional logic after refresh)
    return {
      data: {
        hasSubscription: hasActiveSubscription(),
        expiresAt: getSubscriptionExpiry(),
        planId: getSubscriptionPlanId(),
      },
    };
  }, []);

  return {
    data,
    refresh,
    // Mimic React Query interface for compatibility
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
  };
}

/**
 * Imperative subscription check - call on specific actions
 *
 * Use this for checks on user actions like:
 * - Episode switching
 * - Video playback start
 * - Premium content access
 *
 * @returns Object with hasSubscription and whether it just expired
 */
export function checkSubscriptionStatus(): {
  hasSubscription: boolean;
  expiresAt: number;
  planId: string | null;
  justExpired: boolean;
} {
  const hasSubscription = hasActiveSubscription();
  const expiresAt = getSubscriptionExpiry();
  const planId = getSubscriptionPlanId();

  // Check if subscription just expired (had a plan but it's now expired)
  const justExpired = expiresAt > 0 && !hasSubscription;

  return {
    hasSubscription,
    expiresAt,
    planId,
    justExpired,
  };
}
