import type { Episode } from "../types.ts";
import { ArrowLeft, Heart, List, Share2 } from "lucide-react";
import { Button } from "./ui/button";
import { Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Stream } from "@cloudflare/stream-react";

export function VideoPlayer({ episode, seriesTitle, onOpenEpisodes }: { episode: Episode; seriesTitle: string; onOpenEpisodes: () => void }) {
    const [isLiked, setIsLiked] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const hideTimeoutRef = useRef<number | null>(null);

    const formatNumber = (num?: number) => {
        if (!num) return "0";
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    const resetHideTimer = useRef(() => {
        // Clear existing timeout
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
        }

        // Show controls
        setShowControls(true);

        // Set new timeout to hide controls after 3 seconds
        hideTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
        }, 3000);
    }).current;

    const handleMouseMove = () => {
        resetHideTimer();
    };

    const handleClick = () => {
        resetHideTimer();
    };

    useEffect(() => {
        // Initialize hide timer on mount
        resetHideTimer();

        // Cleanup on unmount
        return () => {
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reset timer when episode changes
    useEffect(() => {
        resetHideTimer();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [episode._id]);

    // Extract Cloudflare Stream video ID
    // Priority: 1) episode.videoId, 2) extract from hlsUrl, 3) fallback to test video
    const getVideoId = () => {
        // Check if videoId is directly provided
        if (episode.videoId) {
            return episode.videoId;
        }

        // Try to extract from Cloudflare Stream URL
        if (episode.hlsUrl) {
            const match = episode.hlsUrl.match(/cloudflarestream\.com\/([^\/]+)\//);
            if (match) return match[1];
        }

        // Use the uploaded test video as fallback
        return "0d0460cec39afe9f9f1a0473f06300d1";
    };

    const videoId = getVideoId();

    return (
        <div
            className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center"
            onMouseMove={handleMouseMove}
            onClick={handleClick}
        >
            {/* TikTok-style Vertical Video Player - 9:16 aspect ratio */}
            <div className="relative w-full h-full max-w-[55vh]">
                <Stream
                    src={videoId}
                    controls={true}
                    autoplay={false}
                    muted={false}
                    loop={false}
                    preload="auto"
                    responsive={true}
                    height="100%"
                    width="100%"
                />
            </div>

            {/* TikTok-style Floating Action Buttons (Mobile & Desktop) */}
            <div className={`absolute bottom-20 md:bottom-24 right-4 flex flex-col gap-4 z-50 transition-opacity duration-300 ${
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}>
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
            <div className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 md:p-6 z-50 transition-opacity duration-300 ${
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}>
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