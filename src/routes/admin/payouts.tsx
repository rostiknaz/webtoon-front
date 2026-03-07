import { useState, memo } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileDown, CheckCircle, Banknote } from 'lucide-react'
import { toast } from 'sonner'
import { sessionQueryKey, fetchSession } from '@/hooks/useOptimizedSession'
import {
  getPayoutMonths,
  getPayoutsByMonth,
  approvePayoutBatch,
  markPayoutBatchPaid,
  exportPayoutCsv,
  payoutMonthsQueryKey,
  payoutsByMonthQueryKey,
  creatorEarningsQueryKey,
} from '@/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { formatCurrency } from '@/lib/utils'

export const Route = createFileRoute('/admin/payouts')({
  loader: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData({
      queryKey: sessionQueryKey,
      queryFn: fetchSession,
      staleTime: 5 * 60 * 1000,
    })

    if (!session || session.user.role !== 'admin') {
      throw redirect({ to: '/' })
    }

    await context.queryClient.ensureQueryData({
      queryKey: payoutMonthsQueryKey,
      queryFn: getPayoutMonths,
      staleTime: 2 * 60 * 1000,
    })
  },
  component: AdminPayoutsPage,
})

// ==================== Constants & Helpers ====================

const STATUS_VARIANTS: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-600' },
  approved: { label: 'Approved', className: 'border-blue-500/30 bg-blue-500/10 text-blue-600' },
  paid: { label: 'Paid', className: 'border-green-500/30 bg-green-500/10 text-green-600' },
}

const NUMBER_FORMATTER = new Intl.NumberFormat()

const StatusBadge = memo(function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANTS[status] ?? STATUS_VARIANTS.pending
  return <Badge className={variant.className}>{variant.label}</Badge>
})

