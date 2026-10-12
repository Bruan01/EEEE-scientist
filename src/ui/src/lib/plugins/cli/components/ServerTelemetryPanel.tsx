import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import type { CliServer, CliTelemetryPoint } from '../types/cli'
import { getCliServerMetrics, refreshCliServerStatus } from '@/lib/api/cli'
import { FadeContent, SpotlightCard } from '@/components/react-bits'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/useI18n'
import { useCliStore } from '../stores/cli-store'

const TELEMETRY_RANGES = [
  { value: '15m', label: '15m', bucket: 30 },
  { value: '1h', label: '1h', bucket: 60 },
  { value: '6h', label: '6h', bucket: 300 },
  { value: '24h', label: '24h', bucket: 900 },
  { value: '7d', label: '7d', bucket: 3600 },
] as const

type TelemetryRange = (typeof TELEMETRY_RANGES)[number]['value']

function normalizeTelemetryPoint(point: CliTelemetryPoint) {
  const gpuUtil = point.gpu?.length
    ? point.gpu.reduce((acc, gpu) => acc + (gpu.utilization_gpu ?? 0), 0) / point.gpu.length
    : null
  return {
    timestamp: point.timestamp,
    cpu: point.cpu_percent ?? null,
    memory: point.mem_percent ?? null,
    gpu: gpuUtil,
  }
}

