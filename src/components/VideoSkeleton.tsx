/**
 * VideoSkeleton Component
 *
 * TikTok-style loading skeleton for video player.
 * Shows animated loading state while video is buffering/loading.
 *
 * Features:
 * - Pulsing gradient background
 * - Centered spinner animation
 * - Smooth fade-out transition when video is ready
 */

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface VideoSkeletonProps {
  isLoading: boolean;
}

export const VideoSkeleton = memo(function VideoSkeleton({
  isLoading,
}: VideoSkeletonProps) {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="absolute inset-0 bg-black flex items-center justify-center z-10 pointer-events-none"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {/* Subtle animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-b from-gray-900/30 via-black to-gray-900/30 animate-pulse" />

          {/* Center loading spinner */}
          <div className="relative z-10 flex flex-col items-center gap-3">
            {/* Spinner ring */}
            <div className="relative w-12 h-12">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full border-2 border-white/10" />
              {/* Animated spinner */}
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white/80 animate-spin" />
            </div>
          </div>

          {/* Bottom gradient (mimics player controls area) */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

          {/* Top gradient (mimics header area) */}
          <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/60 to-transparent" />
        </motion.div>
      )}
    </AnimatePresence>
  );
});
