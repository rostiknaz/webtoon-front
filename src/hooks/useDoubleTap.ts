import { useRef, useCallback } from 'react';

interface UseDoubleTapOptions {
  onDoubleTap: (position: { x: number; y: number }) => void;
  onSingleTap?: () => void;
  threshold?: number; // ms between taps (default: 300)
}

/**
 * Custom hook for detecting double-tap gestures on mobile and desktop.
 *
 * Uses PointerEvents for cross-device compatibility (touch + mouse).
 * Single tap executes IMMEDIATELY for responsive feel.
 * Double tap is detected when second tap comes within threshold.
 *
 * @example
 * const { handlers } = useDoubleTap({
 *   onDoubleTap: (pos) => console.log('Double tap at', pos),
 *   onSingleTap: () => console.log('Single tap'),
 *   threshold: 300
 * });
 *
 * <div {...handlers}>Content</div>
 */
export function useDoubleTap({
  onDoubleTap,
  onSingleTap,
  threshold = 300
}: UseDoubleTapOptions) {
  const lastTapTimeRef = useRef<number>(0);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // Only handle primary pointer (left click / first touch)
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;
    const position = { x: e.clientX, y: e.clientY };

    // Check if this is a double-tap (second tap within threshold)
    if (timeSinceLastTap < threshold && timeSinceLastTap > 50) {
      // Double-tap detected
      onDoubleTap(position);

      // Reset to prevent triple-tap from triggering another double-tap
      lastTapTimeRef.current = 0;
    } else {
      // First tap - execute single tap IMMEDIATELY for responsive feel
      // Record time for potential double-tap detection
      lastTapTimeRef.current = now;

      // Execute single tap right away (no delay)
      if (onSingleTap) {
        onSingleTap();
      }
    }
  }, [onDoubleTap, onSingleTap, threshold]);

  return {
    handlers: {
      onPointerUp: handlePointerUp,
    },
  };
}
