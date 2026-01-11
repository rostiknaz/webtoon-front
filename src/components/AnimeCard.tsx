import { Play, Star, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";

interface AnimeCardProps {
  anime: {
    id: string;
    title: string;
    image: string;
    rating: number;
    episodes: number;
    status: "ongoing" | "completed";
    latestEpisode?: string;
  };
}

const AnimeCard = ({ anime }: AnimeCardProps) => {
  return (
    <Link
      to="/serials/$serialId"
      params={{ serialId: anime.id }}
      className="group relative flex-shrink-0 w-[180px] md:w-[200px] cursor-pointer"
    >
      {/* Poster Container */}
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-card shadow-card transition-all duration-300 group-hover:shadow-hover group-hover:scale-[1.02]">
        {/* Image */}
        <img
          src={anime.image}
          alt={anime.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />

        {/* Status Badge */}
        <Badge
          className={`absolute top-2 left-2 text-xs ${
            anime.status === "ongoing"
              ? "bg-primary/90 text-primary-foreground"
              : "bg-accent/90 text-accent-foreground"
          }`}
        >
          {anime.status === "ongoing" ? "Ongoing" : "Completed"}
        </Badge>

        {/* Rating */}
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-md px-2 py-1">
          <Star className="h-3 w-3 fill-primary text-primary" />
          <span className="text-xs font-medium">{anime.rating}</span>
        </div>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center glow-primary transform scale-75 group-hover:scale-100 transition-transform duration-300">
            <Play className="h-6 w-6 text-primary-foreground fill-current ml-1" />
          </div>
        </div>

        {/* Episode Info */}
        {anime.latestEpisode && (
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-background to-transparent">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>EP {anime.latestEpisode}</span>
            </div>
          </div>
        )}
      </div>

      {/* Title & Info */}
      <div className="mt-3 px-1">
        <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
          {anime.title}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {anime.episodes} Episodes
        </p>
      </div>
    </Link>
  );
};

export default AnimeCard;
