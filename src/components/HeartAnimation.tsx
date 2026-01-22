import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';

interface HeartAnimationProps {
  /** Whether to show the animation */
  show: boolean;
  /** X coordinate (viewport-relative) where heart appears */
  x: number;
  /** Y coordinate (viewport-relative) where heart appears */
  y: number;
  /** Target position for the heart to fly to (like button) */
  targetPosition?: { x: number; y: number } | null;
  /** Called when animation completes */
  onComplete: () => void;
}

/**
 * Instagram-style heart animation that appears on double-tap.
 *
 * Features:
 * - Scales up with overshoot (spring-like feel)
 * - Flies to like button while shrinking
 * - Fades out at destination
 * - Positioned at tap location
 */
export function HeartAnimation({
  show,
  x,
  y,
  targetPosition,
  onComplete
}: HeartAnimationProps) {
  // Heart starts at 96px, ends at 24px at destination
  const startSize = 96;
  const endSize = 24;

  // Calculate offsets to center the heart
  const startOffsetX = x - startSize / 2;
  const startOffsetY = y - startSize / 2;

  // Calculate the movement distance to target
  const deltaX = targetPosition ? targetPosition.x - x : 0;
  const deltaY = targetPosition ? targetPosition.y - y : 0;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed pointer-events-none z-[100]"
          style={{
            left: startOffsetX,
            top: startOffsetY,
            width: startSize,
            height: startSize,
          }}
          initial={{
            scale: 0,
            opacity: 1,
            x: 0,
            y: 0,
          }}
          animate={{
            scale: [0, 1.3, 1, endSize / startSize],
            opacity: [1, 1, 1, 0],
            x: [0, 0, 0, deltaX],
            y: [0, 0, 0, deltaY],
          }}
          transition={{
            duration: 1.4,
            times: [0, 0.15, 0.3, 1], // Pop in quickly, then slow fly
            ease: [0.25, 0.1, 0.25, 1], // Smooth ease for flying portion
          }}
          onAnimationComplete={onComplete}
        >
          <Heart
            className="w-full h-full text-red-500 fill-red-500"
            style={{
              filter: 'drop-shadow(0 4px 12px rgba(239, 68, 68, 0.5))',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
