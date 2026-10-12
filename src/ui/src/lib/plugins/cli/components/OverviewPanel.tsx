import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Cpu, HardDrive, MemoryStick, RefreshCw, Server as ServerIcon, Wifi } from 'lucide-react'
import type { CliServer } from '../types/cli'
import type { ConnectionStatus } from '../types/connection'
import {
  getCliHealth,
  refreshCliServerStatus,
  unbindCliServer,
  type CliHealthCheck,
  type CliHealthResponse,
} from '@/lib/api/cli'
import { CountUp, FadeContent, SpotlightCard } from '@/components/react-bits'
import { cn } from '@/lib/utils'
import { NotificationCenter } from './NotificationCenter'
import { ServerTelemetryPanel } from './ServerTelemetryPanel'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { useCliStore } from '../stores/cli-store'

const statusClasses: Record<string, string> = {
  online: 'bg-[var(--cli-status-online)] text-[var(--cli-ink-0)]',
  offline: 'bg-[var(--cli-status-offline)] text-[var(--cli-ink-0)]',
  standalone: 'bg-[var(--cli-status-idle)] text-[var(--cli-ink-0)]',
  error: 'bg-[var(--cli-status-error)] text-[var(--cli-ink-0)]',
  idle: 'bg-[var(--cli-status-idle)] text-[var(--cli-ink-0)]',
  busy: 'bg-[var(--cli-status-busy)] text-[var(--cli-ink-0)]',
}

function formatTimestamp(value?: string | null) {
  if (!value) return 'n/a'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'n/a'
  return parsed.toLocaleString()
}

function MetricCard({
  label,
  value,
  suffix,
  icon,
}: {
  label: string
  value?: number | null
  suffix?: string
  icon?: ReactNode
}) {
  const hasValue = typeof value === 'number' && Number.isFinite(value)
  return (
    <SpotlightCard className="cli-card rounded-2xl border border-white/40 bg-white/70 p-4 shadow-[0_8px_20px_rgba(20,20,20,0.08)]">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--cli-muted-1)]">
        {icon ? <span className="text-[var(--cli-muted-1)]">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1 text-lg font-semibold text-[var(--cli-ink-1)]">
        {hasValue ? (
          <CountUp to={value ?? 0} duration={0.6} className="tabular-nums" />
        ) : (
          <span>n/a</span>
        )}
        {suffix ? <span className="text-sm text-[var(--cli-muted-1)]">{suffix}</span> : null}
      </div>
    </SpotlightCard>
  )
}

const healthStatusClasses: Record<string, string> = {
  healthy: 'bg-[var(--cli-accent-emerald)] text-[var(--cli-ink-0)]',
  degraded: 'bg-[var(--cli-status-warning)] text-[var(--cli-ink-0)]',
  unhealthy: 'bg-[var(--cli-status-offline)] text-[var(--cli-ink-0)]',
  ready: 'bg-[var(--cli-accent-emerald)] text-[var(--cli-ink-0)]',
  not_ready: 'bg-[var(--cli-status-warning)] text-[var(--cli-ink-0)]',
}

const healthLabelMap: Record<string, string> = {
  database: 'Database',
  redis: 'Redis',
  websocket: 'WebSocket',
  cli_servers: 'CLI servers',
}

function formatHealthDetail(check?: CliHealthCheck) {
  if (!check) return ''
  if (check.error) return check.error
  if (typeof check.latency_ms === 'number') {
    return `${Math.round(check.latency_ms)} ms`
  }
  if (typeof check.active_connections === 'number') {
    return `${check.active_connections} connections`
  }
  if (typeof check.online_count === 'number') {
    return `${check.online_count} online`
  }
  return ''
}

