'use client'

import { Server as ServerIcon } from 'lucide-react'
import type { CliServer } from '../types/cli'
import { cn } from '@/lib/utils'

const statusClasses: Record<string, string> = {
  online: 'bg-[var(--cli-status-online)]',
  offline: 'bg-[var(--cli-status-offline)]',
  standalone: 'bg-[var(--cli-status-idle)]',
  error: 'bg-[var(--cli-status-error)]',
  idle: 'bg-[var(--cli-status-idle)]',
  busy: 'bg-[var(--cli-status-busy)]',
}

function formatTimestamp(value?: string | null) {
  if (!value) return 'n/a'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'n/a'
  return parsed.toLocaleString()
}

function formatRelative(value?: string | null) {
  if (!value) return 'n/a'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'n/a'
  const diffMs = Date.now() - parsed.getTime()
  if (diffMs < 60_000) return 'just now'
  if (diffMs < 3_600_000) return `${Math.round(diffMs / 60_000)}m ago`
  if (diffMs < 86_400_000) return `${Math.round(diffMs / 3_600_000)}h ago`
  return `${Math.round(diffMs / 86_400_000)}d ago`
}

export function ServerCard({
  server,
  isActive,
  onSelect,
}: {
  server: CliServer
  isActive?: boolean
  onSelect?: () => void
}) {
  const statusClass = statusClasses[server.status] || statusClasses.offline

  return (
    <button
      data-cli-server-card
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      className={cn(
        'cli-console-row group w-full rounded-lg border border-white/30 bg-white/50 px-3 py-2 text-left transition',
        'hover:border-white/60 hover:bg-white/70',
        isActive && 'ring-2 ring-[var(--cli-accent-olive)]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--cli-ink-1)]">
            <span className={cn('h-2 w-2 rounded-full', statusClass)} />
            <ServerIcon className="h-4 w-4 text-[var(--cli-muted-1)]" />
            <span className="truncate max-w-[170px]">{server.name || server.hostname}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--cli-muted-1)]">
            <span className="truncate max-w-[190px]">{server.hostname}</span>
            <span className="h-1 w-1 rounded-full bg-[var(--cli-muted-2)]" />
            <span>{server.ip_address || 'n/a'}</span>
            <span className="h-1 w-1 rounded-full bg-[var(--cli-muted-2)]" />
            <span>Last heartbeat {formatRelative(server.last_seen_at)}</span>
          </div>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-[var(--cli-muted-1)]">
        {server.status} · Last heartbeat {formatTimestamp(server.last_seen_at)}
      </div>
    </button>
  )
}
