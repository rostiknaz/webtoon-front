import { ChevronLeft, ChevronRight } from "lucide-react";
import { MotionButton, buttonAnimations } from "@/components/ui/motion-button";
import AnimeCard from "./AnimeCard";
import { useRef } from "react";

interface Anime {
  slug: string;
  title: string;
  image: string;
  rating: number;
  episodes: number;
  status: "ongoing" | "completed";
  latestEpisode?: string;
}

interface CategorySectionProps {
  title: string;
  subtitle?: string;
  animeList: Anime[];
}

const CategorySection = ({ title, subtitle, animeList }: CategorySectionProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 420;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="py-8 md:py-12">
      <div className="container">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold">{title}</h2>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>

          {/* Navigation Arrows */}
          <div className="hidden md:flex items-center gap-2">
            <MotionButton
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full border border-border hover:border-primary hover:text-primary"
              onClick={() => scroll("left")}
              {...buttonAnimations.iconPulse}
            >
              <ChevronLeft className="h-5 w-5" />
            </MotionButton>
            <MotionButton
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full border border-border hover:border-primary hover:text-primary"
              onClick={() => scroll("right")}
              {...buttonAnimations.iconPulse}
            >
              <ChevronRight className="h-5 w-5" />
            </MotionButton>
          </div>
        </div>

        {/* Scrollable Container */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4"
        >
          {animeList.map((anime, index) => (
            <AnimeCard key={`${anime.slug}-${index}`} anime={anime} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategorySection;
