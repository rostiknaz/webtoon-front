/**
 * VideoSkeleton Component
 *
 * Premium loading skeleton for video player matching the brand design system.
 * Uses primary (orange) and accent (purple) colors for cohesive styling.
 *
 * Features:
 * - Brand-colored gradient shimmer effect
 * - Pulsing UI placeholder elements with glow
 * - Elegant spinner with primary/accent gradient
 * - Smooth spring-based fade-out transition
 */

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface VideoSkeletonProps {
  isLoading: boolean;
}

// Brand colors from design system
const COLORS = {
  primary: "hsl(10 85% 58%)",      // Orange-red
  accent: "hsl(280 75% 60%)",       // Purple
  background: "hsl(240 10% 6%)",    // Dark background
  muted: "hsl(240 10% 18%)",        // Muted gray
};

// Shimmer animation - premium gradient sweep
const shimmerVariants = {
  animate: {
    backgroundPosition: ["200% 0", "-200% 0"],
    transition: {
      duration: 3,
      ease: "linear" as const,
      repeat: Infinity,
    },
  },
};

// Pulse animation for UI placeholders - softer, more elegant
const pulseVariants = {
  animate: {
    opacity: [0.2, 0.5, 0.2],
    transition: {
      duration: 2.2,
      ease: "easeInOut" as const,
      repeat: Infinity,
    },
  },
};

// Glow pulse for accent elements
const glowPulseVariants = {
  animate: {
    opacity: [0.3, 0.7, 0.3],
    scale: [1, 1.02, 1],
    transition: {
      duration: 2.5,
      ease: "easeInOut" as const,
      repeat: Infinity,
    },
  },
};

// Skeleton container - VISIBLE IMMEDIATELY to prevent black screen flash
// The exit animation provides the smooth transition when video loads
const containerVariants = {
  initial: { opacity: 1 }, // Start fully visible (no fade-in delay)
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  },
};

// Item variants - start visible to prevent partial skeleton flash
const itemVariants = {
  initial: { opacity: 1, y: 0 }, // Start fully visible (no slide-in animation)
  animate: {
    opacity: 1,
    y: 0,
  },
};

export const VideoSkeleton = memo(function VideoSkeleton({
  isLoading,
}: VideoSkeletonProps) {
  return (
    <AnimatePresence mode="wait">
      {isLoading && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none overflow-hidden"
          style={{
            background: `linear-gradient(180deg, ${COLORS.background} 0%, hsl(240 10% 4%) 50%, ${COLORS.background} 100%)`,
          }}
          variants={containerVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {/* Subtle gradient ambient glow */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: `radial-gradient(ellipse 80% 50% at 50% 50%, ${COLORS.primary}15 0%, transparent 70%)`,
            }}
          />

          {/* Premium shimmer overlay - brand gradient */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${COLORS.primary}08 25%, ${COLORS.accent}06 50%, ${COLORS.primary}08 75%, transparent 100%)`,
              backgroundSize: "200% 100%",
            }}
            variants={shimmerVariants}
            animate="animate"
          />

          {/* Top header skeleton */}
          <motion.div
            className="absolute top-0 left-0 right-0 p-4"
            style={{
              background: `linear-gradient(to bottom, ${COLORS.background}cc, transparent)`,
            }}
            variants={itemVariants}
          >
            <div className="flex items-center gap-3">
              {/* Back button placeholder - subtle border glow */}
              <motion.div
                className="w-10 h-10 rounded-full"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.muted}40, ${COLORS.muted}20)`,
                  boxShadow: `inset 0 1px 0 ${COLORS.primary}10`,
                }}
                variants={pulseVariants}
                animate="animate"
              />
              <div className="flex flex-col gap-2">
                {/* Title placeholder */}
                <motion.div
                  className="h-4 w-32 rounded-md"
                  style={{
                    background: `linear-gradient(90deg, ${COLORS.muted}50, ${COLORS.muted}30)`,
                  }}
                  variants={pulseVariants}
                  animate="animate"
                />
                {/* Subtitle placeholder */}
                <motion.div
                  className="h-3 w-24 rounded-md"
                  style={{
                    background: `linear-gradient(90deg, ${COLORS.muted}30, ${COLORS.muted}15)`,
                  }}
                  variants={pulseVariants}
                  animate="animate"
                />
              </div>
            </div>
          </motion.div>

          {/* Center loading indicator - premium branded spinner */}
          <motion.div
            className="relative z-10 flex flex-col items-center gap-4"
            variants={itemVariants}
          >
            <div className="relative w-16 h-16">
              {/* Outer glow ring - brand gradient */}
              <motion.div
                className="absolute inset-0 rounded-full blur-sm"
                style={{
                  background: `conic-gradient(from 0deg, transparent, ${COLORS.primary}30, ${COLORS.accent}20, transparent)`,
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 4, ease: "linear", repeat: Infinity }}
              />
              {/* Main spinning arc - brand colors */}
              <motion.div
                className="absolute inset-1 rounded-full"
                style={{
                  background: `conic-gradient(from 0deg, ${COLORS.primary}, ${COLORS.accent}80, transparent 70%)`,
                  mask: "radial-gradient(transparent 55%, black 56%)",
                  WebkitMask: "radial-gradient(transparent 55%, black 56%)",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, ease: "linear", repeat: Infinity }}
              />
              {/* Inner glow pulse */}
              <motion.div
                className="absolute inset-3 rounded-full"
                style={{
                  background: `radial-gradient(circle, ${COLORS.primary}20 0%, transparent 70%)`,
                }}
                variants={glowPulseVariants}
                animate="animate"
              />
              {/* Center dot */}
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                variants={pulseVariants}
                animate="animate"
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: COLORS.primary }}
                />
              </motion.div>
            </div>
          </motion.div>

          {/* Right side action buttons skeleton */}
          <motion.div
            className="absolute bottom-32 right-4 flex flex-col gap-6"
            variants={itemVariants}
          >
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <motion.div
                  className="w-12 h-12 rounded-full backdrop-blur-sm"
                  style={{
                    background: `linear-gradient(135deg, ${COLORS.muted}50, ${COLORS.muted}25)`,
                    boxShadow: i === 0 ? `0 0 20px ${COLORS.primary}15` : undefined,
                  }}
                  variants={i === 0 ? glowPulseVariants : pulseVariants}
                  animate="animate"
                />
                <motion.div
                  className="w-8 h-2 rounded-full"
                  style={{
                    background: `${COLORS.muted}30`,
                  }}
                  variants={pulseVariants}
                  animate="animate"
                />
              </div>
            ))}
          </motion.div>

          {/* Episode indicator skeleton (top right) */}
          <motion.div
            className="absolute top-4 right-4"
            variants={itemVariants}
          >
            <motion.div
              className="h-7 w-16 rounded-full backdrop-blur-sm"
              style={{
                background: `linear-gradient(90deg, ${COLORS.muted}40, ${COLORS.muted}25)`,
                boxShadow: `inset 0 1px 0 ${COLORS.primary}08`,
              }}
              variants={pulseVariants}
              animate="animate"
            />
          </motion.div>

          {/* Bottom gradient - matches player controls area */}
          <div
            className="absolute bottom-0 left-0 right-0 h-40"
            style={{
              background: `linear-gradient(to top, ${COLORS.background}ee 0%, ${COLORS.background}80 40%, transparent 100%)`,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
});
