import type { Episode } from "../types.ts";
import { Play, Volume2, Maximize, SkipForward, SkipBack, Settings, ArrowLeft, Heart, List, Share2 } from "lucide-react";
import { Button } from "./ui/button";
import { Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";

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

    // This is a placeholder video player - in production, integrate with a real player like video.js or plyr
    return (
        <div
            className="relative w-full h-full flex items-center justify-center bg-black"
            onMouseMove={handleMouseMove}
            onClick={handleClick}
        >
            {/* Video Placeholder */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center">
                {episode.thumbnail ? (
                    <img
                        src={episode.thumbnail}
                        alt={`Episode ${episode.episodeNumber}`}
                        className="w-full h-full object-contain opacity-40 blur-sm"
                    />
                ) : (
                    <div className="text-6xl text-gray-700">
                        <Play className="w-32 h-32" />
                    </div>
                )}
            </div>

            {/* Overlay Content */}
            <div className="relative z-10 text-center text-white">
                <div className="mb-4">
                    <Play className="w-20 h-20 mx-auto mb-4 opacity-80" />
                    <h2 className="text-2xl font-display font-bold mb-2">{seriesTitle}</h2>
                    <p className="text-lg text-gray-300">
                        Episode {episode.episodeNumber}
                        {episode.title && `: ${episode.title}`}
                    </p>
                </div>
                {episode.hlsUrl ? (
                    <div className="text-sm text-gray-400 mt-4">
                        <p>Video Player Ready</p>
                        <p className="text-xs mt-1">HLS URL: {episode.hlsUrl}</p>
                    </div>
                ) : (
                    <div className="text-sm text-red-400 mt-4">
                        <p>No video URL available</p>
                    </div>
                )}
            </div>

            {/* TikTok-style Floating Action Buttons (Mobile & Desktop) */}
            <div className={`absolute bottom-32 md:bottom-40 right-4 flex flex-col gap-4 z-20 transition-opacity duration-300 ${
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

            {/* Video Controls Overlay */}
            <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 md:p-6 transition-opacity duration-300 ${
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}>
                {/* Progress Bar */}
                <div className="mb-4">
                    <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full w-1/3 bg-primary rounded-full"></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>0:45</span>
                        <span>
                            {episode.duration ? `${Math.floor(episode.duration / 60)}:${(episode.duration % 60).toString().padStart(2, '0')}` : '1:30'}
                        </span>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="text-white hover:text-primary">
                            <SkipBack className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-white hover:text-primary h-12 w-12">
                            <Play className="h-6 w-6 fill-current" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-white hover:text-primary">
                            <SkipForward className="h-5 w-5" />
                        </Button>
                    </div>

                    <div className="hidden sm:flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="text-white hover:text-primary">
                            <Volume2 className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-white hover:text-primary">
                            <Settings className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-white hover:text-primary">
                            <Maximize className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Top Info Bar */}
            <div className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 md:p-6 transition-opacity duration-300 ${
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