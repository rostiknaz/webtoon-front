/**
 * Index Route — /
 *
 * Feed is the homepage. Renders the fullscreen vertical swipe feed.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState, useCallback } from 'react';
import { z } from 'zod';
import { NsfwToggle } from '@/components/NsfwToggle';
import { CreditCounter } from '@/components/CreditCounter';
import { useNsfwToggle } from '@/hooks/useNsfwToggle';
import { useIsDesktop } from '@/hooks/useIsDesktop';

import { FeedPlayer } from '@/components/FeedPlayer';
import { useFeed, feedQueryOptions } from '@/hooks/useFeed';
import { useCategories, categoriesQueryOptions } from '@/hooks/useCategories';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';

const feedSearchSchema = z.object({
  category: z.string().optional().catch(undefined),
});

export const Route = createFileRoute('/')({
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
  const { nsfwParam } = useNsfwToggle();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeed({ category, nsfw: nsfwParam });
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.categories ?? [];

  const clips = useMemo(
    () => data?.pages.flatMap((page) => page.clips) ?? [],
    [data],
  );

  const handleLoadMore = useCallback(() => {
    if (!isFetchingNextPage) fetchNextPage();
  }, [isFetchingNextPage, fetchNextPage]);

  // Creator drawer
  const [drawerCreatorId, setDrawerCreatorId] = useState<string | null>(null);
  const handleCreatorTap = useCallback((creatorId: string) => setDrawerCreatorId(creatorId), []);
  const handleCreatorDrawerClose = useCallback((open: boolean) => { if (!open) setDrawerCreatorId(null); }, []);

  const isDesktop = useIsDesktop();

  return (
    <div className="relative w-full h-full">
      {/* Top bar — mobile only (desktop has brand/controls in sidebar) */}
      {!isDesktop && (
        <div className="absolute top-0 left-0 right-0 z-40 pt-6 px-4 flex items-center justify-between">
          <span className="text-[15px] font-semibold text-white/85 tracking-[-0.01em]">
            aniclip
          </span>
          <div className="flex items-center gap-2">
            <CreditCounter />
            <NsfwToggle />
          </div>
        </div>
      )}

      {/* Desktop: centered 9:16 player */}
      {isDesktop ? (
        <div className="w-full h-full flex items-center justify-center bg-black">
          <div className="relative h-full max-h-full" style={{ aspectRatio: '9/16' }}>
            <FeedPlayer
              clips={clips}
              onLoadMore={handleLoadMore}
              hasMore={!!hasNextPage}
              onCreatorTap={handleCreatorTap}
              categories={categories}
              showNsfwIndicator={nsfwParam === 'all'}
            />
          </div>
        </div>
      ) : (
        <FeedPlayer
          clips={clips}
          onLoadMore={handleLoadMore}
          hasMore={!!hasNextPage}
          onCreatorTap={handleCreatorTap}
          categories={categories}
          showNsfwIndicator={nsfwParam === 'all'}
        />
      )}

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
