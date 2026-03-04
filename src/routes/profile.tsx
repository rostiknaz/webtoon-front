import { createFileRoute } from '@tanstack/react-router'
import ProfilePage from '@/pages/ProfilePage'
import { sessionQueryKey, fetchSession } from '@/hooks/useOptimizedSession'

export const Route = createFileRoute('/profile')({
  loader: async ({ context }) => {
    // Prefetch session into React Query cache (shared with Header's useOptimizedSession)
    // Unlike /account, do NOT redirect — anonymous users see login prompt
    await context.queryClient.ensureQueryData({
      queryKey: sessionQueryKey,
      queryFn: fetchSession,
      staleTime: 5 * 60 * 1000, // 5 minutes
    })
  },
  component: ProfilePage,
})
