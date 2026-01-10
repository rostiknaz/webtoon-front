import {createFileRoute} from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router'
import { ErrorComponent, useRouter } from '@tanstack/react-router'
import {
    useQueryErrorResetBoundary,
    useSuspenseQuery,
} from '@tanstack/react-query'
import {useEffect} from 'react'
import { motion, AnimatePresence } from 'framer-motion';

import { VideoPlayer } from '@/components/VideoPlayer';
import getSeriesMetadataQueryOptions from "@/queryOptions/seriesQueryOptions.ts";
import {EpisodeSidebar} from "@/components/EpisodeSidebar.tsx";
import {AuthDrawer} from "@/components/AuthDrawer.tsx";
import {useState} from "react";
import {SerialNotFoundError} from "@/types.ts";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export const Route = createFileRoute('/serials/$serialId')({
    loader: ({ context: { queryClient }, params: { serialId } }) => {
        return queryClient.ensureQueryData(getSeriesMetadataQueryOptions(serialId))
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

  const { data } = useSuspenseQuery(getSeriesMetadataQueryOptions(serialId));
  const [activeIndex, setActiveIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAuthDrawerOpen, setIsAuthDrawerOpen] = useState(false);

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
    setIsAuthDrawerOpen(true); // Open auth drawer
  };

  const handleAuthSuccess = () => {
    // Refresh the page or refetch data after successful authentication
    window.location.reload();
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
              <DrawerContent className="max-h-[90vh] flex flex-col" aria-describedby={undefined}>
                  <DrawerHeader className="sr-only">
                      <DrawerTitle>Episodes</DrawerTitle>
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
      </div>
  );
}
