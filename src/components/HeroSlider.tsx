import { useEffect, useState, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Play, Plus, Star, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

interface FeaturedAnime {
  id: string;
  title: string;
  description: string;
  rating: number;
  episodes: number;
  year: number;
  genres: string[];
  image: string;
}

interface HeroSliderProps {
  animeList: FeaturedAnime[];
}

const HeroSlider = ({ animeList }: HeroSliderProps) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 6000, stopOnInteraction: false }),
  ]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
      setIsAnimating(false);
      setTimeout(() => setIsAnimating(true), 50);
    };

    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  return (
    <section className="relative min-h-[90vh] overflow-hidden">
      {/* Carousel Container */}
      <div ref={emblaRef} className="overflow-hidden h-full">
        <div className="flex h-full">
          {animeList.map((anime, index) => (
            <div
              key={index}
              className="relative flex-[0_0_100%] min-w-0 min-h-[90vh]"
            >
              {/* Background Image */}
              <div className="absolute inset-0 z-0">
                <img
                  src={anime.image}
                  alt={anime.title}
                  className={cn(
                    "w-full h-full object-cover object-center transition-transform duration-[8000ms] ease-out",
                    selectedIndex === index && "scale-110"
                  )}
                />
                {/* Gradient Overlays */}
                <div className="absolute inset-0 bg-linear-to-t from-background/60 to-transparent" />
                <div className="absolute inset-0 bg-linear-to-r from-background/50 via-transparent to-transparent" />
              </div>

              {/* Content */}
              <div className="container relative z-10 h-full flex items-end pb-32 pt-32">
                <div
                  className={cn(
                    "max-w-2xl transition-all duration-700",
                    selectedIndex === index && isAnimating
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-8"
                  )}
                >
                  {/* Featured Badge */}
                  <Badge
                    className={cn(
                      "mb-4 bg-primary/20 text-primary border-primary/30 hover:bg-primary/30 transition-all duration-500 delay-100",
                      selectedIndex === index && isAnimating
                        ? "opacity-100 translate-x-0"
                        : "opacity-0 -translate-x-4"
                    )}
                  >
                    Featured Anime
                  </Badge>

                  {/* Title */}
                  <h1
                    className={cn(
                      "font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-4 leading-tight transition-all duration-700 delay-150",
                      selectedIndex === index && isAnimating
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-6"
                    )}
                  >
                    {anime.title}
                  </h1>

                  {/* Meta Info */}
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-4 mb-4 text-sm text-muted-foreground transition-all duration-700 delay-200",
                      selectedIndex === index && isAnimating
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-4"
                    )}
                  >
                    <div className="flex items-center gap-1 text-primary">
                      <Star className="h-4 w-4 fill-primary" />
                      <span className="font-semibold text-foreground">
                        {anime.rating}
                      </span>
                    </div>
                    <span>{anime.year}</span>
                    <span>{anime.episodes} Episodes</span>
                    <div className="flex gap-2">
                      {anime.genres.map((genre) => (
                        <Badge
                          key={genre}
                          variant="outline"
                          className="text-xs border-border"
                        >
                          {genre}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <p
                    className={cn(
                      "text-foreground/90 text-base md:text-lg mb-8 line-clamp-3 transition-all duration-700 delay-300 drop-shadow-lg",
                      selectedIndex === index && isAnimating
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-4"
                    )}
                  >
                    {anime.description}
                  </p>

                  {/* Action Buttons */}
                  <div
                    className={cn(
                      "flex flex-wrap gap-4 transition-all duration-700 delay-[400ms]",
                      selectedIndex === index && isAnimating
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-4"
                    )}
                  >
                    <Link to="/serials/$serialId" params={{ serialId: anime.id }}>
                      <Button size="lg" className="gap-2 glow-primary">
                        <Play className="h-5 w-5 fill-current" />
                        Watch Now
                      </Button>
                    </Link>
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
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Arrows */}
      <div className="absolute bottom-32 right-8 md:right-16 z-20 hidden md:flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={scrollPrev}
          className="h-12 w-12 rounded-full border border-border/50 bg-background/30 backdrop-blur-sm hover:bg-primary hover:border-primary transition-all duration-300"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={scrollNext}
          className="h-12 w-12 rounded-full border border-border/50 bg-background/30 backdrop-blur-sm hover:bg-primary hover:border-primary transition-all duration-300"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      {/* Pagination Dots */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
        {animeList.map((_, index) => (
          <button
            key={index}
            onClick={() => scrollTo(index)}
            className={cn(
              "relative h-2 rounded-full transition-all duration-500 overflow-hidden",
              selectedIndex === index
                ? "w-12 bg-primary"
                : "w-2 bg-foreground/30 hover:bg-foreground/50"
            )}
          >
            {selectedIndex === index && (
              <span className="absolute inset-0 bg-primary/50 animate-[shimmer_6s_linear_infinite] bg-[length:200%_100%] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            )}
          </button>
        ))}
      </div>

      {/* Slide Counter */}
      <div className="absolute bottom-12 right-8 md:right-16 z-20 text-sm text-muted-foreground">
        <span className="text-foreground font-semibold">
          {String(selectedIndex + 1).padStart(2, "0")}
        </span>
        <span className="mx-2">/</span>
        <span>{String(animeList.length).padStart(2, "0")}</span>
      </div>
    </section>
  );
};

export default HeroSlider;
