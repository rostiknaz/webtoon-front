import { Play, Plus, Star, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface HeroSectionProps {
  anime: {
    title: string;
    description: string;
    rating: number;
    episodes: number;
    year: number;
    genres: string[];
    image: string;
  };
}

const HeroSection = ({ anime }: HeroSectionProps) => {
  return (
    <section className="relative min-h-[85vh] flex items-end pb-20 pt-32 overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src={anime.image}
          alt={anime.title}
          className="w-full h-full object-cover object-center"
        />
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="container relative z-10">
        <div className="max-w-2xl animate-slide-up">
          {/* Featured Badge */}
          <Badge className="mb-4 bg-primary/20 text-primary border-primary/30 hover:bg-primary/30">
            Featured Anime
          </Badge>

          {/* Title */}
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-4 leading-tight">
            {anime.title}
          </h1>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1 text-primary">
              <Star className="h-4 w-4 fill-primary" />
              <span className="font-semibold text-foreground">{anime.rating}</span>
            </div>
            <span>{anime.year}</span>
            <span>{anime.episodes} Episodes</span>
            <div className="flex gap-2">
              {anime.genres.map((genre) => (
                <Badge key={genre} variant="outline" className="text-xs border-border">
                  {genre}
                </Badge>
              ))}
            </div>
          </div>

          {/* Description */}
          <p className="text-muted-foreground text-base md:text-lg mb-8 line-clamp-3">
            {anime.description}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4">
            <Button size="lg" className="gap-2 glow-primary">
              <Play className="h-5 w-5 fill-current" />
              Watch Now
            </Button>
            <Button size="lg" variant="secondary" className="gap-2">
              <Plus className="h-5 w-5" />
              Add to List
            </Button>
            <Button size="lg" variant="ghost" className="gap-2">
              <Info className="h-5 w-5" />
              More Info
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
