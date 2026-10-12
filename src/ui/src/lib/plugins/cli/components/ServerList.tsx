'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FileText,
  Folder,
  Home,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Terminal as TerminalIcon,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GlareHover } from '@/components/react-bits'
import { useI18n } from '@/lib/i18n/useI18n'
import { useCliStore } from '../stores/cli-store'
import { ServerCard } from './ServerCard'

export function ServerList({
  readOnly,
  onBind,
  collapsed,
  onToggleCollapse,
  tabs = [],
  activeTab,
  onTabChange,
}: {
  readOnly?: boolean
  onBind?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
  tabs?: Array<{ value: string; label: string }>
  activeTab?: string
  onTabChange?: (value: string) => void
}) {
  const { t } = useI18n('cli')
  const servers = useCliStore((state) => state.servers)
  const activeServerId = useCliStore((state) => state.activeServerId)
  const setActiveServer = useCliStore((state) => state.setActiveServer)
  const refreshServers = useCliStore((state) => state.refreshServers)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [query, setQuery] = useState('')

  const statusSummary = useMemo(() => {
    const summary = {
      total: servers.length,
      online: servers.filter((server) => server.status === 'online').length,
      busy: servers.filter((server) => server.status === 'busy').length,
      offline: servers.filter((server) => server.status === 'offline').length,
    }
    return summary
  }, [servers])

  const filteredServers = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return servers
    return servers.filter((server) => {
      const haystack = [server.name, server.hostname, server.ip_address].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(needle)
    })
  }, [query, servers])

  const visibleServers = collapsed ? servers : filteredServers

  const statusClass = useMemo(
    () => ({
      online: 'bg-[var(--cli-status-online)]',
      offline: 'bg-[var(--cli-status-offline)]',
      error: 'bg-[var(--cli-status-error)]',
      busy: 'bg-[var(--cli-status-busy)]',
      idle: 'bg-[var(--cli-status-idle)]',
      standalone: 'bg-[var(--cli-status-idle)]',
    }),
    []
  )

  const renderTabButtons = (variant: 'collapsed' | 'expanded') => {
    if (tabs.length === 0) return null
    const isCollapsed = variant === 'collapsed'
    const iconMap: Record<string, React.ElementType> = {
      overview: Home,
      methods: Sparkles,
      terminal: TerminalIcon,
      files: Folder,
      logs: FileText,
      tasks: CheckSquare,
      findings: Search,
      admin: Shield,
    }
    return (
      <div className={isCollapsed ? 'mt-2 grid gap-2 px-2' : 'mt-3 grid grid-cols-4 gap-2'}>
        {tabs.map((tab) => {
          const isActive = tab.value === activeTab
          const Icon = iconMap[tab.value] ?? FileText
          const label = tab.label
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onTabChange?.(tab.value)}
              aria-pressed={isActive}
              title={tab.label}
              className={`cli-focus-ring group relative flex items-center justify-center rounded-lg border px-2 py-1 text-[10px] font-semibold transition ${
                isActive
                  ? 'border-[var(--cli-accent-amber)] bg-white/90 text-[var(--cli-ink-1)]'
                  : 'border-white/60 bg-white/70 text-[var(--cli-muted-1)] hover:text-[var(--cli-ink-1)]'
              }`}
            >
              {isCollapsed ? <Icon className="h-4 w-4" /> : label}
              {isCollapsed ? (
                <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/70 bg-white/90 px-2 py-1 text-[10px] text-[var(--cli-ink-1)] opacity-0 shadow-sm transition group-hover:opacity-100">
                  {label}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    )
  }

  useEffect(() => {
    if (!listRef.current || visibleServers.length === 0) return
    if (typeof window === 'undefined') return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    let cancelled = false
    const container = listRef.current
    const targets = container.querySelectorAll('[data-cli-server-card]')
    if (targets.length === 0) return

    import('animejs')
      .then(({ default: anime }) => {
        if (cancelled) return
        anime({
          targets,
          opacity: [0, 1],
          translateY: [10, 0],
          delay: anime.stagger(60),
          duration: 520,
          easing: 'easeOutCubic',
        })
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [visibleServers])

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center py-3">
        <button
          type="button"
          className="cli-focus-ring rounded-full border border-white/60 bg-white/70 p-2 text-[var(--cli-muted-1)] transition hover:text-[var(--cli-ink-1)]"
          onClick={() => onToggleCollapse?.()}
          title={t('expand')}
          aria-label={t('expand_cli_console')}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="mt-3 flex flex-col items-center gap-2">
          <button
            type="button"
            className="cli-focus-ring rounded-full border border-white/60 bg-white/70 p-2 text-[var(--cli-muted-1)] transition hover:text-[var(--cli-ink-1)]"
            onClick={() => refreshServers()}
            title={t('refresh')}
            aria-label={t('refresh_server_list')}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="cli-focus-ring rounded-full border border-white/60 bg-white/70 p-2 text-[var(--cli-muted-1)] transition hover:text-[var(--cli-ink-1)] disabled:opacity-50"
            onClick={() => onBind?.()}
            title={t('bind_server')}
            aria-label={t('bind_server')}
            disabled={readOnly || !onBind}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <ScrollArea className="mt-3 flex-1 w-full px-2">
          <div ref={listRef} className="flex flex-col items-center gap-2 pb-4">
            {visibleServers.map((server) => {
              const label = (server.name || server.hostname || 'S').slice(0, 2).toUpperCase()
              return (
                <button
                  key={server.id}
                  type="button"
                  data-cli-server-card
                  onClick={() => setActiveServer(server.id)}
                  aria-pressed={server.id === activeServerId}
                  title={server.name || server.hostname}
                  className={`cli-focus-ring flex h-10 w-10 flex-col items-center justify-center gap-1 rounded-xl border border-white/50 text-[10px] font-semibold transition ${
                    server.id === activeServerId
                      ? 'bg-[var(--cli-accent-olive)] text-[var(--cli-ink-0)]'
                      : 'bg-white/60 text-[var(--cli-muted-1)] hover:text-[var(--cli-ink-1)]'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${statusClass[server.status] || 'bg-[var(--cli-status-idle)]'}`}
                  />
                  <span>{label}</span>
                </button>
              )
            })}
            {visibleServers.length === 0 ? (
              <div className="text-center text-[10px] text-[var(--cli-muted-1)]">{t('no_servers')}</div>
            ) : null}
          </div>
        </ScrollArea>
        {tabs.length > 0 ? (
          <div className="w-full pb-2">
            <div className="text-center text-[10px] text-[var(--cli-muted-1)]">---</div>
            {renderTabButtons('collapsed')}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--cli-ink-1)]">{t('cli_console')}</h3>
            <p className="text-xs text-[var(--cli-muted-1)]">{t('remote_hosts_live_agents')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="cli-focus-ring rounded-full border border-white/60 bg-white/70 p-2 text-[var(--cli-muted-1)] transition hover:text-[var(--cli-ink-1)]"
              onClick={() => onToggleCollapse?.()}
              title={t('collapse')}
              aria-label={t('collapse_cli_console')}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="cli-focus-ring rounded-full border border-white/60 bg-white/70 p-2 text-[var(--cli-muted-1)] transition hover:text-[var(--cli-ink-1)]"
              onClick={() => refreshServers()}
              title={t('refresh')}
              aria-label={t('refresh_server_list')}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <GlareHover className="rounded-full">
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => onBind?.()}
                disabled={readOnly || !onBind}
              >
                <Plus className="mr-1 h-4 w-4" />
                {t('bind')}
              </Button>
            </GlareHover>
          </div>
        </div>
        <div className="mt-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search_cli_servers_placeholder')}
            className="h-9 text-xs"
            aria-label={t('search_cli_servers')}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[var(--cli-muted-1)]">
          <span className="rounded-full border border-white/40 bg-white/70 px-2 py-0.5">
            {t('total', { count: statusSummary.total })}
          </span>
          <span className="rounded-full border border-white/40 bg-white/70 px-2 py-0.5">
            {t('online', { count: statusSummary.online })}
          </span>
          {statusSummary.busy > 0 ? (
            <span className="rounded-full border border-white/40 bg-white/70 px-2 py-0.5">
              {t('busy_count', { count: statusSummary.busy })}
            </span>
          ) : null}
          <span className="rounded-full border border-white/40 bg-white/70 px-2 py-0.5">
            {t('offline_count', { count: statusSummary.offline })}
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div ref={listRef} className="space-y-3 pb-6">
          {visibleServers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              isActive={server.id === activeServerId}
              onSelect={() => setActiveServer(server.id)}
            />
          ))}
          {visibleServers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/50 bg-white/40 p-4 text-center text-xs text-[var(--cli-muted-1)]">
              {query.trim()
                ? t('no_servers_match_search')
                : readOnly
                  ? t('no_servers_available_project')
                  : t('no_servers_yet_bind')}
            </div>
            ) : null}
        </div>
      </ScrollArea>
      {tabs.length > 0 ? (
        <div className="px-4 pb-4">
          <div className="text-center text-[10px] text-[var(--cli-muted-1)]">---</div>
          {renderTabButtons('expanded')}
        </div>
      ) : null}
    </div>
  )
}