function formatTelemetryTick(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getHours().toString().padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}`
}

function parseMemoryMb(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const digits = value.replace(/[^\d]/g, '')
    if (!digits) return null
    return Number.parseInt(digits, 10)
  }
  return null
}

function formatGpuMemory(
  totalMb: number | null | undefined,
  freeMb: number | null | undefined,
  t: (key: string, variables?: Record<string, string | number>) => string
) {
  if (!totalMb || totalMb <= 0) return t('n_a')
  const safeFree = freeMb != null ? Math.max(0, freeMb) : 0
  const usedMb = Math.max(0, totalMb - safeFree)
  const usedGb = (usedMb / 1024).toFixed(1)
  const totalGb = (totalMb / 1024).toFixed(1)
  return t('gpu_memory_used', { used: usedGb, total: totalGb })
}

export function ServerTelemetryPanel({
  projectId,
  server,
  showRefreshButton = false,
}: {
  projectId: string
  server: CliServer
  showRefreshButton?: boolean
}) {
  const { t } = useI18n('cli')
  const [telemetryRange, setTelemetryRange] = useState<TelemetryRange>('1h')
  const [telemetryLoading, setTelemetryLoading] = useState(false)
  const [telemetryError, setTelemetryError] = useState<string | null>(null)
  const [gpuRefreshing, setGpuRefreshing] = useState(false)
  const { addToast } = useToast()
  const telemetryByServer = useCliStore((state) => state.telemetryByServer)
  const setTelemetrySeries = useCliStore((state) => state.setTelemetrySeries)

  const refreshTelemetry = useCallback(async () => {
    setTelemetryLoading(true)
    setTelemetryError(null)
    try {
      const rangeConfig = TELEMETRY_RANGES.find((item) => item.value === telemetryRange)
      const response = await getCliServerMetrics(projectId, server.id, {
        range: telemetryRange,
        bucket: rangeConfig?.bucket,
      })
      setTelemetrySeries(server.id, response.points)
    } catch {
      setTelemetryError('Unable to load telemetry.')
    } finally {
      setTelemetryLoading(false)
    }
  }, [projectId, server.id, setTelemetrySeries, telemetryRange])

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
    } catch {
      addToast({
        type: 'error',
        title: t('refresh_failed_title'),
        description: t('refresh_failed_desc'),
      })
    } finally {
      setGpuRefreshing(false)
    }
  }, [addToast, gpuRefreshing, projectId, server.id, t])

  useEffect(() => {
    void refreshTelemetry()
  }, [refreshTelemetry])

  const chartData = useMemo(() => {
    const telemetryPoints = telemetryByServer[server.id] ?? []
    return telemetryPoints.slice(-300).map(normalizeTelemetryPoint)
  }, [server.id, telemetryByServer])
  const gpuDetails = server.gpu_info ?? []

  return (
    <div className="space-y-4">
      <FadeContent delay={0.1} duration={0.45} y={12}>
        <SpotlightCard className="cli-card rounded-2xl border border-white/40 bg-white/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[var(--cli-ink-1)]">{t('gpu_details')}</div>
            {showRefreshButton ? (
              <Button variant="secondary" size="sm" onClick={refreshGpu} disabled={gpuRefreshing}>
                <RefreshCw className={cn('mr-2 h-3.5 w-3.5', gpuRefreshing ? 'animate-spin' : '')} />
                {t('refresh_gpu')}
              </Button>
            ) : null}
          </div>
          <div className="mt-3 space-y-2 text-xs text-[var(--cli-muted-1)]">
            {server.gpu_count === 0 ? (
              <div>{t('no_gpus')}</div>
            ) : gpuDetails.length > 0 ? (
              gpuDetails.map((gpu) => {
                const totalMb = parseMemoryMb(gpu.memory_total_mb ?? gpu.memory_total)
                const freeMb = parseMemoryMb(gpu.memory_free_mb ?? gpu.memory_free)
                return (
                  <div key={gpu.uuid ?? `${gpu.index}`} className="flex items-center justify-between gap-3">
                    <span>
                      GPU {gpu.index}: {gpu.name}
                    </span>
                    <span>{formatGpuMemory(totalMb, freeMb, t)}</span>
                  </div>
                )
              })
            ) : (
              <div>{t('gpu_telemetry_unavailable')}</div>
            )}
          </div>
        </SpotlightCard>
      </FadeContent>

      <FadeContent delay={0.12} duration={0.45} y={12}>
        <SpotlightCard className="cli-card rounded-2xl border border-white/40 bg-white/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--cli-ink-1)]">{t('realtime_telemetry')}</div>
              <div className="text-xs text-[var(--cli-muted-1)]">
                {t('realtime_telemetry_desc')}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1 rounded-full border border-white/40 bg-white/60 px-1 py-1">
                {TELEMETRY_RANGES.map((range) => {
                  const isActive = telemetryRange === range.value
                  return (
                    <button
                      key={range.value}
                      type="button"
                      className={cn(
                        'rounded-full px-3 py-1 text-[11px] font-medium transition',
                        isActive
                          ? 'bg-[var(--cli-accent-emerald)] text-[var(--cli-ink-0)]'
                          : 'text-[var(--cli-muted-1)] hover:text-[var(--cli-ink-1)]'
                      )}
                      onClick={() => setTelemetryRange(range.value)}
                    >
                      {range.label}
                    </button>
                  )
                })}
              </div>
              <Button variant="secondary" size="sm" onClick={() => void refreshTelemetry()} disabled={telemetryLoading}>
                <RefreshCw className={cn('mr-2 h-3.5 w-3.5', telemetryLoading ? 'animate-spin' : '')} />
                {t('refresh')}
              </Button>
            </div>
          </div>

          <div className="mt-4 h-[240px]">
            {telemetryLoading ? (
              <div className="text-xs text-[var(--cli-muted-1)]">{t('loading_telemetry')}</div>
            ) : telemetryError ? (
              <div className="text-xs text-[var(--cli-muted-1)]">{telemetryError}</div>
            ) : chartData.length === 0 ? (
              <div className="text-xs text-[var(--cli-muted-1)]">{t('no_telemetry')}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatTelemetryTick}
                    tick={{ fontSize: 10, fill: 'var(--cli-muted-1)' }}
                    axisLine={{ stroke: 'rgba(0,0,0,0.1)' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: 'var(--cli-muted-1)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    formatter={(value: ValueType | undefined, name: NameType | undefined) => {
                      const safeName = String(name ?? '')
                        if (value == null || Array.isArray(value)) return [t('n_a'), safeName]
                        const numeric = typeof value === 'number' ? value : Number(value)
                        if (!Number.isFinite(numeric)) return [t('n_a'), safeName]
                        return [`${Math.round(numeric)}%`, safeName]
                      }}
                    labelFormatter={(label) => {
                      const date = new Date(label)
                      if (Number.isNaN(date.getTime())) return String(label)
                      return date.toLocaleString()
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cpu"
                    stroke="var(--cli-accent-rose)"
                    strokeWidth={2}
                    dot={false}
                    name={t('cpu')}
                  />
                  <Line
                    type="monotone"
                    dataKey="memory"
                    stroke="var(--cli-accent-steel)"
                    strokeWidth={2}
                    dot={false}
                    name={t('memory')}
                  />
                  <Line
                    type="monotone"
                    dataKey="gpu"
                    stroke="var(--cli-accent-amber)"
                    strokeWidth={2}
                    dot={false}
                    name={t('gpu')}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </SpotlightCard>
      </FadeContent>
    </div>
  )
}