export function OverviewPanel({
  projectId,
  server,
  connectionStatus,
  accessLabel,
  canUnbind,
}: {
  projectId: string
  server: CliServer
  connectionStatus?: ConnectionStatus
  accessLabel?: string
  canUnbind?: boolean
}) {
  const statusClass = statusClasses[server.status] || statusClasses.offline
  const connectionLabel = connectionStatus?.state ?? 'disconnected'
  const latencyLabel =
    connectionStatus?.latencyMs != null ? `${Math.round(connectionStatus.latencyMs)} ms` : 'n/a'
  const metrics = connectionStatus?.metrics
  const averageReconnect =
    metrics?.averageReconnectTime != null && metrics.averageReconnectTime > 0
      ? `${Math.round(metrics.averageReconnectTime)} ms`
      : 'n/a'

  const [health, setHealth] = useState<CliHealthResponse | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [gpuRefreshing, setGpuRefreshing] = useState(false)
  const [unbindLoading, setUnbindLoading] = useState(false)
  const { addToast } = useToast()
  const refreshServers = useCliStore((state) => state.refreshServers)

  const refreshHealth = useCallback(async () => {
    setHealthLoading(true)
    setHealthError(null)
    try {
      const data = await getCliHealth()
      setHealth(data)
    } catch (err) {
      setHealthError('Unable to load system health.')
    } finally {
      setHealthLoading(false)
    }
  }, [])

  const refreshGpu = useCallback(async () => {
    if (gpuRefreshing) return
    setGpuRefreshing(true)
    try {
      await refreshCliServerStatus(projectId, server.id)
      addToast({
        type: 'success',
        title: 'Refresh requested',
        description: 'Waiting for the CLI agent to report new hardware info.',
      })
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Refresh failed',
        description: 'CLI server is offline or unavailable.',
      })
    } finally {
      setGpuRefreshing(false)
    }
  }, [addToast, gpuRefreshing, projectId, server.id])

  const handleUnbind = useCallback(async () => {
    if (!canUnbind || unbindLoading) return
    const confirmed = window.confirm(
      'Unbind this server? The CLI agent will disconnect and can be reconnected by logging in again.'
    )
    if (!confirmed) return
    setUnbindLoading(true)
    try {
      await unbindCliServer(projectId, server.id)
      await refreshServers()
      addToast({
        type: 'success',
        title: 'Server unbound',
        description: 'The CLI agent has been disconnected. Re-login to bind again.',
      })
    } catch {
      addToast({
        type: 'error',
        title: 'Unbind failed',
        description: 'Unable to unbind this server.',
      })
    } finally {
      setUnbindLoading(false)
    }
  }, [addToast, canUnbind, projectId, refreshServers, server.id, unbindLoading])

  useEffect(() => {
    void refreshHealth()
  }, [refreshHealth, server.id])

  const healthItems = useMemo(() => {
    if (!health?.checks) return []
    return Object.entries(health.checks).map(([key, check]) => ({
      key,
      label: healthLabelMap[key] ?? key,
      status: check.status,
      detail: formatHealthDetail(check),
    }))
  }, [health])

  return (
    <div className="space-y-6">
      <FadeContent duration={0.4} y={10}>
        <SpotlightCard className="cli-card rounded-2xl border border-white/40 bg-white/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--cli-ink-1)]">Overview</div>
              <div className="text-xs text-[var(--cli-muted-1)]">
                System health, hardware, and connection telemetry.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void refreshHealth()} disabled={healthLoading}>
                <RefreshCw className={cn('mr-2 h-3.5 w-3.5', healthLoading ? 'animate-spin' : '')} />
                Refresh health
              </Button>
              <Button variant="secondary" size="sm" onClick={refreshGpu} disabled={gpuRefreshing}>
                <RefreshCw className={cn('mr-2 h-3.5 w-3.5', gpuRefreshing ? 'animate-spin' : '')} />
                Refresh GPU
              </Button>
              {canUnbind ? (
                <Button variant="destructive" size="sm" onClick={() => void handleUnbind()} disabled={unbindLoading}>
                  Unbind server
                </Button>
              ) : null}
            </div>
          </div>
        </SpotlightCard>
      </FadeContent>

      <FadeContent duration={0.45} y={12}>
        <SpotlightCard className="cli-card rounded-2xl border border-white/40 bg-white/70 p-5 shadow-[0_8px_24px_rgba(20,20,20,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--cli-ink-1)]">
                <ServerIcon className="h-4 w-4" />
                <span>{server.name || server.hostname}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', statusClass)}>
                  {server.status}
                </span>
              </div>
              <div className="mt-1 text-xs text-[var(--cli-muted-1)]">{server.hostname}</div>
              <div className="mt-3 grid gap-2 text-xs text-[var(--cli-muted-1)]">
                <div>OS: {server.os_info || 'n/a'}</div>
                <div>IP: {server.ip_address || 'n/a'}</div>
                <div>Last heartbeat: {formatTimestamp(server.last_seen_at)}</div>
              </div>
            </div>

            <div className="rounded-xl border border-white/40 bg-white/70 px-4 py-3 text-xs text-[var(--cli-muted-1)]">
              <div className="flex items-center gap-2">
                <Wifi className="h-3.5 w-3.5" />
                <span>Socket: {connectionLabel}</span>
              </div>
              <div className="mt-1">Latency: {latencyLabel}</div>
              <div className="mt-1">Buffered queue: {connectionStatus?.bufferedMessages ?? 0}</div>
              <div className="mt-1">Access: {accessLabel || 'n/a'}</div>
            </div>
          </div>
        </SpotlightCard>
      </FadeContent>

      <FadeContent delay={0.05} duration={0.45} y={12}>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="GPU"
            value={server.gpu_count}
            suffix="available"
            icon={<Cpu className="h-3.5 w-3.5" />}
          />
          <MetricCard
            label="Memory"
            value={server.memory_gb}
            suffix="GB"
            icon={<MemoryStick className="h-3.5 w-3.5" />}
          />
          <MetricCard
            label="Disk"
            value={server.disk_gb}
            suffix="GB"
            icon={<HardDrive className="h-3.5 w-3.5" />}
          />
        </div>
      </FadeContent>

      <ServerTelemetryPanel projectId={projectId} server={server} />

      <FadeContent delay={0.15} duration={0.45} y={12}>
        <div className="grid gap-4 lg:grid-cols-2">
          <SpotlightCard className="cli-card rounded-2xl border border-white/40 bg-white/70 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[var(--cli-ink-1)]">System health</div>
            </div>
            {healthLoading ? (
              <div className="mt-3 text-xs text-[var(--cli-muted-1)]">Checking health…</div>
            ) : healthError ? (
              <div className="mt-3 text-xs text-[var(--cli-muted-1)]">{healthError}</div>
            ) : (
              <div className="mt-3 space-y-2 text-xs text-[var(--cli-muted-1)]">
                {healthItems.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3">
                    <span>{item.label}</span>
                    <div className="flex items-center gap-2">
                      {item.detail ? <span>{item.detail}</span> : null}
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-medium',
                          healthStatusClasses[item.status] ||
                            'bg-[var(--cli-status-idle)] text-[var(--cli-ink-0)]'
                        )}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
                {healthItems.length === 0 ? (
                  <div className="text-xs text-[var(--cli-muted-1)]">No health data available.</div>
                ) : null}
              </div>
            )}
            <div className="mt-3 text-[11px] text-[var(--cli-muted-1)]">
              Last checked: {formatTimestamp(health?.timestamp)}
            </div>
          </SpotlightCard>

          <SpotlightCard className="cli-card rounded-2xl border border-white/40 bg-white/70 p-4">
            <div className="text-sm font-semibold text-[var(--cli-ink-1)]">Connection metrics</div>
            <div className="mt-3 grid gap-2 text-xs text-[var(--cli-muted-1)]">
              <div>Reconnect attempts: {metrics?.reconnectionAttempts ?? 0}</div>
              <div>Average reconnect time: {averageReconnect}</div>
              <div>Messages buffered: {metrics?.messagesBuffered ?? 0}</div>
              <div>Messages dropped: {metrics?.messagesDropped ?? 0}</div>
              <div>Total connections: {metrics?.totalConnections ?? 0}</div>
              <div>Failed connections: {metrics?.failedConnections ?? 0}</div>
            </div>
            {connectionStatus?.lastError ? (
              <div className="mt-3 rounded-lg border border-white/40 bg-white/60 px-3 py-2 text-[11px] text-[var(--cli-muted-1)]">
                Last error: {connectionStatus.lastError}
              </div>
            ) : null}
          </SpotlightCard>
        </div>
      </FadeContent>

      <NotificationCenter />
    </div>
  )
}
