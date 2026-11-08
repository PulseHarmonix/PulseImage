import { CheckCircle2, Clock3, Loader2, XCircle, X } from 'lucide-react'
import { useQueueStore } from '../../stores/queue'
import { useUiStore } from '../../stores/ui'
import { Badge, Button, EmptyState, IconButton, Progress } from '../ui'
import { cn, formatDuration } from '../../lib/utils'
import type { QueueJob } from '../../types'

export function QueuePanel() {
  const open = useUiStore((s) => s.queueOpen)
  const setOpen = useUiStore((s) => s.setQueueOpen)
  const jobs = useQueueStore((s) => s.jobs)
  const clearFinished = useQueueStore((s) => s.clearFinished)
  if (!open) return null

  return (
    <div className="fixed bottom-24 right-4 z-[75] flex max-h-[min(560px,calc(100dvh-140px))] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-line-strong bg-surface/95 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="font-display text-sm font-semibold">Queue</p>
          <p className="text-[10px] text-text-3">
            {jobs.filter((job) => job.status === 'running').length} running ·{' '}
            {jobs.filter((job) => job.status === 'queued').length} queued
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={clearFinished}>
            Clear
          </Button>
          <IconButton onClick={() => setOpen(false)} aria-label="Close queue">
            <X className="size-4" />
          </IconButton>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {jobs.length ? (
          <div className="space-y-2">
            {jobs.map((job) => (
              <QueueCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Clock3 className="size-6" />}
            title="Queue is empty"
            description="Your running, queued, and failed jobs will appear here."
          />
        )}
      </div>
    </div>
  )
}

function QueueCard({ job }: { job: QueueJob }) {
  const isActive = job.status === 'running'
  const isDone = job.status === 'done'
  const isError = job.status === 'error'
  const stageLabel = isDone
    ? 'generated'
    : isError
      ? job.stage || 'error'
      : isActive && job.progress >= 99
        ? 'finalizing'
        : job.stage || job.mode
  return (
    <div className="rounded-xl border border-line bg-white/[0.025] p-3">
      <div className="flex items-start gap-2">
        <div
          className={cn(
            'mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg',
            isDone && 'bg-success/10 text-success',
            isError && 'bg-danger-soft text-danger',
            isActive && 'bg-lime-soft text-lime',
            job.status === 'queued' && 'bg-white/[0.05] text-text-3',
          )}
        >
          {isDone ? (
            <CheckCircle2 className="size-3.5" />
          ) : isError ? (
            <XCircle className="size-3.5" />
          ) : isActive ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Clock3 className="size-3.5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-text">{job.label}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <Badge tone={isError ? 'danger' : isDone ? 'success' : 'default'}>
              {stageLabel}
            </Badge>
            <span className="text-[9px] text-text-3">
              {isDone || isError
                ? formatDuration(((job.finishedAt ?? Date.now()) - job.startedAt) / 1000)
                : `${Math.round(job.progress)}%`}
            </span>
          </div>
          {isActive ? <Progress value={job.progress} className="mt-2" /> : null}
          {isError && job.error ? (
            <p className="mt-1 line-clamp-2 text-[10px] text-danger">{job.error}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
