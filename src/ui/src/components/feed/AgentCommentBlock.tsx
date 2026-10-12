import { ArrowRight, Clock3, Lightbulb, ShieldAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { formatCadenceLabel, formatDurationCompact } from '@/lib/agentComment'
import { cn } from '@/lib/utils'
import type { AgentComment } from '@/types'

export function AgentCommentBlock({
  comment,
  monitorPlanSeconds,
  monitorStepIndex,
  nextCheckAfterSeconds,
  title = 'Agent note',
  className,
}: {
  comment?: AgentComment | null
  monitorPlanSeconds?: number[]
  monitorStepIndex?: number | null
  nextCheckAfterSeconds?: number | null
  title?: string
  className?: string
}) {
  if (!comment) {
    return null
  }

  const plan = (monitorPlanSeconds?.length ? monitorPlanSeconds : []).filter(
    (item) => Number.isFinite(item) && item > 0
  )
  const activeIndex = typeof monitorStepIndex === 'number' && monitorStepIndex >= 0 ? monitorStepIndex : null
  const nextLabel = formatDurationCompact(nextCheckAfterSeconds ?? comment.checkAfterSeconds ?? null)

  return (
    <div
      className={cn(
        'rounded-[20px] border border-black/[0.05] bg-black/[0.025] px-3 py-3 text-xs leading-6 text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.04]',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <Lightbulb className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />
        <span className="font-medium text-foreground">{title}</span>
        {comment.checkStage ? <Badge>{comment.checkStage}</Badge> : null}
        {nextLabel ? (
          <Badge className="bg-black/[0.03] dark:bg-white/[0.04]">
            <Clock3 className="mr-1 h-3 w-3" />
            next {nextLabel}
          </Badge>
        ) : null}
      </div>

      {comment.summary ? (
        <div className="mt-2 text-[13px] leading-6 text-foreground">{comment.summary}</div>
      ) : comment.raw ? (
        <div className="mt-2 text-[13px] leading-6 text-foreground">{comment.raw}</div>
      ) : null}

      {comment.whyNow ? (
        <div className="mt-2">
          <span className="font-medium text-foreground">Why now.</span> {comment.whyNow}
        </div>
      ) : null}

      {comment.next ? (
        <div className="mt-2 flex items-start gap-2">
          <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-300" />
          <div>
            <span className="font-medium text-foreground">Next.</span> {comment.next}
          </div>
        </div>
      ) : null}

      {comment.risks?.length ? (
        <div className="mt-2">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <ShieldAlert className="h-3.5 w-3.5 text-rose-600 dark:text-rose-300" />
            Risks
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            {comment.risks.map((risk) => (
              <Badge key={risk} className="bg-rose-500/10 text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">
                {risk}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {plan.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {plan.map((seconds, index) => {
            const isActive = activeIndex === index
            const isCompleted = activeIndex != null && index < activeIndex
            return (
              <span
                key={`${seconds}:${index}`}
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium transition',
                  isActive
                    ? 'bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/20 dark:bg-amber-300/10 dark:text-amber-200 dark:ring-amber-300/20'
                    : isCompleted
                      ? 'bg-sky-500/12 text-sky-700 dark:bg-sky-300/10 dark:text-sky-200'
                      : 'bg-black/[0.04] text-muted-foreground dark:bg-white/[0.04]'
                )}
              >
                {formatCadenceLabel(seconds)}
              </span>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default AgentCommentBlock
