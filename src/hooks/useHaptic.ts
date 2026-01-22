/**
 * Haptic Feedback Hook
 *
 * Provides haptic feedback patterns for different interactions.
 * Uses the Web Vibration API with graceful fallback for unsupported browsers.
 *
 * Browser Support:
 * - Android: Chrome, Edge, Firefox ✓
 * - iOS Safari: Not supported (security restriction)
 * - Desktop: Generally not supported (no vibration motor)
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API
 */

import { useCallback, useMemo } from 'react';

// Predefined haptic patterns (milliseconds)
// Using explicit type to allow mutable arrays for navigator.vibrate
const HAPTIC_PATTERNS: Record<string, number | number[]> = {
  // Light tap - for button presses, toggles
  light: 10,
  // Medium tap - for likes, selections
  medium: 25,
  // Standard tap - for confirmations
  tap: 50,
  // Success - double pulse for completed actions
  success: [50, 30, 50],
  // Error - triple short pulse
  error: [30, 20, 30, 20, 30],
  // Heavy - for important actions
  heavy: 100,
};

type HapticPattern = 'light' | 'medium' | 'tap' | 'success' | 'error' | 'heavy';

/**
 * Check if Vibration API is supported
 */
function isVibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Trigger haptic feedback with a predefined pattern or custom duration
 * @param pattern - Pattern name or custom duration in ms
 * @returns true if vibration was triggered, false if not supported
 */
function triggerHaptic(pattern: HapticPattern | number | number[]): boolean {
  if (!isVibrationSupported()) return false;

  try {
    const vibrationPattern = typeof pattern === 'string'
      ? HAPTIC_PATTERNS[pattern]
      : pattern;

    return navigator.vibrate(vibrationPattern);
  } catch {
    // Vibration can fail silently in some contexts (e.g., background tabs)
    return false;
  }
}

/**
 * Stop any ongoing vibration
 */
function stopHaptic(): boolean {
  if (!isVibrationSupported()) return false;
  return navigator.vibrate(0);
}

/**
 * Hook for haptic feedback with memoized handlers
 *
 * @example
 * const haptic = useHaptic();
 *
 * // Use predefined patterns
 * haptic.light();    // Button press
 * haptic.medium();   // Like action
 * haptic.tap();      // Standard feedback
 * haptic.success();  // Completed action
 *
 * // Custom duration
 * haptic.vibrate(75);
 */
export function useHaptic() {
  const isSupported = useMemo(() => isVibrationSupported(), []);

  const light = useCallback(() => triggerHaptic('light'), []);
  const medium = useCallback(() => triggerHaptic('medium'), []);
  const tap = useCallback(() => triggerHaptic('tap'), []);
  const success = useCallback(() => triggerHaptic('success'), []);
  const error = useCallback(() => triggerHaptic('error'), []);
  const heavy = useCallback(() => triggerHaptic('heavy'), []);
  const vibrate = useCallback((pattern: number | number[]) => triggerHaptic(pattern), []);
  const stop = useCallback(() => stopHaptic(), []);

  return {
    isSupported,
    light,
    medium,
    tap,
    success,
    error,
    heavy,
    vibrate,
    stop,
  };
}

// Export standalone functions for use outside React components
export { triggerHaptic, stopHaptic, isVibrationSupported, HAPTIC_PATTERNS };
