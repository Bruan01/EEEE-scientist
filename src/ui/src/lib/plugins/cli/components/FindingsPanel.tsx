"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { listCliFindings } from '@/lib/api/cli'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FadeContent, SpotlightCard } from '@/components/react-bits'

type CliFinding = { id: string; title: string; severity: string; updated_at: string }

function formatTimestamp(value?: string) {
  if (!value) return 'n/a'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'n/a'
  return parsed.toLocaleString()
}

function getSeverityClasses(severity: string) {
  const normalized = severity.toLowerCase()
  if (normalized.includes('high') || normalized.includes('critical')) {
    return 'bg-[var(--cli-status-offline)] text-[var(--cli-ink-0)]'
  }
  if (normalized.includes('medium') || normalized.includes('warn')) {
    return 'bg-[var(--cli-status-warning)] text-[var(--cli-ink-0)]'
  }
  return 'bg-[var(--cli-accent-emerald)] text-[var(--cli-ink-0)]'
}

export function FindingsPanel({ projectId, serverId }: { projectId: string; serverId: string }) {
  const [items, setItems] = useState<CliFinding[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const summary = useMemo(() => {
    const high = items.filter((finding) => {
      const normalized = finding.severity.toLowerCase()
      return normalized.includes('high') || normalized.includes('critical')
    }).length
    const medium = items.filter((finding) => finding.severity.toLowerCase().includes('medium')).length
    const low = items.length - high - medium
    return { high, medium, low }
  }, [items])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await listCliFindings(projectId, serverId)
        if (mounted) setItems(data)
      } catch (err) {
        if (mounted) setError('Failed to load findings.')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [projectId, serverId])

  useEffect(() => {
    if (!listRef.current || items.length === 0) return
    if (typeof window === 'undefined') return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    let cancelled = false
    const targets = listRef.current.querySelectorAll('[data-cli-finding-item]')
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
            <AlertTriangle className="h-4 w-4" />
            Findings overview
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs text-[var(--cli-muted-1)]">
            <div className="rounded-lg border border-white/40 bg-white/60 px-3 py-2">
              High: <span className="font-semibold text-[var(--cli-ink-1)]">{summary.high}</span>
            </div>
            <div className="rounded-lg border border-white/40 bg-white/60 px-3 py-2">
              Medium: <span className="font-semibold text-[var(--cli-ink-1)]">{summary.medium}</span>
            </div>
            <div className="rounded-lg border border-white/40 bg-white/60 px-3 py-2">
              Low: <span className="font-semibold text-[var(--cli-ink-1)]">{summary.low}</span>
            </div>
          </div>
        </SpotlightCard>
      </FadeContent>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-sm text-[var(--cli-muted-1)]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading findings...
        </div>
      ) : error ? (
        <SpotlightCard className="rounded-xl border border-white/40 bg-white/70 p-4 text-sm text-[var(--cli-muted-1)]">
          {error}
        </SpotlightCard>
      ) : items.length === 0 ? (
        <SpotlightCard className="rounded-xl border border-white/40 bg-white/70 p-4 text-sm text-[var(--cli-muted-1)]">
          No findings yet. Any detected anomalies or insights will appear here.
        </SpotlightCard>
      ) : (
        <FadeContent delay={0.05} duration={0.4} y={10}>
          <div ref={listRef} className="space-y-3">
            {items.map((finding) => (
              <div
                key={finding.id}
                data-cli-finding-item
                className="rounded-xl border border-white/40 bg-white/70 px-4 py-3 text-sm text-[var(--cli-ink-1)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{finding.title}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-medium',
                      getSeverityClasses(finding.severity)
                    )}
                  >
                    {finding.severity}
                  </span>
                </div>
                <div className="mt-1 text-xs text-[var(--cli-muted-1)]">
                  Updated: {formatTimestamp(finding.updated_at)}
                </div>
              </div>
            ))}
          </div>
        </FadeContent>
      )}
    </div>
  )
}
