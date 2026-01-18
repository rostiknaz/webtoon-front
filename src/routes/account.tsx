import { createFileRoute, redirect } from '@tanstack/react-router'
import AccountPage from '@/pages/AccountPage'
import { sessionQueryKey, fetchSession } from '@/hooks/useOptimizedSession'

export const Route = createFileRoute('/account')({
  loader: async ({ context }) => {
    // Prefetch session into React Query cache (shared with Header's useOptimizedSession)
    const session = await context.queryClient.ensureQueryData({
      queryKey: sessionQueryKey,
      queryFn: fetchSession,
      staleTime: 5 * 60 * 1000, // 5 minutes
    })

    // Redirect to home if not authenticated
    if (!session) {
      throw redirect({ to: '/' })
    }

    return { session }
  },
  component: AccountPage,
})
