import type { Episode } from "../types.ts";
import { ArrowLeft, Heart, List, Share2 } from "lucide-react";
import { Button } from "./ui/button";
import { Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import Hls from "hls.js";

export function VideoPlayer({ episode, seriesTitle, onOpenEpisodes, onPlayNext }: { episode: Episode; seriesTitle: string; onOpenEpisodes: () => void; onPlayNext: () => void }) {
    const [isLiked, setIsLiked] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const hideTimeoutRef = useRef<number | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const videoStatesRef = useRef<Map<string, { currentTime: number; wasPlaying: boolean }>>(new Map());

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

        // Set new timeout to hide controls after 5 seconds
        hideTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
        }, 5000);
    }).current;

    const handleInteraction = () => {
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

    // Get HLS URL for the episode
    // Priority: 1) hlsUrl directly, 2) construct from videoId, 3) fallback
    const getHlsUrl = () => {
        // Construct Cloudflare Stream URL from videoId
        if (episode.videoId) {
            // return `https://customer-m033z5x00ks6nunl.cloudflarestream.com/${episode.videoId}/manifest/video.m3u8`;
            return `https://customer-9u10nm8oora2n5zb.cloudflarestream.com/${episode.videoId}/manifest/video.m3u8`;
        }

        // Use hlsUrl if directly provided
        // if (episode.hlsUrl) {
        //     return episode.hlsUrl;
        // }

        // Fallback to test video
        return "https://customer-9u10nm8oora2n5zb.cloudflarestream.com/e173ed29029287118d810abce2ea35c5/manifest/video.m3u8";
    };

    const hlsUrl = getHlsUrl();

    // Initialize HLS and handle episode changes
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Save current video state before switching
        const saveCurrentState = () => {
            if (video && !video.paused) {
                videoStatesRef.current.set(episode._id, {
                    currentTime: video.currentTime,
                    wasPlaying: !video.paused,
                });
            }
        };

        // Check if HLS is supported
        if (Hls.isSupported()) {
            // Reuse existing HLS instance or create new one
            if (!hlsRef.current) {
                hlsRef.current = new Hls({
                    enableWorker: true,
                    lowLatencyMode: false,
                    backBufferLength: 90,
                });

                // Attach media element
                hlsRef.current.attachMedia(video);

                // Handle HLS errors
                hlsRef.current.on(Hls.Events.ERROR, (_event, data) => {
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                console.error('Network error encountered, trying to recover');
                                hlsRef.current?.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                console.error('Media error encountered, trying to recover');
                                hlsRef.current?.recoverMediaError();
                                break;
                            default:
                                console.error('Fatal error, destroying HLS instance');
                                hlsRef.current?.destroy();
                                hlsRef.current = null;
                                break;
                        }
                    }
                });
            }

            // Load the new source
            hlsRef.current.loadSource(hlsUrl);

            // Restore video state if returning to a previously played episode
            const savedState = videoStatesRef.current.get(episode._id);
            if (savedState) {
                video.currentTime = savedState.currentTime;
                if (savedState.wasPlaying) {
                    // Try to play, mute if autoplay fails
                    video.play().catch(() => {
                        // video.muted = true;
                        video.play().catch(err => console.error('Autoplay failed even when muted:', err));
                    });
                }
            } else {
                // New episode - try autoplay unmuted first, fall back to muted
                video.play().catch(() => {
                    video.muted = true;
                    video.play().catch(err => console.error('Autoplay failed even when muted:', err));
                });
            }
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            video.src = hlsUrl;

            const savedState = videoStatesRef.current.get(episode._id);
            if (savedState) {
                video.currentTime = savedState.currentTime;
                if (savedState.wasPlaying) {
                    // Try to play, mute if autoplay fails
                    video.play().catch(() => {
                        video.muted = true;
                        video.play().catch(err => console.error('Autoplay failed even when muted:', err));
                    });
                }
            } else {
                // New episode - try autoplay unmuted first, fall back to muted
                video.play().catch(() => {
                    video.muted = true;
                    video.play().catch(err => console.error('Autoplay failed even when muted:', err));
                });
            }
        }

        // Cleanup function - save state but don't destroy HLS instance
        return () => {
            saveCurrentState();
        };
    }, [episode._id, hlsUrl]);

    // Sync custom controls with native video player controls
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Video events that indicate user is interacting with native controls
        const videoInteractionEvents = [
            'play',
            'pause',
            'playing',
            'seeking',
            'seeked',
            'volumechange',
            'loadedmetadata',
            'canplay',
            'waiting',
            'stalled',
        ];

        // Show custom controls when user interacts with native controls
        const handleVideoInteraction = () => {
            resetHideTimer();
        };

        // Attach event listeners to video element
        videoInteractionEvents.forEach(event => {
            video.addEventListener(event, handleVideoInteraction);
        });

        // Cleanup
        return () => {
            videoInteractionEvents.forEach(event => {
                video.removeEventListener(event, handleVideoInteraction);
            });
        };
    }, [resetHideTimer]);

    // Cleanup HLS instance on unmount
    useEffect(() => {
        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, []);

    return (
        <div
            className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center"
            onMouseMove={handleInteraction}
        >
            {/* TikTok-style Vertical Video Player - 9:16 aspect ratio */}
            <div className="stream-container relative w-full h-full md:max-w-[55vh]">
                <video
                    ref={videoRef}
                    controls
                    playsInline
                    preload="auto"
                    onEnded={onPlayNext}
                    onClick={handleInteraction}
                    onTouchStart={handleInteraction}
                    onMouseMove={handleInteraction}
                    onPlay={handleInteraction}
                    onPause={handleInteraction}
                    className="w-full h-full object-contain relative z-20"
                />

                {/*/!* Transparent overlay to capture touch events when controls are hidden *!/*/}
                {/*{!showControls && (*/}
                {/*    <div*/}
                {/*        className="absolute inset-0 z-10"*/}
                {/*        onClick={handleInteraction}*/}
                {/*        onTouchEnd={handleInteraction}*/}
                {/*    />*/}
                {/*)}*/}
            </div>

            {/* TikTok-style Floating Action Buttons (Mobile & Desktop) */}
            <div
                className={`absolute bottom-20 md:bottom-24 right-4 flex flex-col gap-4 z-50 transition-opacity duration-300 ${
                    showControls ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ pointerEvents: showControls ? 'auto' : 'none' }}
            >
                {/* Like Button */}
                <div className="flex flex-col items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            setIsLiked(!isLiked);
                            resetHideTimer();
                        }}
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
                        onClick={() => {
                            onOpenEpisodes();
                            resetHideTimer();
                        }}
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
                        onClick={() => resetHideTimer()}
                        className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white"
                    >
                        <Share2 className="h-6 w-6" />
                    </Button>
                    <span className="text-white text-xs font-semibold drop-shadow-lg">Share</span>
                </div>
            </div>

            {/* Top Info Bar */}
            <div
                className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 md:p-6 z-50 transition-opacity duration-300 ${
                    showControls ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ pointerEvents: showControls ? 'auto' : 'none' }}
            >
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