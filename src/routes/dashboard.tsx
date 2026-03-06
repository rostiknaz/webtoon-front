import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Upload, Eye, Download, DollarSign, TrendingUp } from 'lucide-react'
import { sessionQueryKey, fetchSession } from '@/hooks/useOptimizedSession'
import { getCreatorStats, creatorStatsQueryKey, getCreatorEarnings, creatorEarningsQueryKey } from '@/api'
import { AnimateNumber } from '@/components/AnimateNumber'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'

export const Route = createFileRoute('/dashboard')({
  loader: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData({
      queryKey: sessionQueryKey,
      queryFn: fetchSession,
      staleTime: 5 * 60 * 1000,
    })

    if (!session) {
      throw redirect({ to: '/profile' })
    }

    if (session.user.role === 'consumer') {
      throw redirect({ to: '/profile' })
    }

    // Prefetch stats and earnings in parallel
    await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: creatorStatsQueryKey,
        queryFn: getCreatorStats,
        staleTime: 2 * 60 * 1000,
      }),
      context.queryClient.ensureQueryData({
        queryKey: creatorEarningsQueryKey,
        queryFn: getCreatorEarnings,
        staleTime: 5 * 60 * 1000,
      }),
    ])
  },
  component: DashboardPage,
})

const METRICS = [
  { key: 'totalUploads', label: 'Total Uploads', icon: Upload, isCurrency: false },
  { key: 'totalViews', label: 'Total Views', icon: Eye, isCurrency: false },
  { key: 'totalDownloads', label: 'Total Downloads', icon: Download, isCurrency: false },
  { key: 'monthlyEarnings', label: 'Monthly Earnings', icon: DollarSign, isCurrency: true },
  { key: 'lifetimeEarnings', label: 'Lifetime Earnings', icon: TrendingUp, isCurrency: true },
] as const

function MetricCard({
  icon: Icon,
  label,
  value,
  isCurrency,
}: {
  icon: typeof Upload
  label: string
  value: number
  isCurrency: boolean
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="rounded-lg bg-muted p-2.5">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums">
            <AnimateNumber value={value} format={isCurrency ? formatCurrency : undefined} />
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function MetricSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
      </CardContent>
    </Card>
  )
}

function RevenueShareBadge({
  percent,
  isFounding,
}: {
  percent: number
  isFounding: boolean
}) {
  if (isFounding) {
    return (
      <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">
        {percent}% Revenue Share
      </Badge>
    )
  }
  return (
    <Badge variant="secondary">
      {percent}% Revenue Share
    </Badge>
  )
}

const STATUS_VARIANTS: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-600' },
  approved: { label: 'Approved', className: 'border-blue-500/30 bg-blue-500/10 text-blue-600' },
  paid: { label: 'Paid', className: 'border-green-500/30 bg-green-500/10 text-green-600' },
}

function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANTS[status] ?? STATUS_VARIANTS.pending
  return <Badge className={variant.className}>{variant.label}</Badge>
}

function formatMonth(month: string): string {
  const [year, m] = month.split('-')
  const date = new Date(Number(year), Number(m) - 1)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function EarningsLedger() {
  const { data, isPending } = useQuery({
    queryKey: creatorEarningsQueryKey,
    queryFn: getCreatorEarnings,
    staleTime: 5 * 60 * 1000,
  })

  if (isPending) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">Earnings Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const earnings = data?.earnings ?? []

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="text-lg">Earnings Ledger</CardTitle>
      </CardHeader>
      <CardContent>
        {earnings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No earnings recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Month</th>
                  <th className="pb-2 font-medium">Downloads</th>
                  <th className="pb-2 font-medium">Share %</th>
                  <th className="pb-2 font-medium">Earnings</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((entry) => (
                  <tr key={entry.month} className="border-b last:border-0">
                    <td className="py-2.5">{formatMonth(entry.month)}</td>
                    <td className="py-2.5 tabular-nums">
                      {new Intl.NumberFormat().format(entry.totalDownloads)}
                    </td>
                    <td className="py-2.5">{entry.revenueShare}%</td>
                    <td className="py-2.5 tabular-nums">{formatCurrency(entry.earningsAmount)}</td>
                    <td className="py-2.5">
                      <StatusBadge status={entry.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DashboardPage() {
  const { data: session } = useQuery({
    queryKey: sessionQueryKey,
    queryFn: fetchSession,
    staleTime: 5 * 60 * 1000,
  })

  const { data: stats, isPending } = useQuery({
    queryKey: creatorStatsQueryKey,
    queryFn: getCreatorStats,
    staleTime: 2 * 60 * 1000,
  })

  const displayName = session?.user?.name ?? session?.user?.email ?? 'Creator'

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {displayName}</p>
        {stats && (
          <div className="mt-2">
            <RevenueShareBadge
              percent={stats.revenueSharePercent}
              isFounding={stats.isFoundingCreator}
            />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isPending
          ? Array.from({ length: 5 }, (_, i) => <MetricSkeleton key={i} />)
          : METRICS.map((metric) => (
              <MetricCard
                key={metric.key}
                icon={metric.icon}
                label={metric.label}
                value={stats?.[metric.key] ?? 0}
                isCurrency={metric.isCurrency}
              />
            ))}
      </div>

      <EarningsLedger />
    </div>
  )
}
