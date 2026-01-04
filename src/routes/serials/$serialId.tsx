import {createFileRoute} from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router'
import { ErrorComponent, useRouter } from '@tanstack/react-router'
import {
    useQueryErrorResetBoundary,
    useSuspenseQuery,
} from '@tanstack/react-query'
import {useEffect} from 'react'
import { motion, AnimatePresence } from 'framer-motion';

import { VideoPlayer } from '../../components/VideoPlayer';
import getSeriesMetadataQueryOptions from "../../queryOptions/seriesQueryOptions.ts";
import {EpisodeSidebar} from "../../components/EpisodeSidebar.tsx";
import {useState} from "react";
import {SerialNotFoundError} from "../../types.ts";

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

  if (!data) return null;

  const episode = data.episodes[activeIndex];

  return (
      <div style={styles.container}>
          <div className="left">
              <AnimatePresence mode="wait">
                  <motion.div
                      key={episode._id}
                      initial={{ y: 300, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -300, opacity: 0 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      style={{ height: '100%' }}
                  >
                      <VideoPlayer episode={episode} />
                  </motion.div>
              </AnimatePresence>
          </div>
          <div className="right">
              <EpisodeSidebar activeIndex={activeIndex} episodes= {data.episodes} onSelect= {(i: number) => setActiveIndex(i)} />
          </div>
      </div>
  );
}
const styles = {
    container: {
        display: 'flex',
        height: '100vh',
        background: '#000',
        color: '#fff',
    },
    left: {
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
    },
    right: {
        width: 320,
        borderLeft: '1px solid #1f2937',
        overflowY: 'auto',
    },
};
