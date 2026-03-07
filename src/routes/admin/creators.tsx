import { useState, useMemo } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { sessionQueryKey, fetchSession } from '@/hooks/useOptimizedSession'
import { getCreatorActivity, creatorActivityQueryKey } from '@/api'
import { formatNumber, formatRelativeTime } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

type SortOption = 'recent' | 'total' | 'flagged'

export const Route = createFileRoute('/admin/creators')({
  loader: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData({
      queryKey: sessionQueryKey,
      queryFn: fetchSession,
      staleTime: 5 * 60 * 1000,
    })

    if (!session) {
      throw redirect({ to: '/profile' })
    }

    if (session.user.role !== 'admin') {
      throw redirect({ to: '/' })
    }

    await context.queryClient.ensureQueryData({
      queryKey: creatorActivityQueryKey('recent'),
      queryFn: () => getCreatorActivity('recent'),
      staleTime: 60 * 1000,
    })
  },
  component: AdminCreatorsPage,
})

// ==================== Constants ====================

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'total', label: 'Total Uploads' },
  { value: 'flagged', label: 'Flagged First' },
]

// ==================== Components ====================

function FlaggedBadge() {
  return (
    <Badge className="border-red-500/30 bg-red-500/10 text-red-600">
      <AlertTriangle className="mr-1 h-3 w-3" />
      Flagged
    </Badge>
  )
}

function AdminCreatorsPage() {
  const [sort, setSort] = useState<SortOption>('recent')

  const { data, isPending } = useQuery({
    queryKey: creatorActivityQueryKey(sort),
    queryFn: () => getCreatorActivity(sort),
    staleTime: 60 * 1000,
  })

  const creators = useMemo(() => data?.creators ?? [], [data])
  const flaggedCount = useMemo(
    () => creators.reduce((n, c) => n + (c.isFlagged ? 1 : 0), 0),
    [creators],
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Creator Activity</h1>
        <p className="text-muted-foreground">
          Monitor upload patterns and flag unusual activity
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          {SORT_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={sort === opt.value ? 'default' : 'outline'}
              onClick={() => setSort(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        {flaggedCount > 0 && (
          <span className="text-sm text-red-600">
            {flaggedCount} flagged creator{flaggedCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isPending ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : creators.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[200px] items-center justify-center p-6 text-muted-foreground">
            No creator activity found
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {creators.length} creator{creators.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Creator</th>
                    <th className="pb-2 font-medium">Last 24h</th>
                    <th className="pb-2 font-medium">Last 7d</th>
                    <th className="pb-2 font-medium">Total</th>
                    <th className="pb-2 font-medium">Last Upload</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {creators.map((creator) => (
                    <tr
                      key={creator.creatorId}
                      className={`border-b last:border-0 ${creator.isFlagged ? 'bg-red-500/5' : ''}`}
                    >
                      <td className="py-2.5">
                        <div>
                          <p className="font-medium">{creator.creatorName ?? 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{creator.creatorEmail}</p>
                        </div>
                      </td>
                      <td className="py-2.5 tabular-nums">
                        <span className={creator.uploadsLast24h >= 30 ? 'font-bold text-red-600' : ''}>
                          {formatNumber.format(creator.uploadsLast24h)}
                        </span>
                      </td>
                      <td className="py-2.5 tabular-nums">
                        {formatNumber.format(creator.uploadsLast7d)}
                      </td>
                      <td className="py-2.5 tabular-nums">
                        {formatNumber.format(creator.totalUploads)}
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {formatRelativeTime(creator.lastUploadAt)}
                      </td>
                      <td className="py-2.5">
                        {creator.isFlagged && <FlaggedBadge />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