function formatMonth(month: string): string {
  const [year, m] = month.split('-')
  const date = new Date(Number(year), Number(m) - 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/**
 * Determine overall month status from status counts
 * Priority: pending > approved > paid (most urgent first)
 */
function getOverallStatus(pendingCount: number, approvedCount: number, paidCount: number): string {
  if (pendingCount > 0) return 'pending'
  if (approvedCount > 0) return 'approved'
  if (paidCount > 0) return 'paid'
  return 'pending'
}

/**
 * Invalidate all payout-related queries after mutations
 */
function invalidatePayoutQueries(queryClient: ReturnType<typeof useQueryClient>, month: string) {
  queryClient.invalidateQueries({ queryKey: payoutMonthsQueryKey })
  queryClient.invalidateQueries({ queryKey: payoutsByMonthQueryKey(month) })
  queryClient.invalidateQueries({ queryKey: creatorEarningsQueryKey })
}

// ==================== Components ====================

const MonthSelector = memo(function MonthSelector({
  selectedMonth,
  onSelect,
}: {
  selectedMonth: string | null
  onSelect: (month: string) => void
}) {
  const { data, isPending } = useQuery({
    queryKey: payoutMonthsQueryKey,
    queryFn: getPayoutMonths,
    staleTime: 2 * 60 * 1000,
  })

  if (isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  const months = data?.months ?? []

  if (months.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No payout data available. Run earnings calculation first.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {months.map((m) => {
        const isSelected = selectedMonth === m.month
        const overallStatus = getOverallStatus(m.pendingCount, m.approvedCount, m.paidCount)
        return (
          <button
            key={m.month}
            onClick={() => onSelect(m.month)}
            className={`w-full rounded-lg border p-4 text-left transition-colors ${
              isSelected
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{formatMonth(m.month)}</p>
                <p className="text-sm text-muted-foreground">
                  {m.creatorCount} creator{m.creatorCount !== 1 ? 's' : ''} &middot; {formatCurrency(m.totalPayout)}
                </p>
              </div>
              <StatusBadge status={overallStatus} />
            </div>
          </button>
        )
      })}
    </div>
  )
})

const PayoutTable = memo(function PayoutTable({ month }: { month: string }) {
  const queryClient = useQueryClient()

  const { data, isPending } = useQuery({
    queryKey: payoutsByMonthQueryKey(month),
    queryFn: () => getPayoutsByMonth(month),
    staleTime: 60 * 1000,
  })

  const approveMutation = useMutation({
    mutationFn: () => approvePayoutBatch(month),
    onSuccess: (result) => {
      const count = result.approved
      toast.success(`Approved ${count} payout${count !== 1 ? 's' : ''}`)
      invalidatePayoutQueries(queryClient, month)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const markPaidMutation = useMutation({
    mutationFn: () => markPayoutBatchPaid(month),
    onSuccess: (result) => {
      const count = result.paid
      toast.success(`Marked ${count} payout${count !== 1 ? 's' : ''} as paid`)
      invalidatePayoutQueries(queryClient, month)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  if (isPending) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const payouts = data?.payouts ?? []

  // Single-pass computation of status flags and totals (O(n) instead of O(4n))
  let hasPending = false
  let hasApproved = false
  let totalDownloads = 0
  let totalPayout = 0

  for (const p of payouts) {
    if (p.status === 'pending') hasPending = true
    if (p.status === 'approved') hasApproved = true
    totalDownloads += p.totalDownloads
    totalPayout += p.earningsAmount
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{formatMonth(month)} Payouts</CardTitle>
          <div className="flex gap-2">
            {hasPending && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" disabled={approveMutation.isPending}>
                    <CheckCircle className="mr-1.5 h-4 w-4" />
                    Approve All Pending
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Approve All Pending Payouts?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will mark all pending entries for {formatMonth(month)} as approved.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => approveMutation.mutate()}
                      disabled={approveMutation.isPending}
                    >
                      {approveMutation.isPending ? 'Approving...' : 'Approve'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {hasApproved && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={markPaidMutation.isPending}>
                    <Banknote className="mr-1.5 h-4 w-4" />
                    Mark All as Paid
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mark All as Paid?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will mark all approved entries for {formatMonth(month)} as paid.
                      Only do this after money has been transferred.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => markPaidMutation.mutate()}
                      disabled={markPaidMutation.isPending}
                    >
                      {markPaidMutation.isPending ? 'Processing...' : 'Mark Paid'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button size="sm" variant="outline" onClick={() => exportPayoutCsv(month)}>
              <FileDown className="mr-1.5 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {payouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payouts for this month.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Creator</th>
                  <th className="pb-2 font-medium">Downloads</th>
                  <th className="pb-2 font-medium">Share %</th>
                  <th className="pb-2 font-medium">Earnings</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-0">
                    <td className="py-2.5">
                      <div>
                        <p className="font-medium">{entry.creatorName ?? 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{entry.creatorEmail}</p>
                      </div>
                    </td>
                    <td className="py-2.5 tabular-nums">
                      {NUMBER_FORMATTER.format(entry.totalDownloads)}
                    </td>
                    <td className="py-2.5">{entry.revenueShare}%</td>
                    <td className="py-2.5 tabular-nums">{formatCurrency(entry.earningsAmount)}</td>
                    <td className="py-2.5">
                      <StatusBadge status={entry.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-medium">
                  <td className="pt-3">{payouts.length} creator{payouts.length !== 1 ? 's' : ''}</td>
                  <td className="pt-3 tabular-nums">{NUMBER_FORMATTER.format(totalDownloads)}</td>
                  <td className="pt-3" />
                  <td className="pt-3 tabular-nums">{formatCurrency(totalPayout)}</td>
                  <td className="pt-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
})

function AdminPayoutsPage() {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Payout Management</h1>
        <p className="text-muted-foreground">Review and approve monthly creator payouts</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Select Month</h2>
          <MonthSelector selectedMonth={selectedMonth} onSelect={setSelectedMonth} />
        </div>
        <div>
          {selectedMonth ? (
            <PayoutTable month={selectedMonth} />
          ) : (
            <Card>
              <CardContent className="flex min-h-[200px] items-center justify-center p-6 text-muted-foreground">
                Select a month to view payouts
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
