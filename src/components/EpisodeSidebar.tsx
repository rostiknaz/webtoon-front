import type { Episode, SeriesMetadata } from "../types.ts";
import { Play, Lock, Eye, Star, Clock } from "lucide-react";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

interface EpisodeSidebarProps {
    series: SeriesMetadata;
    episodes: Episode[];
    activeIndex: number;
    onSelect: (i: number) => void;
    onLockedClick?: () => void;
}

export function EpisodeSidebar({ series, episodes, activeIndex, onSelect, onLockedClick }: EpisodeSidebarProps) {
    const formatDuration = (seconds?: number) => {
        if (!seconds) return "N/A";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatViews = (views?: number) => {
        if (!views) return "0";
        if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
        if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
        return views.toString();
    };

    return (
        <div className="flex flex-col h-full">
            {/* Series Header */}
            <div className="p-4 md:p-6 border-b border-border">
                <h1 className="font-display text-2xl font-bold mb-2">{series.title}</h1>

                {/* Meta Info */}
                <div className="flex flex-wrap items-center gap-3 mb-3 text-sm text-muted-foreground">
                    {series.rating && (
                        <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-primary text-primary" />
                            <span className="font-semibold text-foreground">{series.rating}</span>
                        </div>
                    )}
                    {series.year && <span>{series.year}</span>}
                    {series.status && (
                        <Badge variant={series.status === 'ongoing' ? 'default' : 'secondary'} className="text-xs">
                            {series.status === 'ongoing' ? 'Ongoing' : 'Completed'}
                        </Badge>
                    )}
                    {series.totalViews && (
                        <div className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            <span>{formatViews(series.totalViews)} views</span>
                        </div>
                    )}
                </div>

                {/* Genres */}
                {series.genres && series.genres.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                        {series.genres.map((genre) => (
                            <Badge key={genre} variant="outline" className="text-xs">
                                {genre}
                            </Badge>
                        ))}
                    </div>
                )}

                {/* Description */}
                {series.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                        {series.description}
                    </p>
                )}

                {/* Additional Info */}
                {(series.director || series.cast) && (
                    <div className="text-xs text-muted-foreground space-y-1">
                        {series.director && (
                            <div>
                                <span className="font-semibold">Director:</span> {series.director}
                            </div>
                        )}
                        {series.cast && series.cast.length > 0 && (
                            <div>
                                <span className="font-semibold">Cast:</span> {series.cast.join(", ")}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Episodes List */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-4 md:p-6">
                    <h2 className="font-display text-lg font-semibold mb-4">
                        Episodes ({episodes.length})
                    </h2>

                    <div className="space-y-2">
                        {episodes.map((ep, i) => (
                            <button
                                key={ep._id}
                                onClick={() => ep.isLocked ? onLockedClick?.() : onSelect(i)}
                                className={cn(
                                    "w-full p-3 rounded-lg border transition-all duration-200 text-left cursor-pointer",
                                    "hover:shadow-md",
                                    i === activeIndex
                                        ? "bg-primary/10 border-primary shadow-md"
                                        : "bg-secondary/50 border-border hover:border-primary/50",
                                    ep.isLocked && "opacity-70"
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Thumbnail */}
                                    {ep.thumbnail ? (
                                        <div className="relative w-16 h-16 md:w-20 md:h-20 flex-shrink-0 rounded overflow-hidden bg-muted">
                                            <img
                                                src={ep.thumbnail}
                                                alt={ep.title || `Episode ${ep.episodeNumber}`}
                                                className="w-full h-full object-cover"
                                            />
                                            {ep.isLocked ? (
                                                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                                                    <Lock className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                            ) : (
                                                <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Play className="h-6 w-6 text-foreground fill-current" />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="w-16 h-16 md:w-20 md:h-20 flex-shrink-0 rounded bg-muted flex items-center justify-center">
                                            {ep.isLocked ? (
                                                <Lock className="h-5 w-5 text-muted-foreground" />
                                            ) : (
                                                <Play className="h-6 w-6 text-muted-foreground" />
                                            )}
                                        </div>
                                    )}

                                    {/* Episode Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h3 className="font-medium text-sm line-clamp-1">
                                                Episode {ep.episodeNumber}
                                                {i === activeIndex && (
                                                    <span className="ml-2 text-primary text-xs">● Playing</span>
                                                )}
                                            </h3>
                                        </div>

                                        {ep.title && (
                                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                                {ep.title}
                                            </p>
                                        )}

                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                            {ep.duration && (
                                                <div className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    <span>{formatDuration(ep.duration)}</span>
                                                </div>
                                            )}
                                            {ep.views && (
                                                <div className="flex items-center gap-1">
                                                    <Eye className="h-3 w-3" />
                                                    <span>{formatViews(ep.views)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
