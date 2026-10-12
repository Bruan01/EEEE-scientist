'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  PauseCircle,
  XCircle,
} from 'lucide-react'
import type { PlanEventData } from '@/lib/types/chat-events'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function PlanPanel({
  plan,
  sessionId,
  compact,
  history,
}: {
  plan: PlanEventData
  sessionId?: string | null
  compact?: boolean
  history?: PlanEventData[]
}) {
  const storageKey = sessionId ? `ds:ai-manus:plan:${sessionId}` : 'ds:ai-manus:plan'
  const [expanded, setExpanded] = useState(false)
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({})
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('current')
  const reduceMotion = useReducedMotion()
  const isCompact = Boolean(compact)
  const panelMaxWidthClass = 'max-w-full'
  const panelWidthClass = 'w-[90%] max-w-full'
  const EASE_IN_OUT: [number, number, number, number] = [0.4, 0, 0.2, 1]
  const EASE_OUT: [number, number, number, number] = [0, 0, 0.2, 1]
  const EASE_LINEAR: [number, number, number, number] = [0, 0, 1, 1]

  const formatTimestamp = (timestamp: number | undefined) => {
    if (!timestamp) return 'Unknown'
    try {
      return new Date(timestamp * 1000).toLocaleString()
    } catch {
      return 'Unknown'
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(storageKey)
    if (stored === null) return
    setExpanded(stored === '1')
  }, [storageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(storageKey, expanded ? '1' : '0')
  }, [expanded, storageKey])

  const toggleTask = useCallback((key: string) => {
    setExpandedTasks((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const planHistory = useMemo(() => {
    if (!history || history.length === 0) return []
    return history.filter((entry) => entry?.task_plan?.tasks?.length || entry?.steps?.length)
  }, [history])

  useEffect(() => {
    if (!planHistory.length) {
      setSelectedSnapshotId('current')
    }
  }, [planHistory.length])

  const activePlan = useMemo(() => {
    if (!planHistory.length || selectedSnapshotId === 'current') return plan
    return planHistory.find((entry) => entry.event_id === selectedSnapshotId) || plan
  }, [plan, planHistory, selectedSnapshotId])

  const tasks = useMemo(() => activePlan.task_plan?.tasks || [], [activePlan])
  const displaySteps = useMemo(
    () => (tasks.length ? [] : activePlan.steps || []),
    [tasks.length, activePlan.steps]
  )

  useEffect(() => {
    setExpandedTasks({})
  }, [selectedSnapshotId, tasks.length])
  const timelineEntries = useMemo(() => {
    const currentEventId = typeof plan.event_id === 'string' ? plan.event_id : undefined
    const filteredHistory = planHistory.filter(
      (entry) => entry?.event_id && entry.event_id !== currentEventId
    )
    return [
      ...filteredHistory.map((entry) => ({
        id: entry.event_id as string,
        timestamp: entry.timestamp,
        kind: 'history' as const,
      })),
      {
        id: 'current',
        timestamp: plan.timestamp,
        kind: 'current' as const,
      },
    ]
  }, [plan.event_id, plan.timestamp, planHistory])
  const timelineActiveIndex = useMemo(() => {
    const index = timelineEntries.findIndex((entry) => entry.id === selectedSnapshotId)
    if (index >= 0) return index
    return Math.max(0, timelineEntries.length - 1)
  }, [timelineEntries, selectedSnapshotId])
  const timelineProgress = useMemo(() => {
    if (timelineEntries.length <= 1) return 0
    return Math.min(100, Math.max(0, (timelineActiveIndex / (timelineEntries.length - 1)) * 100))
  }, [timelineActiveIndex, timelineEntries.length])
  const timelineLabel = useMemo(() => {
    if (!planHistory.length) return 'Current snapshot'
    return selectedSnapshotId === 'current' ? 'Current snapshot' : 'Historical snapshot'
  }, [planHistory.length, selectedSnapshotId])

  const planProgress = useMemo(() => {
    if (tasks.length) {
      const completed = tasks.filter((task) => (task.status || '').toLowerCase() === 'completed').length
      return `${completed} / ${tasks.length || 1}`
    }
    const completed = displaySteps.filter((step) => step.status === 'completed').length
    return `${completed} / ${displaySteps.length || 1}`
  }, [displaySteps, tasks])

  const currentStep = useMemo(() => {
    if (tasks.length) {
      for (const task of tasks) {
        const status = (task.status || '').toLowerCase()
        if (!status || status !== 'completed') {
          return task.task
        }
      }
      return tasks[0]?.task || 'Task Progress'
    }
    for (const step of displaySteps) {
      if (!step.status || step.status !== 'completed') return step.description
    }
    return 'Task Progress'
  }, [displaySteps, tasks])

  const currentStatus = useMemo(() => {
    if (tasks.length) {
      const active = tasks.find((task) => {
        const status = (task.status || '').toLowerCase()
        return !status || status !== 'completed'
      })
      return active?.status || (tasks.length ? 'completed' : 'pending')
    }
    if (displaySteps.length) {
      const active = displaySteps.find((step) => step.status !== 'completed')
      return active?.status || (displaySteps.length ? 'completed' : 'pending')
    }
    return 'pending'
  }, [displaySteps, tasks])

  const statusMeta = useMemo(
    () => ({
      completed: {
        label: 'Completed',
        className: 'ai-manus-plan-badge ai-manus-plan-badge--completed',
        iconClass: 'ai-manus-plan-status-icon ai-manus-plan-status-icon--completed',
        Icon: CheckCircle,
        motion: reduceMotion
          ? undefined
          : {
              animate: { scale: [1, 1.06, 1], opacity: [0.82, 1, 0.82] },
              transition: { duration: 2.6, repeat: Infinity, ease: EASE_IN_OUT },
            },
      },
      running: {
        label: 'Running',
        className: 'ai-manus-plan-badge ai-manus-plan-badge--running',
        iconClass: 'ai-manus-plan-status-icon ai-manus-plan-status-icon--running',
        Icon: Loader2,
        motion: reduceMotion
          ? undefined
          : {
              animate: { rotate: 360 },
              transition: { duration: 1.1, repeat: Infinity, ease: EASE_LINEAR },
            },
      },
      pending: {
        label: 'Pending',
        className: 'ai-manus-plan-badge ai-manus-plan-badge--pending',
        iconClass: 'ai-manus-plan-status-icon ai-manus-plan-status-icon--pending',
        Icon: Clock,
        motion: reduceMotion
          ? undefined
          : {
              animate: { opacity: [0.55, 1, 0.55] },
              transition: { duration: 1.9, repeat: Infinity, ease: EASE_IN_OUT },
            },
      },
      blocked: {
        label: 'Blocked',
        className: 'ai-manus-plan-badge ai-manus-plan-badge--blocked',
        iconClass: 'ai-manus-plan-status-icon ai-manus-plan-status-icon--blocked',
        Icon: AlertTriangle,
        motion: reduceMotion
          ? undefined
          : {
              animate: { x: [0, -2, 2, -1, 1, 0] },
              transition: { duration: 0.8, repeat: Infinity, repeatDelay: 1.2 },
            },
      },
      paused: {
        label: 'Paused',
        className: 'ai-manus-plan-badge ai-manus-plan-badge--paused',
        iconClass: 'ai-manus-plan-status-icon ai-manus-plan-status-icon--paused',
        Icon: PauseCircle,
        motion: reduceMotion
          ? undefined
          : {
              animate: { scale: [1, 0.94, 1] },
              transition: { duration: 2.4, repeat: Infinity, ease: EASE_IN_OUT },
            },
      },
      failed: {
        label: 'Failed',
        className: 'ai-manus-plan-badge ai-manus-plan-badge--failed',
        iconClass: 'ai-manus-plan-status-icon ai-manus-plan-status-icon--failed',
        Icon: XCircle,
        motion: reduceMotion
          ? undefined
          : {
              animate: { rotate: [0, -6, 6, -3, 3, 0] },
              transition: { duration: 0.9, repeat: Infinity, repeatDelay: 1.4 },
            },
      },
    }),
    [reduceMotion]
  )

  const resolveStatusMeta = (raw?: string | null) => {
    const key = (raw || 'pending').toLowerCase()
    return statusMeta[key as keyof typeof statusMeta] || statusMeta.pending
  }

  const StatusIcon = ({ status, size = 14 }: { status?: string | null; size?: number }) => {
    const meta = resolveStatusMeta(status)
    const Icon = meta.Icon
    return (
      <motion.span className="flex h-4 w-4 items-center justify-center" {...(meta.motion || {})}>
        <Icon size={size} className={meta.iconClass} />
      </motion.span>
    )
  }

  const StatusBadge = ({ status }: { status?: string | null }) => {
    const meta = resolveStatusMeta(status)
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.08em] ${meta.className}`}
      >
        <StatusIcon status={status} size={12} />
        {meta.label}
      </span>
    )
  }

  return (
    <div
      className={`ai-manus-plan-panel relative inline-flex w-[90%] ${panelMaxWidthClass} [&:not(:empty)]:pb-2`}
    >
      {expanded ? (
        <div className={`flex ${panelWidthClass} min-w-0 flex-col`}>
          <div className="ai-manus-plan-frame rounded-[14px] p-[1px]">
            <div className="ai-manus-plan-surface flex max-h-[40vh] min-w-0 flex-col overflow-hidden rounded-[13px] py-4 backdrop-blur-[6px]">
              <div className="flex w-full items-center px-4 pb-4">
                <div className="flex flex-col">
                  <span
                    className={
                      isCompact
                        ? 'ai-manus-plan-title text-[13px] font-bold'
                        : 'ai-manus-plan-title text-[11px] font-bold'
                    }
                  >
                    Task Progress
                  </span>
                  <span className="ai-manus-plan-muted text-[10px]">{timelineLabel}</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="ai-manus-plan-muted text-[10px]">{planProgress}</span>
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    className="ai-manus-plan-icon-btn flex h-7 w-7 items-center justify-center rounded-md"
                  >
                    <ChevronDown size={16} className="ai-manus-plan-muted" />
                  </button>
                </div>
              </div>
              <div className="px-4 pb-4">
                <TooltipProvider>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="ai-manus-plan-label text-[9px] uppercase tracking-[0.22em]">
                      Timeline
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="relative flex w-full min-w-0 items-center justify-between gap-1.5 py-2 sm:gap-2">
                        <div
                          aria-hidden
                          className="ai-manus-plan-timeline-line absolute left-0 right-0 top-1/2 h-px -translate-y-1/2"
                        />
                        <motion.span
                          aria-hidden
                          className="ai-manus-plan-timeline-progress absolute left-0 top-1/2 h-px -translate-y-1/2"
                          animate={reduceMotion ? undefined : { width: `${timelineProgress}%` }}
                          style={reduceMotion ? { width: `${timelineProgress}%` } : undefined}
                          transition={reduceMotion ? undefined : { duration: 0.5, ease: EASE_OUT }}
                        />
                        {timelineEntries.map((entry, index) => {
                          const isActive = index === timelineActiveIndex
                          const dotSize = isActive
                            ? isCompact
                              ? 12
                              : 14
                            : isCompact
                              ? 7
                              : 8
                          const label =
                            entry.kind === 'current'
                              ? `Current · ${formatTimestamp(entry.timestamp)}`
                              : formatTimestamp(entry.timestamp)
                          return (
                            <div key={entry.id} className="relative flex min-w-0 items-center">
                              <Tooltip>
                                <TooltipTrigger>
                                  <motion.button
                                    type="button"
                                    onClick={() => setSelectedSnapshotId(entry.id)}
                                    className="ai-manus-plan-dot relative z-10 flex items-center justify-center rounded-full"
                                    style={{ width: dotSize, height: dotSize }}
                                    whileHover={
                                      reduceMotion
                                        ? undefined
                                        : { scale: isActive ? 1.06 : 1.18 }
                                    }
                                    animate={
                                      reduceMotion
                                        ? undefined
                                        : isActive
                                          ? { scale: [1, 1.08, 1] }
                                          : { scale: 1 }
                                    }
                                    transition={
                                      reduceMotion
                                        ? undefined
                                        : {
                                            duration: isActive ? 2.2 : 0.2,
                                            repeat: isActive ? Infinity : 0,
                                            ease: EASE_IN_OUT,
                                          }
                                    }
                                    aria-pressed={isActive}
                                    aria-label={label}
                                  >
                                    {isActive && !reduceMotion ? (
                                      <motion.span
                                        aria-hidden
                                        className="ai-manus-plan-dot-ring absolute inset-0 rounded-full border"
                                        animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                                        transition={{ duration: 1.8, repeat: Infinity, ease: EASE_OUT }}
                                      />
                                    ) : null}
                                  </motion.button>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="top"
                                  className="left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px]"
                                >
                                  {label}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </TooltipProvider>
              </div>
              <div className="flex min-h-0 flex-1 flex-col px-3">
                <div className="ai-manus-plan-body flex min-h-0 flex-1 flex-col rounded-[12px] pt-3 pb-2">
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {tasks.length ? (
                      <div className="flex flex-col gap-2 px-2 pb-2">
                        {tasks.map((task, index) => {
                          const taskKey = `${task.task}-${index}`
                          const isExpanded = Boolean(expandedTasks[taskKey])
                          return (
                            <motion.div
                              key={taskKey}
                              className="ai-manus-plan-task"
                              animate={reduceMotion ? undefined : { scale: isExpanded ? 1 : 0.98 }}
                              transition={reduceMotion ? undefined : { duration: 0.2, ease: EASE_OUT }}
                            >
                              <button
                                type="button"
                                onClick={() => toggleTask(taskKey)}
                                className="ai-manus-plan-task-title flex w-full items-start justify-between gap-2 text-left"
                                aria-expanded={isExpanded}
                              >
                                <span className="ai-manus-plan-title text-[12px] font-semibold">
                                  {task.task}
                                </span>
                                <StatusBadge status={task.status} />
                              </button>
                              {isExpanded ? (
                                <div className="ai-manus-plan-task-details mt-2">
                                  {task.detail ? (
                                    <div className="ai-manus-plan-muted text-[11px]">
                                      {task.detail}
                                    </div>
                                  ) : null}
                                  {task.change_reason ? (
                                    <div className="ai-manus-plan-note mt-1 text-[10px]">
                                      {task.change_reason}
                                    </div>
                                  ) : null}
                                  {task.sub_tasks.length ? (
                                    <div className="ai-manus-plan-subtext mt-2 flex flex-col gap-1 text-[10px]">
                                      {task.sub_tasks.map((subTask, subIndex) => (
                                        <div key={`${taskKey}-sub-${subIndex}`} className="flex gap-2">
                                          <span className="ai-manus-plan-bullet">•</span>
                                          <span>{subTask}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </motion.div>
                          )
                        })}
                      </div>
                    ) : (
                      displaySteps.map((step) => (
                        <div key={step.id} className="flex items-start gap-2.5 px-4 py-2">
                          <StatusIcon status={step.status} size={14} />
                          <div
                            className={
                              isCompact
                                ? 'ai-manus-plan-title flex-1 truncate text-[12px]'
                                : 'ai-manus-plan-title flex-1 truncate text-[10px]'
                            }
                            title={step.description}
                          >
                            {step.description}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={`inline-flex w-auto min-w-[min(260px,100%)] ${panelMaxWidthClass} items-start justify-between gap-2 text-left`}
        >
          <div className="ai-manus-plan-frame ai-manus-plan-frame--collapsed rounded-[14px] p-[1px]">
            <div className="ai-manus-plan-summary inline-flex w-auto min-w-[min(260px,100%)] items-start justify-between gap-2 rounded-[13px] px-3 py-2">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <StatusIcon status={currentStatus} size={14} />
                <div
                  className={
                    isCompact
                      ? 'ai-manus-plan-muted truncate text-[12px]'
                      : 'ai-manus-plan-muted truncate text-[10px]'
                  }
                  title="Task Progress"
                >
                  Task Progress
                </div>
              </div>
              <div
                className={
                  isCompact
                    ? 'ai-manus-plan-muted flex items-center gap-2 text-[11px]'
                    : 'ai-manus-plan-muted flex items-center gap-2 text-[9px]'
                }
              >
                {!isCompact ? <span className="hidden sm:inline">{planProgress}</span> : null}
                <ChevronUp size={16} className="ai-manus-plan-muted" />
              </div>
            </div>
          </div>
        </button>
      )}
    </div>
  )
}

export default PlanPanel
