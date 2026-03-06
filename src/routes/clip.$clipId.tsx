/**
 * Clip View Route — /clip/:clipId
 *
 * Fullscreen single-clip video player.
 * Shows the clip's video with overlay info (title, creator, stats)
 * and action buttons (like, download, share).
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getClip } from '@/api';
import { FeedOverlay } from '@/components/FeedOverlay';
import { getSignedVideoUrl, prefetchVideoTokens, R2_CDN_URL } from '@/lib/video-url';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { getGradientClass } from '@/lib/gradient';
import { queryOptions, useQuery } from '@tanstack/react-query';

function clipQueryOptions(clipId: string) {
  return queryOptions({
    queryKey: ['clip', clipId],
    queryFn: () => getClip(clipId),
    staleTime: 5 * 60 * 1000,
  });
}

export const Route = createFileRoute('/clip/$clipId')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(clipQueryOptions(params.clipId)),
  component: ClipViewPage,
});

function extractR2Path(videoUrl: string): string {
  return videoUrl.replace(R2_CDN_URL + '/', '');
}

function ClipViewPage() {
  const { clipId } = Route.useParams();
  const navigate = useNavigate();
  const { data: clip } = useQuery(clipQueryOptions(clipId));
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  // Fetch signed video URL
  useEffect(() => {
    if (!clip?.videoUrl) return;
    const r2Path = extractR2Path(clip.videoUrl);
    prefetchVideoTokens([r2Path]);
    getSignedVideoUrl(r2Path).then((url) => {
      if (url) setVideoSrc(url);
    });
  }, [clip?.videoUrl]);

  // Autoplay when src is ready
  useEffect(() => {
    if (videoSrc && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [videoSrc]);

  // Tap to pause/play
  const handleVideoTap = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setPaused(false);
    } else {
      video.pause();
      setPaused(true);
    }
  }, []);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate({ to: '/' });
    }
  }, [navigate]);

  const isDesktop = useIsDesktop();

  if (!clip) return null;

  const gradientClass = getGradientClass(clip._id);

  const player = (
    <div className="relative w-full h-full overflow-hidden" onClick={handleVideoTap}>
      {/* Brand gradient background — visible as loader or when no video */}
      <div className={`absolute inset-0 ${gradientClass}`} />

      {/* Video container — matches FeedSlide structure */}
      <div className="w-full h-full relative z-[1]">
        {/* Poster fallback while video loads */}
        {!videoSrc && clip.thumbnailUrl && (
          <img
            src={clip.thumbnailUrl}
            alt={clip.title}
            className="h-full w-full object-cover"
          />
        )}

        {/* Video */}
        {videoSrc && (
          <video
            ref={videoRef}
            src={videoSrc}
            poster={clip.thumbnailUrl ?? undefined}
            muted
            playsInline
            loop
            preload="auto"
            className="h-full w-full object-cover"
          />
        )}
      </div>

      {/* Pause indicator */}
      {paused && (
        <div className="absolute inset-0 z-[2] flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-7 h-7 text-white/80 ml-1" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* Back button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleBack();
        }}
        className="absolute top-4 left-4 z-20 p-2 rounded-full bg-black/30 backdrop-blur-sm text-white/80 hover:bg-black/50 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Bottom metadata overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-[66px] pt-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
        <h3 className="text-[15px] font-semibold text-white/92 leading-tight mb-[3px] tracking-[-0.01em]">
          {clip.title}
        </h3>
        <div className="text-[12px] text-white/40 font-normal">
          <span>{clip.creatorName}</span>
          {clip.duration && (
            <>
              <span className="mx-1.5">·</span>
              <span>{clip.duration}s</span>
            </>
          )}
        </div>
      </div>

      {/* Right-side action buttons */}
      <div className="absolute right-3 bottom-[120px] z-10" onClick={(e) => e.stopPropagation()}>
        <FeedOverlay
          clipId={clip._id}
          likeCount={clip.likes}
          downloadCount={clip.downloadCount}
          creatorName={clip.creatorName}
        />
      </div>
    </div>
  );

  /* Desktop: centered 9:16 column — matches feed layout */
  if (isDesktop) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="relative h-full max-h-full" style={{ aspectRatio: '9/16' }}>
          {player}
        </div>
      </div>
    );
  }

  return player;
}
