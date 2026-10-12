"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { listCliTasks } from '@/lib/api/cli'
import { Loader2, ListTodo } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCliStore } from '../stores/cli-store'
import { sendBrowserNotification } from '../services/notification-service'
import { FadeContent, SpotlightCard } from '@/components/react-bits'

type CliTask = { id: string; title: string; status: string; updated_at: string }

function formatTimestamp(value?: string) {
  if (!value) return 'n/a'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'n/a'
  return parsed.toLocaleString()
}

function isCompletionStatus(status: string) {
  const normalized = status.toLowerCase()
  return (
    normalized.includes('completed') ||
    normalized.includes('complete') ||
    normalized.includes('done') ||
    normalized.includes('success') ||
    normalized.includes('failed') ||
    normalized.includes('error') ||
    normalized.includes('cancelled') ||
    normalized.includes('canceled')
  )
}

function isFailureStatus(status: string) {
  const normalized = status.toLowerCase()
  return (
    normalized.includes('failed') ||
    normalized.includes('error') ||
    normalized.includes('cancelled') ||
    normalized.includes('canceled')
  )
}

function getStatusClasses(status: string) {
  const completed = isCompletionStatus(status)
  const failed = isFailureStatus(status)
  if (failed) return 'bg-[var(--cli-status-offline)] text-[var(--cli-ink-0)]'
  if (completed) return 'bg-[var(--cli-accent-emerald)] text-[var(--cli-ink-0)]'
  return 'bg-[var(--cli-status-warning)] text-[var(--cli-ink-0)]'
}

export function TasksPanel({ projectId, serverId }: { projectId: string; serverId: string }) {
  const [items, setItems] = useState<CliTask[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const addNotification = useCliStore((state) => state.addNotification)
  const servers = useCliStore((state) => state.servers)
  const previousStatusesRef = useRef<Map<string, string>>(new Map())
  const hasLoadedRef = useRef(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const summary = useMemo(() => {
    const running = items.filter((task) => !isCompletionStatus(task.status)).length
    const failed = items.filter((task) => isFailureStatus(task.status)).length
    const completed = items.filter((task) => isCompletionStatus(task.status) && !isFailureStatus(task.status)).length
    return { running, failed, completed }
  }, [items])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await listCliTasks(projectId, serverId)
        if (mounted) {
          setItems(data)
          if (hasLoadedRef.current) {
            const serverName =
              servers.find((server) => server.id === serverId)?.name ||
              servers.find((server) => server.id === serverId)?.hostname ||
              'CLI server'
            data.forEach((task) => {
              const previousStatus = previousStatusesRef.current.get(task.id)
              if (previousStatus && previousStatus !== task.status && isCompletionStatus(task.status)) {
                const failed = isFailureStatus(task.status)
                const title = failed ? 'Task failed' : 'Task completed'
                addNotification({
                  id: crypto.randomUUID(),
                  title,
                  body: `${serverName}: ${task.title}`,
                  level: failed ? 'error' : 'success',
                  createdAt: Date.now(),
                })
                sendBrowserNotification(title, `${serverName}: ${task.title}`)
              }
            })
          }
          previousStatusesRef.current = new Map(data.map((task) => [task.id, task.status]))
          hasLoadedRef.current = true
        }
      } catch (err) {
        if (mounted) setError('Failed to load tasks.')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    const interval = window.setInterval(() => {
      void load()
    }, 15000)

    void load()
    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [projectId, serverId, servers, addNotification])

  useEffect(() => {
    if (!listRef.current || items.length === 0) return
    if (typeof window === 'undefined') return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    let cancelled = false
    const targets = listRef.current.querySelectorAll('[data-cli-task-item]')
    if (targets.length === 0) return

    import('animejs')
      .then(({ default: anime }) => {
        if (cancelled) return
        anime({
          targets,
          opacity: [0, 1],
          translateY: [8, 0],
          delay: anime.stagger(50),
          duration: 420,
          easing: 'easeOutCubic',
        })
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [items])

  return (
    <div className="space-y-4">
      <FadeContent duration={0.4} y={10}>
        <SpotlightCard className="rounded-2xl border border-white/40 bg-white/70 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--cli-ink-1)]">
            <ListTodo className="h-4 w-4" />
            Task overview
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs text-[var(--cli-muted-1)]">
            <div className="rounded-lg border border-white/40 bg-white/60 px-3 py-2">
              Running: <span className="font-semibold text-[var(--cli-ink-1)]">{summary.running}</span>
            </div>
            <div className="rounded-lg border border-white/40 bg-white/60 px-3 py-2">
              Completed: <span className="font-semibold text-[var(--cli-ink-1)]">{summary.completed}</span>
            </div>
            <div className="rounded-lg border border-white/40 bg-white/60 px-3 py-2">
              Failed: <span className="font-semibold text-[var(--cli-ink-1)]">{summary.failed}</span>
            </div>
          </div>
        </SpotlightCard>
      </FadeContent>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-sm text-[var(--cli-muted-1)]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading tasks...
        </div>
      ) : error ? (
        <SpotlightCard className="rounded-xl border border-white/40 bg-white/70 p-4 text-sm text-[var(--cli-muted-1)]">
          {error}
        </SpotlightCard>
      ) : items.length === 0 ? (
        <SpotlightCard className="rounded-xl border border-white/40 bg-white/70 p-4 text-sm text-[var(--cli-muted-1)]">
          No tasks yet. Task activity will appear here once the CLI agent starts running jobs.
        </SpotlightCard>
      ) : (
        <FadeContent delay={0.05} duration={0.4} y={10}>
          <div ref={listRef} className="space-y-3">
            {items.map((task) => (
              <div
                key={task.id}
                data-cli-task-item
                className="rounded-xl border border-white/40 bg-white/70 px-4 py-3 text-sm text-[var(--cli-ink-1)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{task.title}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-medium',
                      getStatusClasses(task.status)
                    )}
                  >
                    {task.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-[var(--cli-muted-1)]">
                  Updated: {formatTimestamp(task.updated_at)}
                </div>
              </div>
            ))}
          </div>
        </FadeContent>
      )}
    </div>
  )
}
