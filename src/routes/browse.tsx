/**
 * Browse Route — /browse
 *
 * Grid view for purposeful clip discovery with search, sort, and category filters.
 * - Mobile: 2-col grid with bottom nav
 * - Tablet: 3-col grid
 * - Desktop: 4-5 col grid with side nav
 */

import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { z } from 'zod';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { NsfwToggle } from '@/components/NsfwToggle';
import { useNsfwToggle } from '@/hooks/useNsfwToggle';

import { ClipCard } from '@/components/ClipCard';
import { BottomNav, SideNavItems, SideCategoryItem } from '@/components/BottomNav';
import { CategoryChips } from '@/components/CategoryChips';
import { useFeed, feedQueryOptions } from '@/hooks/useFeed';
import { useCategories, categoriesQueryOptions } from '@/hooks/useCategories';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { Skeleton } from '@/components/ui/skeleton';

const browseSearchSchema = z.object({
  category: z.string().optional().catch(undefined),
  sort: z.enum(['latest', 'popular', 'trending']).optional().catch(undefined),
  search: z.string().optional().catch(undefined),
  nsfw: z.enum(['safe', 'all']).optional().catch(undefined),
});

export const Route = createFileRoute('/browse')({
  validateSearch: browseSearchSchema,
  loaderDeps: ({ search }) => ({
    category: search.category,
    sort: search.sort,
    search: search.search,
    nsfw: search.nsfw,
  }),
  loader: ({ context: { queryClient }, deps: { category, sort, search, nsfw } }) => {
    return Promise.all([
      queryClient.prefetchInfiniteQuery(feedQueryOptions({ category, sort, search, nsfw })),
      queryClient.ensureQueryData(categoriesQueryOptions()),
    ]);
  },
  component: BrowsePage,
});

const sortOptions = [
  { value: 'latest', label: 'New' },
  { value: 'popular', label: 'Popular' },
  { value: 'trending', label: 'Trending' },
] as const;

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

function BrowsePage() {
  const { category, sort = 'latest', search } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { nsfwParam } = useNsfwToggle();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useFeed({
    category,
    sort,
    search,
    nsfw: nsfwParam,
  });
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.categories ?? [];

  const clips = useMemo(
    () => data?.pages.flatMap((page) => page.clips) ?? [],
    [data],
  );

  // Search with debounce
  const [searchInput, setSearchInput] = useState(search ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        navigate({
          search: (prev) => ({ ...prev, search: value || undefined }),
          replace: true,
        });
      }, 300);
    },
    [navigate],
  );

  const clearSearch = useCallback(() => {
    setSearchInput('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navigate({ search: (prev) => ({ ...prev, search: undefined }), replace: true });
  }, [navigate]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Sort toggle
  const handleSortChange = useCallback(
    (newSort: string) => {
      navigate({ search: (prev) => ({ ...prev, sort: newSort as 'latest' | 'popular' | 'trending' }), replace: true });
    },
    [navigate],
  );

  // Category filter
  const handleCategoryChange = useCallback(
    (categoryId: string | undefined) => {
      navigate({ search: (prev) => ({ ...prev, category: categoryId }), replace: true });
    },
    [navigate],
  );

  // Infinite scroll via IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const isDesktop = useIsDesktop();

  return (
    <div className="fixed inset-0 bg-[hsl(240_8%_3%)] flex">
      {/* Desktop side nav */}
      {isDesktop && (
        <div className="w-[280px] h-full bg-[hsl(240_10%_6%)] border-r border-white/6 flex flex-col overflow-y-auto shrink-0">
          <div className="px-6 pt-8 pb-6">
            <span className="text-[20px] font-bold text-white/90 tracking-[-0.02em]">
              aniclip
            </span>
          </div>
          <SideNavItems />
          <div className="mx-6 h-px bg-white/6 mb-6" />
          <div className="px-6 mb-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30 mb-3">Categories</h4>
            <div className="flex flex-col gap-1">
              <SideCategoryItem name="All" active={category === undefined} onClick={() => handleCategoryChange(undefined)} />
              {categories.map((cat) => (
                <SideCategoryItem key={cat.id} name={cat.name} active={category === cat.id} onClick={() => handleCategoryChange(cat.id)} />
              ))}
            </div>
          </div>
          <div className="mx-6 h-px bg-white/6 mb-4" />
          <div className="px-6 mb-6 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30">Content</span>
            <NsfwToggle />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 h-full overflow-y-auto pb-[60px]">
        {/* Header + search */}
        <div className="sticky top-0 z-30 bg-[hsl(240_8%_3%)]/95 backdrop-blur-sm">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
            {/* Search bar */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" strokeWidth={1.5} />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search clips..."
                className="w-full pl-9 pr-9 py-2 rounded-lg bg-white/6 border border-white/6 text-[13px] text-white/85 placeholder:text-white/25 focus:outline-none focus:border-white/15 transition-colors"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              )}
            </div>
            <NsfwToggle />
            </div>
          </div>

          {/* Sort toggle */}
          <div className="px-4 pb-1">
            <div className="flex gap-1 p-0.5 rounded-lg bg-white/4 w-fit">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSortChange(option.value)}
                  className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                    sort === option.value
                      ? 'bg-white/12 text-white/90 shadow-sm'
                      : 'text-white/35 hover:text-white/60'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category chips — mobile only */}
          {!isDesktop && (
            <CategoryChips
              categories={categories}
              activeCategory={category}
              onCategoryChange={handleCategoryChange}
            />
          )}
        </div>

        {/* Grid */}
        <div className="px-3 pt-2">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="aspect-video rounded-lg" />
                  <Skeleton className="h-3 w-3/4 mt-2 rounded" />
                  <Skeleton className="h-2.5 w-1/2 mt-1 rounded" />
                </div>
              ))}
            </div>
          ) : clips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Search className="w-10 h-10 text-white/15 mb-4" strokeWidth={1.5} />
              <p className="text-[15px] text-white/50 font-medium">No clips found</p>
              <p className="text-[13px] text-white/25 mt-1">Try a different search or explore other categories</p>
            </div>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              <AnimatePresence mode="popLayout">
                {clips.map((clip) => (
                  <ClipCard key={clip._id} clip={clip} showNsfwIndicator={nsfwParam === 'all'} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-4" />

          {/* Loading more indicator */}
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-white/15 border-t-white/50 rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom nav */}
      {!isDesktop && <BottomNav />}
    </div>
  );
}

