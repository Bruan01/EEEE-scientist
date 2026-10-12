'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { Download, FileDown, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useOperationLogs } from '../hooks/useOperationLogs'
import { OperationLogItem } from './OperationLogItem'
import { FadeContent, SpotlightCard } from '@/components/react-bits'

type LogEntry = {
  event_type?: string
  eventType?: string
  timestamp?: string
  ts?: string
  actor_user_id?: string
  user_id?: string
  level?: string
  severity?: string
  message?: string
  payload?: Record<string, unknown>
  [key: string]: unknown
}

function toIso(value: string) {
  if (!value) return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString()
}

function formatTimestamp(value?: string) {
  if (!value) return 'n/a'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'n/a'
  return parsed.toLocaleString()
}

async function parseEntries(payload: unknown): Promise<LogEntry[]> {
  if (!payload) return []
  if (payload instanceof Blob) {
    const text = await payload.text()
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as LogEntry
        } catch {
          return { message: line }
        }
      })
  }
  if (Array.isArray(payload)) return payload as LogEntry[]
  if (typeof payload === 'string') {
    return payload
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as LogEntry
        } catch {
          return { message: line }
        }
      })
  }
  if (typeof payload === 'object' && payload) {
    return [payload as LogEntry]
  }
  return []
}

function escapeCsv(value: string) {
  const escaped = value.replace(/"/g, '""')
  return `"${escaped}"`
}

function exportCsv(entries: LogEntry[]): string {
  const header = ['timestamp', 'event_type', 'actor_user_id', 'level', 'message', 'payload']
  const rows = entries.map((entry) => {
    const timestamp = String(entry.timestamp || entry.ts || '')
    const eventType = String(entry.event_type || entry.eventType || '')
    const actor = String(entry.actor_user_id || entry.user_id || '')
    const level = String(entry.level || entry.severity || '')
    const message = String(entry.message || '')
    const payload = entry.payload ? JSON.stringify(entry.payload) : ''
    return [
      escapeCsv(timestamp),
      escapeCsv(eventType),
      escapeCsv(actor),
      escapeCsv(level),
      escapeCsv(message),
      escapeCsv(payload),
    ].join(',')
  })
  return [header.join(','), ...rows].join('\n')
}

export function OperationLogs({
  projectId,
  serverId,
  canViewAll,
}: {
  projectId: string
  serverId: string
  canViewAll?: boolean
}) {
  const { items, isLoading, error, downloadLog, load, loadMore, total } = useOperationLogs(projectId, serverId)
  const { addToast } = useToast()
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [eventQuery, setEventQuery] = useState('')
  const [actorQuery, setActorQuery] = useState('')
  const [levelQuery, setLevelQuery] = useState('')
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [entriesError, setEntriesError] = useState<string | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const listRef = useRef<HTMLDivElement | null>(null)

  const handleDownload = useCallback(
    async (logId: string) => {
      const payload = await downloadLog(logId, { download: true })
      if (!payload || !(payload instanceof Blob)) return
      const url = URL.createObjectURL(payload)
      const link = document.createElement('a')
      link.href = url
      link.download = `${logId}.jsonl.gz`
      link.click()
      URL.revokeObjectURL(url)
    },
    [downloadLog]
  )

  const handleApplyRange = useCallback(() => {
    const params: { start_time?: string; end_time?: string } = {}
    const startIso = toIso(startTime)
    const endIso = toIso(endTime)
    if (startIso) params.start_time = startIso
    if (endIso) params.end_time = endIso
    setEntries([])
    void load(params)
  }, [startTime, endTime, load])

  const handleClearFilters = useCallback(() => {
    setStartTime('')
    setEndTime('')
    setEventQuery('')
    setActorQuery('')
    setLevelQuery('')
    setEntries([])
    void load({})
  }, [load])

  const handleLoadEntries = useCallback(async () => {
    if (items.length === 0) return
    setEntriesLoading(true)
    setEntriesError(null)
    try {
      const aggregated: LogEntry[] = []
      for (const log of items) {
        const payload = await downloadLog(log.id, { decompress: true })
        const parsed = await parseEntries(payload)
        aggregated.push(...parsed)
      }
      setEntries(aggregated)
    } catch (err) {
      console.error('[CLI] Failed to load log entries:', err)
      setEntriesError('Failed to load log entries')
    } finally {
      setEntriesLoading(false)
    }
  }, [downloadLog, items])

  const filteredEntries = useMemo(() => {
    const normalizedEvent = eventQuery.trim().toLowerCase()
    const normalizedActor = actorQuery.trim().toLowerCase()
    const normalizedLevel = levelQuery.trim().toLowerCase()
    const startIso = toIso(startTime)
    const endIso = toIso(endTime)
    return entries.filter((entry) => {
      if (normalizedEvent) {
        const eventType = String(entry.event_type || entry.eventType || '').toLowerCase()
        if (!eventType.includes(normalizedEvent)) return false
      }
      if (normalizedActor) {
        const actor = String(entry.actor_user_id || entry.user_id || '').toLowerCase()
        if (!actor.includes(normalizedActor)) return false
      }
      if (normalizedLevel) {
        const level = String(entry.level || entry.severity || '').toLowerCase()
        if (!level.includes(normalizedLevel)) return false
      }
      if (startIso || endIso) {
        const stamp = entry.timestamp || entry.ts
        if (stamp) {
          const time = new Date(String(stamp)).toISOString()
          if (startIso && time < startIso) return false
          if (endIso && time > endIso) return false
        }
      }
      return true
    })
  }, [entries, eventQuery, actorQuery, levelQuery, startTime, endTime])

  const handleExport = useCallback(
    (format: 'json' | 'csv') => {
      if (filteredEntries.length === 0) return
      try {
        const blob =
          format === 'json'
            ? new Blob([JSON.stringify(filteredEntries, null, 2)], { type: 'application/json' })
            : new Blob([exportCsv(filteredEntries)], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `cli-logs-${serverId}.${format}`
        link.click()
        URL.revokeObjectURL(url)
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Export failed',
          description: 'Unable to export log entries.',
        })
      }
    },
    [addToast, filteredEntries, serverId]
  )

  const rowHeight = 44
  const viewportHeight = listRef.current?.clientHeight ?? 360
  const totalHeight = filteredEntries.length * rowHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 6)
  const endIndex = Math.min(
    filteredEntries.length,
    Math.ceil((scrollTop + viewportHeight) / rowHeight) + 6
  )
  const visible = filteredEntries.slice(startIndex, endIndex)
  const offsetY = startIndex * rowHeight

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-[var(--cli-muted-1)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading logs...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-white/40 bg-white/70 p-4 text-sm text-[var(--cli-muted-1)]">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <FadeContent duration={0.45} y={12}>
        <SpotlightCard className="rounded-2xl border border-white/40 bg-white/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--cli-ink-1)]">Logs</div>
              <div className="text-xs text-[var(--cli-muted-1)]">
                Audit terminal, file, and system operations.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => load()} disabled={isLoading}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Refresh list
              </Button>
            </div>
          </div>
        </SpotlightCard>
      </FadeContent>

      <FadeContent duration={0.45} y={12}>
        <SpotlightCard className="rounded-2xl border border-white/40 bg-white/70 p-4 text-xs text-[var(--cli-muted-1)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--cli-ink-1)]">Filters</div>
              <div className="mt-1 text-[10px] text-[var(--cli-muted-1)]">
                {items.length} log objects loaded · {total} total
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleApplyRange}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Apply
              </Button>
              <Button variant="secondary" size="sm" onClick={handleClearFilters}>
                Clear
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="cli-logs-start">Start</label>
              <input
                id="cli-logs-start"
                type="datetime-local"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="cli-focus-ring rounded-lg border border-white/50 bg-white/70 px-2 py-1 text-xs text-[var(--cli-ink-1)]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="cli-logs-end">End</label>
              <input
                id="cli-logs-end"
                type="datetime-local"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="cli-focus-ring rounded-lg border border-white/50 bg-white/70 px-2 py-1 text-xs text-[var(--cli-ink-1)]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="cli-logs-event">Event</label>
              <input
                id="cli-logs-event"
                value={eventQuery}
                onChange={(event) => setEventQuery(event.target.value)}
                placeholder="terminal_input"
                className="cli-focus-ring rounded-lg border border-white/50 bg-white/70 px-2 py-1 text-xs text-[var(--cli-ink-1)]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="cli-logs-actor">Actor</label>
              <input
                id="cli-logs-actor"
                value={actorQuery}
                onChange={(event) => setActorQuery(event.target.value)}
                placeholder={canViewAll ? 'user id' : 'Admin only'}
                disabled={!canViewAll}
                className="cli-focus-ring rounded-lg border border-white/50 bg-white/70 px-2 py-1 text-xs text-[var(--cli-ink-1)] disabled:opacity-60"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="cli-logs-level">Level</label>
              <input
                id="cli-logs-level"
                value={levelQuery}
                onChange={(event) => setLevelQuery(event.target.value)}
                placeholder="warn"
                className="cli-focus-ring rounded-lg border border-white/50 bg-white/70 px-2 py-1 text-xs text-[var(--cli-ink-1)]"
              />
            </div>
          </div>
        </SpotlightCard>
      </FadeContent>

      <FadeContent delay={0.05} duration={0.45} y={12}>
        <div className="space-y-3">
          {items.map((log) => (
            <OperationLogItem key={log.id} log={log} onDownload={handleDownload} />
          ))}
          {items.length === 0 ? (
            <div className="rounded-xl border border-white/40 bg-white/70 p-4 text-sm text-[var(--cli-muted-1)]">
              No logs available yet.
            </div>
          ) : null}
          {items.length > 0 && items.length < total ? (
            <div className="flex items-center justify-between rounded-xl border border-white/40 bg-white/70 px-4 py-2 text-xs text-[var(--cli-muted-1)]">
              <span>
                Showing {items.length} of {total} log objects
              </span>
              <Button variant="secondary" size="sm" onClick={loadMore} disabled={isLoading}>
                Load more
              </Button>
            </div>
          ) : null}
        </div>
      </FadeContent>

      <SpotlightCard className="rounded-2xl border border-white/40 bg-white/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-[var(--cli-ink-1)]">Entries</div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleLoadEntries} disabled={entriesLoading}>
              <Download className="mr-2 h-3.5 w-3.5" />
              Load entries
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExport('json')}
              disabled={filteredEntries.length === 0}
            >
              <FileDown className="mr-2 h-3.5 w-3.5" />
              Export JSON
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExport('csv')}
              disabled={filteredEntries.length === 0}
            >
              Export CSV
            </Button>
          </div>
        </div>

        {entriesLoading ? (
          <div className="mt-4 flex items-center text-sm text-[var(--cli-muted-1)]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading log entries...
          </div>
        ) : null}

        {entriesError ? (
          <div className="mt-4 text-sm text-[var(--cli-muted-1)]">{entriesError}</div>
        ) : null}

        {filteredEntries.length === 0 && !entriesLoading ? (
          <div className="mt-4 text-sm text-[var(--cli-muted-1)]">
            Load entries to filter and export.
          </div>
        ) : null}

        {filteredEntries.length > 0 ? (
          <div
            ref={listRef}
            className="mt-4 h-80 overflow-auto rounded-xl border border-white/40 bg-white/60"
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          >
            <div style={{ height: totalHeight }} className="relative">
              <div style={{ transform: `translateY(${offsetY}px)` }}>
                {visible.map((entry, index) => {
                  const stamp = String(entry.timestamp || entry.ts || '')
                  const eventType = String(entry.event_type || entry.eventType || '')
                  const actor = String(entry.actor_user_id || entry.user_id || '')
                  const level = String(entry.level || entry.severity || '')
                  const payload = entry.payload ? JSON.stringify(entry.payload) : ''
                  return (
                    <div
                      key={`${startIndex + index}-${stamp}-${eventType}`}
                      className="flex items-center justify-between gap-3 border-b border-white/30 px-3 py-2 text-xs text-[var(--cli-muted-1)]"
                    >
                      <div className="min-w-[160px] text-[var(--cli-ink-1)]">
                        {formatTimestamp(stamp)}
                      </div>
                      <div className="min-w-[120px] text-[var(--cli-ink-1)]">{eventType || 'event'}</div>
                      <div className="min-w-[120px]">{actor || 'n/a'}</div>
                      <div className="min-w-[80px]">{level || 'n/a'}</div>
                      <div className="flex-1 truncate text-[10px] text-[var(--cli-muted-1)]">
                        {payload || entry.message || ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : null}
      </SpotlightCard>
    </div>
  )
}
