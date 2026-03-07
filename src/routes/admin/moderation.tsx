import { useState, memo } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, AlertTriangle, Image } from 'lucide-react'
import { toast } from 'sonner'
import { sessionQueryKey, fetchSession } from '@/hooks/useOptimizedSession'
import { getModerationQueue, moderateClip, moderationQueueQueryKey } from '@/api'
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
import type { ModerationQueueItem } from '@/types'

export const Route = createFileRoute('/admin/moderation')({
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
      queryKey: moderationQueueQueryKey,
      queryFn: getModerationQueue,
      staleTime: 30 * 1000,
    })
  },
  component: AdminModerationPage,
})

// ==================== Components ====================

const NSFW_VARIANTS: Record<string, { label: string; className: string }> = {
  safe: { label: 'Safe', className: 'border-green-500/30 bg-green-500/10 text-green-600' },
  suggestive: { label: 'Suggestive', className: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-600' },
  explicit: { label: 'Explicit', className: 'border-red-500/30 bg-red-500/10 text-red-600' },
}

const NsfwBadge = memo(function NsfwBadge({ rating }: { rating: string }) {
  const variant = NSFW_VARIANTS[rating] ?? NSFW_VARIANTS.safe
  return <Badge className={variant.className}>{variant.label}</Badge>
})

function ConfidenceIndicator({ confidence }: { confidence: number | null }) {
  if (confidence === null) return null
  const pct = (confidence * 100).toFixed(0)
  return (
    <span className="text-xs text-muted-foreground">
      AI confidence: {pct}%
    </span>
  )
}

const ModerationCard = memo(function ModerationCard({ clip }: { clip: ModerationQueueItem }) {
  const queryClient = useQueryClient()
  const [rejectReason, setRejectReason] = useState('')

  const approveMutation = useMutation({
    mutationFn: () => moderateClip(clip._id, 'approve'),
    onSuccess: () => {
      toast.success(`Approved: ${clip.title}`)
      queryClient.invalidateQueries({ queryKey: moderationQueueQueryKey })
    },
    onError: (error) => toast.error(error.message),
  })

  const rejectMutation = useMutation({
    mutationFn: () => moderateClip(clip._id, 'reject', rejectReason || undefined),
    onSuccess: () => {
      toast.success(`Rejected: ${clip.title}`)
      queryClient.invalidateQueries({ queryKey: moderationQueueQueryKey })
      setRejectReason('')
    },
    onError: (error) => toast.error(error.message),
  })

  const isPending = approveMutation.isPending || rejectMutation.isPending

  // Stable callbacks to avoid recreating functions on every render
  const handleApprove = approveMutation.mutate
  const handleReject = rejectMutation.mutate

  return (
    <Card>
      <CardContent className="flex gap-4 p-4">
        {clip.thumbnailUrl ? (
          <img
            src={clip.thumbnailUrl}
            alt={clip.title}
            className="h-20 w-32 flex-shrink-0 rounded-md object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-20 w-32 flex-shrink-0 items-center justify-center rounded-md bg-muted">
            <Image className="h-6 w-6 text-muted-foreground" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{clip.title}</p>
              <p className="text-sm text-muted-foreground">{clip.creatorName}</p>
            </div>
            <NsfwBadge rating={clip.nsfwRating} />
          </div>

          {clip.moderationReason && (
            <div className="mt-1.5 flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-yellow-600" />
              <p className="text-xs text-muted-foreground">{clip.moderationReason}</p>
            </div>
          )}

          <div className="mt-2 flex items-center gap-3">
            <ConfidenceIndicator confidence={clip.moderationConfidence} />

            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                disabled={isPending}
                onClick={handleApprove}
              >
                <CheckCircle className="mr-1.5 h-4 w-4" />
                {approveMutation.isPending ? 'Approving...' : 'Approve'}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" disabled={isPending}>
                    <XCircle className="mr-1.5 h-4 w-4" />
                    Reject
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reject this clip?</AlertDialogTitle>
                    <AlertDialogDescription>
                      "{clip.title}" will be rejected. The creator will see the rejection reason.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="px-6">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Rejection reason (optional)"
                      className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                      rows={2}
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleReject}
                      disabled={rejectMutation.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

function ModerationSkeleton() {
  return (
    <Card>
      <CardContent className="flex gap-4 p-4">
        <Skeleton className="h-20 w-32 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
        </div>
      </CardContent>
    </Card>
  )
}

function AdminModerationPage() {
  const { data, isPending } = useQuery({
    queryKey: moderationQueueQueryKey,
    queryFn: getModerationQueue,
    staleTime: 30 * 1000,
  })

  const clips = data?.clips ?? []

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Content Moderation</h1>
        <p className="text-muted-foreground">
          Review flagged clips pending manual approval
        </p>
      </div>

      {isPending ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <ModerationSkeleton key={i} />
          ))}
        </div>
      ) : clips.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[200px] items-center justify-center p-6 text-muted-foreground">
            No clips pending review
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {clips.length} clip{clips.length !== 1 ? 's' : ''} pending review
              </CardTitle>
            </CardHeader>
          </Card>
          {clips.map((clip) => (
            <ModerationCard key={clip._id} clip={clip} />
          ))}
        </div>
      )}
    </div>
  )
}
