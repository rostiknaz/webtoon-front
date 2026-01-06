import Header from "@/components/Header";
import HeroSlider from "@/components/HeroSlider";
import CategorySection from "@/components/CategorySection";
import GenreGrid from "@/components/GenreGrid";
import Footer from "@/components/Footer";
import {
  featuredAnimeList,
  trendingAnime,
  newReleases,
  popularAnime,
} from "@/data/animeData";

const HomePage = () => {
  return (
      <div className="min-h-screen bg-background">
        <Header />

        <main>
          <HeroSlider animeList={featuredAnimeList} />

          <div id="trending">
            <CategorySection
                title="Trending Now"
                subtitle="Most watched anime this week"
                animeList={trendingAnime}
            />
          </div>

          <div id="new">
            <CategorySection
                title="New Releases"
                subtitle="Fresh episodes just dropped"
                animeList={newReleases}
            />
          </div>

          <GenreGrid />

          <CategorySection
              title="All Time Popular"
              subtitle="Classics that never get old"
              animeList={popularAnime}
          />
        </main>

        <Footer />
      </div>
  );
};

export default HomePage;
