/**
 * Feed Route — /feed
 *
 * Fullscreen vertical swipe feed with auto-play.
 * - Mobile: fullscreen feed, category filter in drawer (opened via right-side filter button), bottom nav
 * - Desktop: full screen with centered vertical video + Swiper slideable side menu with nav + filters
 */

import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState, useCallback, useRef } from 'react';
import { z } from 'zod';
import { Menu, X } from 'lucide-react';
import { Swiper as SwiperComponent, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css/bundle';

import { FeedPlayer } from '@/components/FeedPlayer';
import { BottomNav, SideNavItems, SideCategoryItem } from '@/components/BottomNav';
import { useFeed, feedQueryOptions } from '@/hooks/useFeed';
import { useCategories, categoriesQueryOptions } from '@/hooks/useCategories';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';

const feedSearchSchema = z.object({
  category: z.string().optional().catch(undefined),
});

export const Route = createFileRoute('/feed')({
  validateSearch: feedSearchSchema,
  loaderDeps: ({ search }) => ({ category: search.category }),
  loader: ({ context: { queryClient }, deps: { category } }) => {
    return Promise.all([
      queryClient.prefetchInfiniteQuery(feedQueryOptions({ category })),
      queryClient.ensureQueryData(categoriesQueryOptions()),
    ]);
  },
  component: FeedPage,
});

function FeedPage() {
  const { category } = Route.useSearch();
  const navigate = Route.useNavigate();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeed({ category });
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.categories ?? [];

  const clips = useMemo(
    () => data?.pages.flatMap((page) => page.clips) ?? [],
    [data],
  );

  const handleCategoryChange = useCallback(
    (categoryId: string | undefined) => {
      navigate({ search: (prev) => ({ ...prev, category: categoryId }), replace: true });
    },
    [navigate],
  );

  const handleLoadMore = useCallback(() => {
    if (!isFetchingNextPage) fetchNextPage();
  }, [isFetchingNextPage, fetchNextPage]);

  // Mobile filter drawer
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Creator drawer (triggered from FeedSlide tapping creator name)
  const [drawerCreatorId, setDrawerCreatorId] = useState<string | null>(null);
  const handleCreatorTap = useCallback((creatorId: string) => setDrawerCreatorId(creatorId), []);
  const handleCreatorDrawerClose = useCallback((open: boolean) => { if (!open) setDrawerCreatorId(null); }, []);

  // Desktop slideable menu
  const menuSwiperRef = useRef<SwiperType | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    if (!menuSwiperRef.current) return;
    if (menuOpen) menuSwiperRef.current.slideNext();
    else menuSwiperRef.current.slidePrev();
  }, [menuOpen]);

  const handleMenuSlideChange = useCallback((swiper: SwiperType) => {
    setMenuOpen(swiper.activeIndex === 0);
  }, []);

  // Active category label for the filter button badge
  const activeCategoryName = useMemo(() => {
    if (!category) return undefined;
    return categories.find((c) => c.id === category)?.name;
  }, [category, categories]);

  const isDesktop = useIsDesktop();

  return (
    <div className="fixed inset-0 bg-[hsl(240_8%_3%)]">

      {/* ══════ MOBILE LAYOUT ══════ */}
      {!isDesktop && <div className="relative w-full h-full bg-[hsl(240_10%_4%)]">
        {/* Top bar — wordmark only */}
        <div className="absolute top-0 left-0 right-0 z-40 pt-6 px-4">
          <span className="text-[15px] font-semibold text-white/85 tracking-[-0.01em]">
            aniclip
          </span>
        </div>

        {/* Feed player */}
        <div className="w-full h-full">
          <FeedPlayer
            clips={clips}
            onLoadMore={handleLoadMore}
            hasMore={!!hasNextPage}
            onCreatorTap={handleCreatorTap}
            categories={categories}
            onFilterTap={() => setFilterDrawerOpen(true)}
            activeCategoryName={activeCategoryName}
          />
        </div>

        {/* Bottom nav */}
        <BottomNav />
      </div>}

      {/* ══════ DESKTOP LAYOUT — Swiper Slideable Menu ══════ */}
      {isDesktop && <div className="w-full h-full">
        <SwiperComponent
          onSwiper={(s) => { menuSwiperRef.current = s; }}
          onSlideChangeTransitionEnd={handleMenuSlideChange}
          slidesPerView="auto"
          initialSlide={1}
          resistanceRatio={0}
          slideToClickedSlide
          className="w-full h-full"
        >
          {/* Slide 0: Side menu panel */}
          <SwiperSlide className="!w-[320px] !h-full">
            <div className="w-full h-full bg-[hsl(240_10%_6%)] border-r border-white/6 flex flex-col overflow-y-auto">
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
            </div>
          </SwiperSlide>

          {/* Slide 1: Main content */}
          <SwiperSlide className="!w-full !h-full">
            <div className="relative w-full h-full flex items-center justify-center">
              <button
                type="button"
                onClick={toggleMenu}
                className="absolute top-6 left-6 z-50 flex items-center justify-center w-10 h-10 rounded-full bg-white/6 border border-white/6 text-white/60 hover:bg-white/10 hover:text-white/80 transition-all"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              >
                {menuOpen ? <X className="w-5 h-5" strokeWidth={1.5} /> : <Menu className="w-5 h-5" strokeWidth={1.5} />}
              </button>

              <div className="relative h-full max-h-full" style={{ aspectRatio: '9/16' }}>
                <FeedPlayer clips={clips} onLoadMore={handleLoadMore} hasMore={!!hasNextPage} onCreatorTap={handleCreatorTap} categories={categories} />
              </div>
            </div>
          </SwiperSlide>
        </SwiperComponent>
      </div>}

      {/* Mobile Filter Drawer */}
      <Drawer open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Filter by Category</DrawerTitle>
            <DrawerDescription>Tap to filter · tap again to clear</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-8">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { handleCategoryChange(undefined); setFilterDrawerOpen(false); }}
                className={`px-4 py-2 rounded-full text-[13px] font-medium transition-all ${
                  category === undefined
                    ? 'bg-white text-black'
                    : 'bg-white/8 text-white/50 hover:text-white/70'
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => { handleCategoryChange(category === cat.id ? undefined : cat.id); setFilterDrawerOpen(false); }}
                  className={`px-4 py-2 rounded-full text-[13px] font-medium transition-all ${
                    category === cat.id
                      ? 'bg-white text-black'
                      : 'bg-white/8 text-white/50 hover:text-white/70'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Creator Drawer */}
      <Drawer open={drawerCreatorId !== null} onOpenChange={handleCreatorDrawerClose}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Creator Profile</DrawerTitle>
            <DrawerDescription>
              {drawerCreatorId ? `Creator ID: ${drawerCreatorId}` : 'Loading...'}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <p className="text-sm text-muted-foreground">Full creator profile coming in a future story.</p>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}


