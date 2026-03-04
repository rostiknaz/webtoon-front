/**
 * Swipe Gate Hook
 *
 * Derives whether to show the registration gate based on swipe count,
 * gate shown count, authentication state, and registration state.
 */

import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { useOptimizedSession } from '@/hooks/useOptimizedSession';

/** Number of swipes before the gate first appears */
export const SWIPE_GATE_THRESHOLD = 10;

/** Number of additional swipes before the gate reappears after dismissal */
export const SWIPE_GATE_REAPPEAR_INTERVAL = 8;

export function useSwipeGate() {
  const swipeCount = usePreferencesStore((s) => s.swipeCount);
  const gateShownCount = usePreferencesStore((s) => s.gateShownCount);
  const registered = usePreferencesStore((s) => s.registered);
  const incrementSwipeCount = usePreferencesStore((s) => s.incrementSwipeCount);
  const markGateShown = usePreferencesStore((s) => s.markGateShown);
  const markRegistered = usePreferencesStore((s) => s.markRegistered);

  const { data: session, isPending: isSessionLoading } = useOptimizedSession();
  const isAuthenticated = !!session;

  // Calculate the threshold for showing the gate:
  // First appearance at THRESHOLD, then every REAPPEAR_INTERVAL after each dismissal
  const currentThreshold = SWIPE_GATE_THRESHOLD + (gateShownCount * SWIPE_GATE_REAPPEAR_INTERVAL);

  const shouldShowGate =
    !registered &&
    !isAuthenticated &&
    !isSessionLoading && // never flash the gate while session is loading
    swipeCount >= currentThreshold;

  return {
    shouldShowGate,
    swipeCount,
    incrementSwipeCount,
    markGateShown,
    markRegistered,
    isAuthenticated,
  };
}
