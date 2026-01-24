import { Swords, Heart, Laugh, Ghost, Rocket, Crown, Sparkles, Flame } from "lucide-react";

const genres = [
  { name: "Action", icon: Swords, color: "from-red-500 to-orange-500" },
  { name: "Romance", icon: Heart, color: "from-pink-500 to-rose-500" },
  { name: "Comedy", icon: Laugh, color: "from-yellow-500 to-amber-500" },
  { name: "Horror", icon: Ghost, color: "from-purple-500 to-violet-500" },
  { name: "Sci-Fi", icon: Rocket, color: "from-cyan-500 to-blue-500" },
  { name: "Fantasy", icon: Crown, color: "from-emerald-500 to-teal-500" },
  { name: "Slice of Life", icon: Sparkles, color: "from-indigo-500 to-purple-500" },
  { name: "Shonen", icon: Flame, color: "from-orange-500 to-red-500" },
];

const GenreGrid = () => {
  return (
    <section id="genres" className="py-12 md:py-16">
      <div className="container">
        <div className="mb-8">
          <h2 className="font-display text-2xl md:text-3xl font-bold">Browse by Genre</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Find your next favorite anime by genre
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {genres.map((genre) => {
            const Icon = genre.icon;
            return (
              <button
                key={genre.name}
                type="button"
                aria-label={`Browse ${genre.name} anime`}
                className="group relative overflow-hidden rounded-xl bg-card p-6 text-left transition-all duration-300 hover:scale-[1.02] shadow-card hover:shadow-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {/* Background Gradient */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${genre.color} opacity-0 group-hover:opacity-20 group-focus-visible:opacity-20 transition-opacity duration-300`}
                />

                {/* Content */}
                <div className="relative z-10 flex flex-col items-center text-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-full bg-gradient-to-br ${genre.color} flex items-center justify-center transform group-hover:scale-110 group-focus-visible:scale-110 transition-transform duration-300`}
                  >
                    <Icon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  <span className="font-medium text-sm group-hover:text-foreground group-focus-visible:text-foreground transition-colors">
                    {genre.name}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default GenreGrid;
