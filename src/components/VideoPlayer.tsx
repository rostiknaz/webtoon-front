import type { Episode } from "../types.ts";
import { ArrowLeft, Heart, List, Share2 } from "lucide-react";
import { Button } from "./ui/button";
import { Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import Player from "xgplayer";
import "xgplayer/dist/index.min.css";

interface VideoPlayerProps {
    episode: Episode;
    seriesTitle: string;
    onOpenEpisodes: () => void;
    onPlayNext: () => void;
}

export function VideoPlayer({ episode, seriesTitle, onOpenEpisodes, onPlayNext }: VideoPlayerProps) {
    const [isLiked, setIsLiked] = useState(false);
    const [showMobileControls, setShowMobileControls] = useState(false);
    const playerRef = useRef<Player | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const formatNumber = (num?: number) => {
        if (!num) return "0";
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    const handleVideoClick = () => {
        if (!playerRef.current) return;

        // Toggle play/pause
        if (playerRef.current.paused) {
            playerRef.current.play();
        } else {
            playerRef.current.pause();
        }
    };

    // Get HLS URL for the episode
    const getHlsUrl = () => {
        if (episode.videoId) {
            return `https://customer-9u10nm8oora2n5zb.cloudflarestream.com/${episode.videoId}/manifest/video.m3u8`;
        }
        return "https://customer-9u10nm8oora2n5zb.cloudflarestream.com/e173ed29029287118d810abce2ea35c5/manifest/video.m3u8";
    };

    // Initialize xgplayer once
    useEffect(() => {
        if (!containerRef.current) return;

        const hlsUrl = getHlsUrl();

        // Create player only if it doesn't exist
        if (!playerRef.current) {
            playerRef.current = new Player({
                el: containerRef.current,
                url: hlsUrl,

                // Autoplay settings
                autoplay: true,

                // Playback behavior
                loop: false,
                defaultPlaybackRate: 1,

                // Mobile/iOS compatibility
                playsinline: true,
                'x5-video-player-type': 'h5',
                'x5-video-orientation': 'portrait',
                'webkit-playsinline': true,

                // Click handling - disable defaults to avoid conflicts
                closeVideoClick: true,
                closeVideoDblclick: true,

                // Focus management - better for continuous playback
                closePauseVideoFocus: true,
                closePlayVideoFocus: true,

                // Layout & sizing
                fitVideoSize: 'fixWidth',
                cssFullscreen: true,
                fluid: true,

                // UI enhancements
                miniprogress: true,
                videoInit: true,

                // Control bar timing (matches 3-second custom timer)
                inactive: 3000,
                leavePlayerTime: 3000,

                // Mobile gestures
                mobile: {
                    gestureX: true,
                    gestureY: true,
                    pressRate: 2,
                    disableGesture: false,
                },

                // Keyboard shortcuts
                keyShortcut: true,
            });

            // Listen to player events
            playerRef.current.on('ended', () => {
                onPlayNext();
            });

            // Handle custom controls visibility with player focus/blur events
            playerRef.current.on('focus', () => {
                setShowMobileControls(true);
            });

            playerRef.current.on('blur', () => {
                setShowMobileControls(false);
            });
        }

        // Cleanup on unmount
        return () => {
            if (playerRef.current) {
                playerRef.current.destroy();
                playerRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update video source when episode changes
    useEffect(() => {
        if (playerRef.current) {
            const hlsUrl = getHlsUrl();
            playerRef.current.src = hlsUrl;
            playerRef.current.play();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [episode._id]);

    return (
        <div
            className="video-player-container relative w-full h-full bg-black overflow-hidden flex items-center justify-center"
            data-mobile-controls-visible={showMobileControls}
            onClick={handleVideoClick}
        >
            {/* xgplayer Video Container - Fixed width for desktop */}
            <div className="relative h-full w-full md:w-auto md:aspect-[9/16]">
                <div
                    ref={containerRef}
                    className="w-full h-full"
                />
            </div>

            {/* TikTok-style Floating Action Buttons */}
            <div className="custom-controls absolute bottom-24 md:bottom-32 right-4 flex flex-col gap-4 z-50" onClick={(e) => e.stopPropagation()}>
                {/* Like Button */}
                <div className="flex flex-col items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsLiked(!isLiked)}
                        className={`h-12 w-12 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-all ${
                            isLiked ? 'text-red-500' : 'text-white'
                        }`}
                    >
                        <Heart className={`h-6 w-6 ${isLiked ? 'fill-current' : ''}`} />
                    </Button>
                    <span className="text-white text-xs font-semibold drop-shadow-lg">
                        {formatNumber(episode.views ? Math.floor(episode.views / 10) : 45000)}
                    </span>
                </div>

                {/* Episodes Button */}
                <div className="flex flex-col items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onOpenEpisodes}
                        className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white md:hidden"
                    >
                        <List className="h-6 w-6" />
                    </Button>
                    <span className="text-white text-xs font-semibold drop-shadow-lg md:hidden">
                        {episode.episodeNumber}
                    </span>
                </div>

                {/* Share Button */}
                <div className="flex flex-col items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white"
                    >
                        <Share2 className="h-6 w-6" />
                    </Button>
                    <span className="text-white text-xs font-semibold drop-shadow-lg">Share</span>
                </div>
            </div>

            {/* Top Info Bar */}
            <div className="custom-controls absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 md:p-6 z-50" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link to="/">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-white hover:text-primary hover:bg-white/10"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <h3 className="text-white font-medium text-sm md:text-base">
                                {seriesTitle}
                            </h3>
                            <p className="text-gray-300 text-xs md:text-sm">
                                Episode {episode.episodeNumber}
                                {episode.title && ` - ${episode.title}`}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
