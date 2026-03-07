import {createFileRoute} from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router'
import { ErrorComponent, useRouter } from '@tanstack/react-router'
import {
    useQueryErrorResetBoundary,
    useSuspenseQuery,
} from '@tanstack/react-query'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'

import { HybridVideoPlayer } from '@/components/HybridVideoPlayer';
import { VideoPlayerCacheProvider } from '@/contexts/VideoPlayerCacheContext';
import getSeriesMetadataQueryOptions from "@/queryOptions/seriesQueryOptions.ts";
import {EpisodeSidebar} from "@/components/EpisodeSidebar.tsx";

// Lazy load drawers - only loaded when user opens them (saves ~50-100KB from initial bundle)
const AuthDrawer = lazy(() => import('@/components/AuthDrawer').then(m => ({ default: m.AuthDrawer })));
const SubscriptionDrawer = lazy(() => import('@/components/SubscriptionDrawer').then(m => ({ default: m.SubscriptionDrawer })));
import {SerialNotFoundError} from "@/types.ts";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { useOptimizedSession } from '@/hooks/useOptimizedSession';
import { useSubscription } from '@/hooks/useSubscription';

export const Route = createFileRoute('/serials/$serialSlug')({
    loader: ({ context: { queryClient }, params: { serialSlug } }) => {
        return queryClient.ensureQueryData(getSeriesMetadataQueryOptions(serialSlug))
    },
    errorComponent: SerialErrorComponent,
    component: SerialPage
});

function SerialErrorComponent({ error }: ErrorComponentProps) {
    const router = useRouter()
    const queryErrorResetBoundary = useQueryErrorResetBoundary()

    useEffect(() => {
        queryErrorResetBoundary.reset()
    }, [queryErrorResetBoundary])

    if (error instanceof SerialNotFoundError) {
        return <div>{error.message}</div>
    }

    return (
        <div>
            <button
                onClick={() => {
                    router.invalidate()
                }}
            >
                retry
            </button>
            <ErrorComponent error={error} />
        </div>
    )
}


function SerialPage() {
  const { serialSlug } = Route.useParams();
  const session = useOptimizedSession();
  const isAuthenticated = !!session.data?.user;
  const subscription = useSubscription();
  const hasSubscription = subscription.data?.hasSubscription ?? false;

  // Fetch series data - query key does NOT include hasSubscription to prevent flicker
  const { data } = useSuspenseQuery(getSeriesMetadataQueryOptions(serialSlug));

  // Compute episode locked status at render time based on current subscription status
  // This avoids query key changes and cache misses when subscription status changes
  const episodes = useMemo(() => {
    if (!data) return [];
    return data.episodes.map(ep => ({
      ...ep,
      // Override isLocked based on current subscription status
      isLocked: ep.isPaid && !hasSubscription,
      // Compute HLS URL based on access
      hlsUrl: (ep.isPaid && !hasSubscription) ? undefined : ep.hlsUrl,
    }));
  }, [data, hasSubscription]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAuthDrawerOpen, setIsAuthDrawerOpen] = useState(false);
  const [isSubscriptionDrawerOpen, setIsSubscriptionDrawerOpen] = useState(false);

  // Memoized callbacks to prevent unnecessary re-renders of child components
  const handleEpisodeSelect = useCallback((index: number) => {
    setActiveIndex(index);
    setIsDrawerOpen(false); // Close drawer after selecting episode on mobile
  }, []);

  const handleShowEpisodes = useCallback(() => {
    setIsDrawerOpen(true);
  }, []);

  const handleEpisodeChange = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const handleLockedEpisodeClick = useCallback(() => {
    setIsDrawerOpen(false); // Close episodes drawer if open

    // If user is not authenticated, show auth drawer
    if (!isAuthenticated) {
      setIsAuthDrawerOpen(true);
      return;
    }

    // If user already has subscription, episodes should already be unlocked
    if (hasSubscription) {
      return;
    }

    // If user is authenticated but doesn't have subscription, show subscription drawer
    setIsSubscriptionDrawerOpen(true);
  }, [isAuthenticated, hasSubscription]);

  const handleAuthSuccess = useCallback(async () => {
    // After successful login/signup, close auth drawer
    setIsAuthDrawerOpen(false);

    // Refresh subscription status (reads cookie + validates with API)
    const freshSubscriptionData = await subscription.refresh();

    // Only show subscription drawer if user doesn't have subscription
    if (!freshSubscriptionData?.hasSubscription) {
      setIsSubscriptionDrawerOpen(true);
    }
  }, [subscription]);

  // Subscription success is now handled by usePurchaseReturn after Solidgate redirect

  if (!data) return null;

  return (
      <div className="serial-page-container flex bg-background text-foreground">
          {/* Video Player - Full screen with Swiper + Context caching */}
          <div className="flex-1 relative overflow-hidden bg-black h-full">
              <VideoPlayerCacheProvider>
                  <HybridVideoPlayer
                      episodes={episodes}
                      initialIndex={activeIndex}
                      seriesSlug={data.slug}
                      seriesTitle={data.title}
                      onEpisodeChange={handleEpisodeChange}
                      onLockedEpisode={handleLockedEpisodeClick}
                      onShowEpisodes={handleShowEpisodes}
                  />
              </VideoPlayerCacheProvider>
          </div>

          {/* Desktop: Sidebar */}
          <div className="hidden md:block w-96 lg:w-[420px] border-l border-border bg-card overflow-y-auto">
              <EpisodeSidebar
                  series={data}
                  activeIndex={activeIndex}
                  episodes={episodes}
                  onSelect={handleEpisodeSelect}
                  onLockedClick={handleLockedEpisodeClick}
              />
          </div>

          {/* Mobile: Drawer */}
          <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
              <DrawerContent className="max-h-[90vh] flex flex-col" aria-describedby="episodes-description">
                  <DrawerHeader className="sr-only">
                      <DrawerTitle>Episodes</DrawerTitle>
                      <DrawerDescription id="episodes-description">
                          Browse and select episodes to watch
                      </DrawerDescription>
                  </DrawerHeader>
                  <div className="overflow-y-auto flex-1">
                      <EpisodeSidebar
                          series={data}
                          activeIndex={activeIndex}
                          episodes={episodes}
                          onSelect={handleEpisodeSelect}
                          onLockedClick={handleLockedEpisodeClick}
                      />
                  </div>
              </DrawerContent>
          </Drawer>

          {/* Auth Drawer - lazy loaded */}
          <Suspense fallback={null}>
              <AuthDrawer
                  open={isAuthDrawerOpen}
                  onOpenChange={setIsAuthDrawerOpen}
                  onSuccess={handleAuthSuccess}
              />
          </Suspense>

          {/* Subscription Drawer - lazy loaded */}
          <Suspense fallback={null}>
              <SubscriptionDrawer
                  open={isSubscriptionDrawerOpen}
                  onOpenChange={setIsSubscriptionDrawerOpen}
              />
          </Suspense>
      </div>
  );
}
