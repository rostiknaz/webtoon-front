/**
 * VideoSkeleton Component
 *
 * TikTok-style loading skeleton for video player.
 * Shows animated loading state while video is buffering/loading.
 *
 * Features:
 * - Shimmer effect with moving gradient
 * - Pulsing UI placeholder elements
 * - Smooth spinner animation
 * - Clean fade-out transition when video is ready
 */

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface VideoSkeletonProps {
  isLoading: boolean;
}

// Shimmer animation - moves gradient across the element
const shimmerVariants = {
  animate: {
    backgroundPosition: ["200% 0", "-200% 0"],
    transition: {
      duration: 2.5,
      ease: "linear" as const,
      repeat: Infinity,
    },
  },
};

// Pulse animation for UI placeholders
const pulseVariants = {
  animate: {
    opacity: [0.3, 0.6, 0.3],
    transition: {
      duration: 1.8,
      ease: "easeInOut" as const,
      repeat: Infinity,
    },
  },
};

// Staggered fade in for skeleton elements
const containerVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.25, ease: "easeOut" as const },
  },
};

const itemVariants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 },
  },
};

export const VideoSkeleton = memo(function VideoSkeleton({
  isLoading,
}: VideoSkeletonProps) {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-gray-950 via-black to-gray-950 flex items-center justify-center z-10 pointer-events-none overflow-hidden"
          variants={containerVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {/* Shimmer overlay effect */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)",
              backgroundSize: "200% 100%",
            }}
            variants={shimmerVariants}
            animate="animate"
          />

          {/* Top header skeleton */}
          <motion.div
            className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent"
            variants={itemVariants}
          >
            <div className="flex items-center gap-3">
              {/* Back button placeholder */}
              <motion.div
                className="w-10 h-10 rounded-full bg-white/10"
                variants={pulseVariants}
                animate="animate"
              />
              <div className="flex flex-col gap-2">
                {/* Title placeholder */}
                <motion.div
                  className="h-4 w-32 rounded bg-white/10"
                  variants={pulseVariants}
                  animate="animate"
                />
                {/* Subtitle placeholder */}
                <motion.div
                  className="h-3 w-24 rounded bg-white/5"
                  variants={pulseVariants}
                  animate="animate"
                  style={{ animationDelay: "0.2s" }}
                />
              </div>
            </div>
          </motion.div>

          {/* Center loading indicator */}
          <motion.div
            className="relative z-10 flex flex-col items-center gap-4"
            variants={itemVariants}
          >
            {/* Modern spinner with gradient */}
            <div className="relative w-14 h-14">
              {/* Outer glow ring */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: "conic-gradient(from 0deg, transparent, rgba(255,255,255,0.1))",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 3, ease: "linear", repeat: Infinity }}
              />
              {/* Inner spinning arc */}
              <motion.div
                className="absolute inset-1 rounded-full border-2 border-transparent"
                style={{
                  borderTopColor: "rgba(255,255,255,0.8)",
                  borderRightColor: "rgba(255,255,255,0.3)",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1, ease: "linear", repeat: Infinity }}
              />
              {/* Center dot pulse */}
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                variants={pulseVariants}
                animate="animate"
              >
                <div className="w-2 h-2 rounded-full bg-white/60" />
              </motion.div>
            </div>
          </motion.div>

          {/* Right side action buttons skeleton */}
          <motion.div
            className="absolute bottom-32 right-4 flex flex-col gap-6"
            variants={itemVariants}
          >
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <motion.div
                  className="w-12 h-12 rounded-full bg-white/10"
                  variants={pulseVariants}
                  animate="animate"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
                <motion.div
                  className="w-8 h-2 rounded bg-white/5"
                  variants={pulseVariants}
                  animate="animate"
                  style={{ animationDelay: `${i * 0.15 + 0.1}s` }}
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
              className="h-6 w-16 rounded-full bg-white/10"
              variants={pulseVariants}
              animate="animate"
            />
          </motion.div>

          {/* Bottom gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent" />
        </motion.div>
      )}
    </AnimatePresence>
  );
});
