import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Film, Users, CreditCard, Download, DollarSign, Wallet, ArrowUp, ArrowDown } from 'lucide-react'
import { sessionQueryKey, fetchSession } from '@/hooks/useOptimizedSession'
import { getAdminMetrics, adminMetricsQueryKey } from '@/api'
import { AnimateNumber } from '@/components/AnimateNumber'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import type { AdminMetricsResponse } from '@/types'

export const Route = createFileRoute('/admin/')({
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
      queryKey: adminMetricsQueryKey,
      queryFn: getAdminMetrics,
      staleTime: 2 * 60 * 1000,
    })
  },
  component: AdminDashboardPage,
})

type MetricKey = keyof AdminMetricsResponse['metrics']

const METRICS: {
  key: MetricKey
  label: string
  icon: typeof Film
  isCurrency: boolean
}[] = [
  { key: 'totalVideos', label: 'Total Videos', icon: Film, isCurrency: false },
  { key: 'registeredUsers', label: 'Registered Users', icon: Users, isCurrency: false },
  { key: 'activeSubscribers', label: 'Active Subscribers', icon: CreditCard, isCurrency: false },
  { key: 'totalDownloads', label: 'Total Downloads', icon: Download, isCurrency: false },
  { key: 'monthlyRevenue', label: 'Monthly Revenue', icon: DollarSign, isCurrency: true },
  { key: 'creatorPoolBalance', label: 'Creator Pool Balance', icon: Wallet, isCurrency: true },
]

function TrendIndicator({ trend }: { trend: number | null }) {
  if (trend === null) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  if (trend === 0) {
    return <span className="text-xs text-muted-foreground">0%</span>
  }
  if (trend > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-green-600">
        <ArrowUp className="h-3 w-3" />
        +{trend.toFixed(1)}%
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-red-600">
      <ArrowDown className="h-3 w-3" />
      {trend.toFixed(1)}%
    </span>
  )
}

function AdminMetricCard({
  icon: Icon,
  label,
  value,
  trend,
  isCurrency,
}: {
  icon: typeof Film
  label: string
  value: number
  trend: number | null
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
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold tabular-nums">
              <AnimateNumber value={value} format={isCurrency ? formatCurrency : undefined} />
            </p>
            <TrendIndicator trend={trend} />
          </div>
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
          <Skeleton className="h-7 w-20" />
        </div>
      </CardContent>
    </Card>
  )
}

function AdminDashboardPage() {
  const { data, isPending } = useQuery({
    queryKey: adminMetricsQueryKey,
    queryFn: getAdminMetrics,
    staleTime: 2 * 60 * 1000,
  })

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Platform Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isPending
          ? Array.from({ length: 6 }, (_, i) => <MetricSkeleton key={i} />)
          : METRICS.map((metric) => {
              const m = data?.metrics[metric.key]
              return (
                <AdminMetricCard
                  key={metric.key}
                  icon={metric.icon}
                  label={metric.label}
                  value={m?.value ?? 0}
                  trend={m?.trend ?? null}
                  isCurrency={metric.isCurrency}
                />
              )
            })}
      </div>
    </div>
  )
}
