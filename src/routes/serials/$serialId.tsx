import {createFileRoute} from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router'
import { ErrorComponent, useRouter } from '@tanstack/react-router'
import {
    useQueryErrorResetBoundary,
    useSuspenseQuery,
} from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { HybridVideoPlayer } from '@/components/HybridVideoPlayer';
import { VideoPlayerCacheProvider } from '@/contexts/VideoPlayerCacheContext';
import getSeriesMetadataQueryOptions from "@/queryOptions/seriesQueryOptions.ts";
import {EpisodeSidebar} from "@/components/EpisodeSidebar.tsx";
import {AuthDrawer} from "@/components/AuthDrawer.tsx";
import {SubscriptionDrawer} from "@/components/SubscriptionDrawer.tsx";
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

export const Route = createFileRoute('/serials/$serialId')({
    loader: ({ context: { queryClient }, params: { serialId } }) => {
        return queryClient.ensureQueryData(getSeriesMetadataQueryOptions(serialId))
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
  const { serialId } = Route.useParams();
  const session = useOptimizedSession();
  const isAuthenticated = !!session.data?.user;
  const subscription = useSubscription();
  const hasSubscription = subscription.data?.hasSubscription ?? false;

  // Fetch series data - query key does NOT include hasSubscription to prevent flicker
  const { data } = useSuspenseQuery(getSeriesMetadataQueryOptions(serialId));

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

  if (!data) return null;

  const handleEpisodeSelect = (index: number) => {
    setActiveIndex(index);
    setIsDrawerOpen(false); // Close drawer after selecting episode on mobile
  };

  const handleLockedEpisodeClick = () => {
    setIsDrawerOpen(false); // Close episodes drawer if open

    // If user is not authenticated, show auth drawer
    if (!isAuthenticated) {
      setIsAuthDrawerOpen(true);
      return;
    }

    // If user already has subscription, episodes should already be unlocked
    // (React Query automatically refetches when hasSubscription changes)
    if (hasSubscription) {
      // No action needed - episodes are already unlocked
      return;
    }

    // If user is authenticated but doesn't have subscription, show subscription drawer
    setIsSubscriptionDrawerOpen(true);
  };

  const handleAuthSuccess = async () => {
    // After successful login/signup, close auth drawer
    setIsAuthDrawerOpen(false);

    // Refresh subscription status (reads cookie + validates with API)
    const freshSubscriptionData = await subscription.refresh();

    // Only show subscription drawer if user doesn't have subscription
    if (!freshSubscriptionData?.hasSubscription) {
      setIsSubscriptionDrawerOpen(true);
    }
  };

  const handleSubscriptionSuccess = () => {
    // Close the subscription drawer first for immediate feedback
    setIsSubscriptionDrawerOpen(false);

    // Refresh subscription status from cookie (server sets it on subscribe)
    // This triggers re-render which updates episode lock status via useMemo
    void subscription.refresh();
  };

  // Handle episode change from swiper
  const handleEpisodeChange = (index: number) => {
    setActiveIndex(index);
  };

  return (
      <div className="serial-page-container flex bg-background text-foreground">
          {/* Video Player - Full screen with Swiper + Context caching */}
          <div className="flex-1 relative overflow-hidden bg-black h-full">
              <VideoPlayerCacheProvider>
                  <HybridVideoPlayer
                      episodes={episodes}
                      initialIndex={activeIndex}
                      seriesTitle={data.title}
                      onEpisodeChange={handleEpisodeChange}
                      onLockedEpisode={handleLockedEpisodeClick}
                      onShowEpisodes={() => setIsDrawerOpen(true)}
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

          {/* Auth Drawer */}
          <AuthDrawer
              open={isAuthDrawerOpen}
              onOpenChange={setIsAuthDrawerOpen}
              onSuccess={handleAuthSuccess}
          />

          {/* Subscription Drawer */}
          <SubscriptionDrawer
              open={isSubscriptionDrawerOpen}
              onOpenChange={setIsSubscriptionDrawerOpen}
              onSuccess={handleSubscriptionSuccess}
          />
      </div>
  );
}
