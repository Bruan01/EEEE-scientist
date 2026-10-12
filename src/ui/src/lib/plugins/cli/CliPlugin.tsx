'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import type { PluginComponentProps } from '@/lib/types/plugin'
import { useCliStore } from './stores/cli-store'
import { ServerList } from './components/ServerList'
import { TerminalView } from './components/TerminalView'
import { EmptyState } from './components/EmptyState'
import { BindServerDialog } from './components/BindServerDialog'
import { OverviewPanel } from './components/OverviewPanel'
import { FileBrowser } from './components/FileBrowser'
import { OperationLogs } from './components/OperationLogs'
import { TasksPanel } from './components/TasksPanel'
import { FindingsPanel } from './components/FindingsPanel'
import { MethodPanel } from './components/MethodPanel'
import { useCliAccess } from './hooks/useCliAccess'
import { Noise } from '@/components/react-bits'
import { useChatActions } from '@/lib/stores/chat'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useMaxEntitlement } from '@/lib/hooks/useMaxEntitlement'
import { useI18n } from '@/lib/i18n/useI18n'
import './styles/terminal.css'

type CliTabKey =
  | 'overview'
  | 'methods'
  | 'terminal'
  | 'files'
  | 'logs'
  | 'tasks'
  | 'findings'

const isOfflineStatus = (status?: string | null) => status === 'offline' || status === 'error'

const formatRelative = (value?: string | null) => {
  if (!value) return 'n/a'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'n/a'
  const diffMs = Date.now() - parsed.getTime()
  if (diffMs < 60_000) return 'just now'
  if (diffMs < 3_600_000) return `${Math.round(diffMs / 60_000)}m ago`
  if (diffMs < 86_400_000) return `${Math.round(diffMs / 3_600_000)}h ago`
  return `${Math.round(diffMs / 86_400_000)}d ago`
}

const formatTimestamp = (value?: string | null) => {
  if (!value) return 'n/a'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'n/a'
  return parsed.toLocaleString()
}

