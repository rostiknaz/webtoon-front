import {createFileRoute} from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router'
import { ErrorComponent, useRouter } from '@tanstack/react-router'
import {
    useQueryErrorResetBoundary,
    useSuspenseQuery,
    useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion';

import { VideoPlayer } from '@/components/VideoPlayer';
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
import { authClient } from '@/lib/auth.client';
import { useSubscription } from '@/hooks/useSubscription';

export const Route = createFileRoute('/serials/$serialId')({
    loader: ({ context: { queryClient }, params: { serialId } }) => {
        // Loader runs before component mount, so we don't have subscription status yet
        // We'll refetch with subscription status in the component
        return queryClient.ensureQueryData(getSeriesMetadataQueryOptions(serialId, false))
    },
    errorComponent: SerialErrorComponent,
    component: SerialPage
});

function SerialErrorComponent({ error }: ErrorComponentProps) {
    const router = useRouter()
    if (error instanceof SerialNotFoundError) {
        return <div>{error.message}</div>
    }
    const queryErrorResetBoundary = useQueryErrorResetBoundary()

    useEffect(() => {
        queryErrorResetBoundary.reset()
    }, [queryErrorResetBoundary])

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
  const session = authClient.useSession();
  const subscription = useSubscription();
  const queryClient = useQueryClient();

  const isAuthenticated = !!session.data?.user;
  const hasSubscription = subscription.data?.hasSubscription ?? false;

  // Fetch series data with subscription status
  const { data } = useSuspenseQuery(getSeriesMetadataQueryOptions(serialId, hasSubscription));
  const [activeIndex, setActiveIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAuthDrawerOpen, setIsAuthDrawerOpen] = useState(false);
  const [isSubscriptionDrawerOpen, setIsSubscriptionDrawerOpen] = useState(false);

  // Track previous subscription status to detect actual changes
  const prevHasSubscription = useRef<boolean | null>(null);

  // Refetch series data only when subscription status actually changes
  useEffect(() => {
    // Skip on first render - use loader's cached data
    if (prevHasSubscription.current === null) {
      prevHasSubscription.current = hasSubscription;
      return;
    }

    // Only invalidate if subscription status actually changed
    if (prevHasSubscription.current !== hasSubscription) {
      prevHasSubscription.current = hasSubscription;
      queryClient.invalidateQueries({ queryKey: ['serial', serialId] });
    }
  }, [hasSubscription, serialId, queryClient]);

  if (!data) return null;

  const episode = data.episodes[activeIndex];
  const isMovingForward = activeIndex > prevIndex;

  const handleEpisodeSelect = (index: number) => {
    setPrevIndex(activeIndex);
    setActiveIndex(index);
    setIsDrawerOpen(false); // Close drawer after selecting episode on mobile
  };

  const handlePlayNext = () => {
    // Check if there's a next episode and it's not locked
    const nextIndex = activeIndex + 1;
    if (nextIndex < data.episodes.length && !data.episodes[nextIndex].isLocked) {
      setPrevIndex(activeIndex);
      setActiveIndex(nextIndex);
    }
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

    // Refetch subscription status to get the latest data
    const { data: freshSubscriptionData } = await subscription.refetch();

    // Only show subscription drawer if user doesn't have subscription
    // If they have subscription, React Query will automatically refetch series data
    // because the query key includes hasSubscription
    if (!freshSubscriptionData?.hasSubscription) {
      setIsSubscriptionDrawerOpen(true);
    }
  };

  const handleSubscriptionSuccess = async () => {
    // Close the subscription drawer first for immediate feedback
    setIsSubscriptionDrawerOpen(false);

    // Refetch subscription status - this will trigger automatic refetch of series data
    // because the series query key includes hasSubscription
    await subscription.refetch();
  };

  return (
      <div className="serial-page-container flex bg-background text-foreground">
          {/* Video Player - Full screen */}
          <div className="flex-1 relative overflow-hidden bg-black">
              <AnimatePresence mode="wait">
                  <motion.div
                      key={episode._id}
                      initial={{ y: isMovingForward ? 300 : -300, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: isMovingForward ? -300 : 300, opacity: 0 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      className="h-full"
                  >
                      <VideoPlayer
                          episode={episode}
                          seriesTitle={data.title}
                          onOpenEpisodes={() => setIsDrawerOpen(true)}
                          onPlayNext={handlePlayNext}
                      />
                  </motion.div>
              </AnimatePresence>
          </div>

          {/* Desktop: Sidebar */}
          <div className="hidden md:block w-96 lg:w-[420px] border-l border-border bg-card overflow-y-auto">
              <EpisodeSidebar
                  series={data}
                  activeIndex={activeIndex}
                  episodes={data.episodes}
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
                          episodes={data.episodes}
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