export default function CliPlugin({ context, setTitle }: PluginComponentProps) {
  const { t } = useI18n('cli')
  const maxEntitlement = useMaxEntitlement('cli.connect')
  const customData = context.customData as {
    projectId?: unknown
    readOnly?: unknown
    readonly?: unknown
  } | undefined
  const projectId = typeof customData?.projectId === 'string' ? customData.projectId : undefined
  const readOnly = Boolean(customData?.readOnly || customData?.readonly)
  const [bindDialogOpen, setBindDialogOpen] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<CliTabKey>('overview')
  const [serverListCollapsed, setServerListCollapsed] = React.useState(true)

  const servers = useCliStore((state) => state.servers)
  const activeServerId = useCliStore((state) => state.activeServerId)
  const isLoading = useCliStore((state) => state.isLoading)
  const loadServers = useCliStore((state) => state.loadServers)
  const connectionStatus = useCliStore((state) => state.connectionStatus)
  const { ensureConversation } = useChatActions()

  React.useEffect(() => {
    setTitle('CLI')
  }, [setTitle])

  React.useEffect(() => {
    if (projectId) {
      loadServers(projectId)
    }
  }, [projectId, loadServers])

  React.useEffect(() => {
    if (projectId) {
      ensureConversation(projectId)
    }
  }, [projectId, ensureConversation])

  const activeServer = React.useMemo(
    () => servers.find((s) => s.id === activeServerId),
    [servers, activeServerId]
  )
  const isOffline = activeServer ? isOfflineStatus(activeServer.status) : false
  const access = useCliAccess({
    projectId,
    serverId: activeServer?.id ?? null,
    readOnly,
  })
  const canManageServers = access.permission === 'admin' || access.permission === 'owner'
  const canTerminalInput = access.capabilities.terminal_input
  const canFileEdit = access.capabilities.file_edit
  const canFileDelete = access.capabilities.file_delete
  const canFileUpload = access.capabilities.file_upload
  const canFileDownload = access.capabilities.file_download
  const canUnbindServer = access.capabilities.disconnect_server

  const tabItems = React.useMemo(
    () => {
      const items = [
        { value: 'methods', label: t('tab_methods') },
        { value: 'terminal', label: t('tab_terminal') },
        { value: 'files', label: t('tab_files') },
        { value: 'logs', label: t('tab_logs') },
        { value: 'tasks', label: t('tab_tasks') },
        { value: 'findings', label: t('tab_findings') },
      ]
      items.push({ value: 'overview', label: t('tab_overview') })
      return items
    },
    [t]
  )

  if (!projectId) {
    return (
      <div className="cli-root flex h-full items-center justify-center">
        <p className="text-[var(--cli-muted-1)]">{t('no_project_selected')}</p>
      </div>
    )
  }

  if (!maxEntitlement.isEntitlementLoading && !maxEntitlement.isMaxEntitled) {
    return (
      <div className="cli-root flex h-full items-center justify-center">
        <div className="rounded-2xl border border-white/40 bg-white/70 px-4 py-3 text-center">
          <div className="text-sm font-semibold text-[var(--cli-ink-1)]">{t('plan_access_required')}</div>
          <div className="mt-1 text-xs text-[var(--cli-muted-1)]">
            {t('max_only_desc')}
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="cli-root flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--cli-muted-1)]" />
      </div>
    )
  }

  return (
    <div className="cli-root relative flex h-full overflow-hidden">
      <Noise animated={false} />
      {/* Server list sidebar */}
      <div
        className={`shrink-0 border-r border-white/40 bg-[var(--cli-bg-1)] transition-all ${
          serverListCollapsed ? 'w-16' : 'w-72'
        }`}
      >
        <ServerList
          readOnly={!canManageServers}
          onBind={() => setBindDialogOpen(true)}
          collapsed={serverListCollapsed}
          onToggleCollapse={() => setServerListCollapsed((prev) => !prev)}
          tabs={tabItems}
          activeTab={activeTab}
          onTabChange={(value) => setActiveTab(value as CliTabKey)}
        />
      </div>

      {/* Main content */}
      <div className="relative flex flex-1 flex-col bg-[var(--cli-bg-0)]">
        {activeServer ? (
          <>
            <div className="flex-1 min-h-0 overflow-hidden px-6 pb-4 pt-6">
              <div className="flex h-full min-h-0 flex-col">
                {isOffline ? (
                  <div className="mb-3 rounded-xl border border-white/40 bg-white/70 px-4 py-3 text-sm text-[var(--cli-muted-1)]">
                    <div className="font-semibold text-[var(--cli-ink-1)]">{t('cli_server_disconnected')}</div>
                    <div className="mt-1 text-[11px] text-[var(--cli-muted-2)]">
                      {t('last_heartbeat', {
                        relative: formatRelative(activeServer.last_seen_at),
                        timestamp: formatTimestamp(activeServer.last_seen_at),
                      })}
                    </div>
                  </div>
                ) : null}
                {activeTab === 'terminal' ? (
                  <div key={activeTab} className="flex-1 min-h-0 cli-tab-enter">
                    <TerminalView
                      projectId={projectId}
                      server={activeServer}
                      readOnly={!canTerminalInput}
                      canUnbind={canUnbindServer}
                    />
                  </div>
                ) : (
                  <ScrollArea className="flex-1 min-h-0 pr-2">
                    <div key={activeTab} className="h-full min-h-0 cli-tab-enter">
                      {activeTab === 'overview' ? (
                        <OverviewPanel
                          projectId={projectId}
                          server={activeServer}
                          connectionStatus={connectionStatus}
                          accessLabel={access.permission}
                          canUnbind={canUnbindServer}
                        />
                      ) : null}
                      {activeTab === 'methods' ? (
                        <MethodPanel
                          projectId={projectId}
                          serverId={activeServer.id}
                          canCreate={canFileEdit}
                        />
                      ) : null}
                      {activeTab === 'files' ? (
                        <FileBrowser
                          projectId={projectId}
                          serverId={activeServer.id}
                          serverRoot={activeServer.server_root}
                          serverStatus={activeServer.status}
                          serverLastSeenAt={activeServer.last_seen_at}
                          readOnly={!canFileEdit}
                          canDelete={canFileDelete}
                          canUpload={canFileUpload}
                          canDownload={canFileDownload}
                        />
                      ) : null}
                      {activeTab === 'logs' ? (
                        <OperationLogs
                          projectId={projectId}
                          serverId={activeServer.id}
                          canViewAll={access.capabilities.view_all_user_logs}
                        />
                      ) : null}
                      {activeTab === 'tasks' ? (
                        <TasksPanel projectId={projectId} serverId={activeServer.id} />
                      ) : null}
                      {activeTab === 'findings' ? (
                        <FindingsPanel projectId={projectId} serverId={activeServer.id} />
                      ) : null}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            {servers.length === 0 ? (
              <EmptyState onBind={() => setBindDialogOpen(true)} />
            ) : (
              <p className="text-[var(--cli-muted-1)]">{t('select_server_from_list')}</p>
            )}
          </div>
        )}
      </div>

      <BindServerDialog open={bindDialogOpen} onOpenChange={setBindDialogOpen} />
    </div>
  )
}
