'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { ArrowRightLeft, ChevronDown, ChevronRight, Eye, PenLine, Type } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { listCliServers, listCliFiles, writeCliFile, uploadCliFile } from '@/lib/api/cli'
import type { CliFileItem, CliServer } from '@/lib/plugins/cli/types/cli'
import {
  TEXT_PREVIEW_MAX_BYTES,
  findSensitiveMarker,
  normalizePath,
  splitPath,
  joinPath,
} from '@/lib/plugins/cli/lib/file-utils'
import { useTabsStore } from '@/lib/stores/tabs'
import { BUILTIN_PLUGINS, getPluginIdFromExtension, getPluginIdFromMimeType } from '@/lib/types/plugin'
import { buildCliFileId } from '@/lib/api/cli-file-id'
import { useI18n } from '@/lib/i18n/useI18n'
import { toCliResourcePath } from '@/lib/utils/resource-paths'
import { cn } from '@/lib/utils'
import { buildCliEffectKey, useCliFileEffectsStore } from '@/lib/stores/cli-file-effects'

export type CliExplorerTreeHandle = {
  createFile: () => void
  createFolder: () => void
  upload: () => void
  refresh: () => Promise<void>
}

type CliExplorerTreeProps = {
  projectId: string
  readOnly?: boolean
  hideDotfiles?: boolean
  serverId?: string | null
  rootPath?: string | null
  tabCustomData?: Record<string, unknown>
  extraRoot?: {
    label: string
    subtitle?: string | null
    serverId: string
    rootPath: string
  } | null
}

type DirState = {
  items: CliFileItem[]
  isLoading: boolean
  error?: string | null
}

type SelectedEntry = {
  serverId: string
  item: CliFileItem
  serverRoot?: string | null
}

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

export const CliExplorerTree = forwardRef<
  CliExplorerTreeHandle,
  CliExplorerTreeProps
>(function CliExplorerTree(
  { projectId, readOnly, hideDotfiles = false, serverId, rootPath, tabCustomData, extraRoot },
  ref
) {
  const { t } = useI18n('workspace')
  const { addToast } = useToast()
  const [servers, setServers] = useState<CliServer[]>([])
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set())
  const [expandedPaths, setExpandedPaths] = useState<Record<string, Set<string>>>({})
  const [dirMap, setDirMap] = useState<Record<string, Record<string, DirState>>>({})
  const [selected, setSelected] = useState<SelectedEntry | null>(null)
  const [extraExpanded, setExtraExpanded] = useState(true)
  const [createDialog, setCreateDialog] = useState<{ type: 'file' | 'folder'; serverId: string; targetPath: string } | null>(null)
  const [createName, setCreateName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const openTab = useTabsStore((state) => state.openTab)
  const highlightedKey = useCliFileEffectsStore((state) => state.highlightedKey)
  const readingKeys = useCliFileEffectsStore((state) => state.readingKeys)
  const writingKeys = useCliFileEffectsStore((state) => state.writingKeys)
  const movedKeys = useCliFileEffectsStore((state) => state.movedKeys)
  const renamedKeys = useCliFileEffectsStore((state) => state.renamedKeys)
  const clearWrite = useCliFileEffectsStore((state) => state.clearWrite)
  const clearMove = useCliFileEffectsStore((state) => state.clearMove)
  const clearRename = useCliFileEffectsStore((state) => state.clearRename)
  const pinnedServerId = serverId ?? null
  const normalizedRootPath = useMemo(() => (rootPath ? normalizePath(rootPath) : null), [rootPath])
  const singleServerMode = Boolean(pinnedServerId)

  const resolveServerRoot = useCallback(
    (server: CliServer) => {
      if (pinnedServerId && normalizedRootPath && server.id === pinnedServerId) {
        return normalizedRootPath
      }
      return normalizePath(server.server_root || '/')
    },
    [normalizedRootPath, pinnedServerId]
  )

  const rootByServer = useMemo(() => {
    const map = new Map<string, string>()
    servers.forEach((server) => {
      map.set(server.id, resolveServerRoot(server))
    })
    return map
  }, [resolveServerRoot, servers])

  const serverById = useMemo(() => {
    const map = new Map<string, CliServer>()
    servers.forEach((server) => {
      map.set(server.id, server)
    })
    return map
  }, [servers])

  const loadServers = useCallback(async (options?: { reset?: boolean }) => {
    const shouldReset = options?.reset !== false
    try {
      const response = await listCliServers(projectId)
      const nextServers = pinnedServerId
        ? response.filter((server) => server.id === pinnedServerId)
        : response
      setServers(nextServers)
      if (shouldReset) {
        setExpandedServers(new Set())
        setExpandedPaths({})
        setDirMap({})
        setSelected(null)
      } else {
        const nextIds = new Set(nextServers.map((server) => server.id))
        setExpandedServers((prev) => new Set([...prev].filter((id) => nextIds.has(id))))
        setExpandedPaths((prev) => {
          const next: Record<string, Set<string>> = {}
          Object.entries(prev).forEach(([serverId, paths]) => {
            if (nextIds.has(serverId)) {
              next[serverId] = new Set(paths)
            }
          })
          return next
        })
        setDirMap((prev) => {
          const next: Record<string, Record<string, DirState>> = {}
          Object.entries(prev).forEach(([serverId, map]) => {
            if (nextIds.has(serverId)) {
              next[serverId] = map
            }
          })
          return next
        })
        setSelected((prev) => {
          if (!prev) return null
          return nextIds.has(prev.serverId) ? prev : null
        })
      }
      return nextServers
    } catch (err) {
      addToast({
        type: 'error',
        title: 'CLI servers unavailable',
        description: 'Failed to load CLI server list.',
      })
      return null
    }
  }, [addToast, pinnedServerId, projectId])

  useEffect(() => {
    void loadServers()
  }, [loadServers])

  useEffect(() => {
    if (!pinnedServerId) return
    setExpandedServers(new Set())
    setExpandedPaths({})
    setDirMap({})
    setSelected(null)
  }, [normalizedRootPath, pinnedServerId])

  useEffect(() => {
    if (!extraRoot) return
    setExtraExpanded(true)
  }, [extraRoot?.rootPath, extraRoot?.serverId])

  const loadDir = useCallback(
    async (serverId: string, path: string, refresh = false) => {
      const normalizedPath = normalizePath(path)
      const server = serverById.get(serverId)
      if (server && isOfflineStatus(server.status)) {
        setDirMap((prev) => ({
          ...prev,
          [serverId]: {
            ...(prev[serverId] || {}),
            [normalizedPath]: {
              items: prev[serverId]?.[normalizedPath]?.items || [],
              isLoading: false,
              error: `CLI server offline. Last heartbeat ${formatRelative(server.last_seen_at)}.`,
            },
          },
        }))
        return
      }
      setDirMap((prev) => ({
        ...prev,
        [serverId]: {
          ...(prev[serverId] || {}),
          [normalizedPath]: {
            items: prev[serverId]?.[normalizedPath]?.items || [],
            isLoading: true,
            error: null,
          },
        },
      }))
      try {
        const response = await listCliFiles(projectId, serverId, normalizedPath, refresh)
        const normalizedResponsePath = normalizePath(response.path || normalizedPath)
        const normalizedItems = response.items.map((item) => ({
          ...item,
          path: normalizePath(item.path),
        }))
        setDirMap((prev) => ({
          ...prev,
          [serverId]: {
            ...(prev[serverId] || {}),
            [normalizedPath]: { items: normalizedItems, isLoading: false, error: null },
            ...(normalizedResponsePath !== normalizedPath
              ? { [normalizedResponsePath]: { items: normalizedItems, isLoading: false, error: null } }
              : {}),
          },
        }))
      } catch (err) {
        const isPlanningPath =
          normalizedPath.includes('/.core/planning/') ||
          normalizedPath.includes('/.core/memory/working')
        const errorMessage = isPlanningPath
          ? 'Please send your request and the folder will be created.'
          : 'Failed to load folder'
        setDirMap((prev) => ({
          ...prev,
          [serverId]: {
            ...(prev[serverId] || {}),
            [normalizedPath]: { items: [], isLoading: false, error: errorMessage },
          },
        }))
      }
    },
    [projectId, serverById]
  )

  const refreshTree = useCallback(async () => {
    const response = await loadServers({ reset: false })
    const serverList = response ?? servers
    if (serverList.length === 0) return
    const tasks: Promise<void>[] = []
    serverList.forEach((server) => {
      const wantsExtraRoot = Boolean(
        extraRoot && extraExpanded && extraRoot.serverId === server.id
      )
      if (!expandedServers.has(server.id) && !wantsExtraRoot) return
      if (isOfflineStatus(server.status)) return
      const rootPath = resolveServerRoot(server)
      const refreshPaths = new Set<string>()
      if (expandedServers.has(server.id)) {
        refreshPaths.add(rootPath)
      }
      if (wantsExtraRoot && extraRoot) {
        refreshPaths.add(normalizePath(extraRoot.rootPath))
      }
      const expanded = expandedPaths[server.id]
      if (expanded) {
        expanded.forEach((path) => refreshPaths.add(path))
      }
      refreshPaths.forEach((path) => {
        tasks.push(loadDir(server.id, path, true))
      })
    })
    if (tasks.length > 0) {
      await Promise.all(tasks)
    }
  }, [
    expandedPaths,
    expandedServers,
    extraExpanded,
    extraRoot,
    loadDir,
    loadServers,
    resolveServerRoot,
    servers,
  ])

  useEffect(() => {
    if (!singleServerMode) return
    const server = servers[0]
    if (!server) return
    setExpandedServers((prev) => {
      if (prev.size === 1 && prev.has(server.id)) return prev
      return new Set([server.id])
    })
    const rootPath = rootByServer.get(server.id) || '/'
    if (!dirMap[server.id]?.[rootPath]) {
      void loadDir(server.id, rootPath, true)
    }
  }, [dirMap, loadDir, rootByServer, servers, singleServerMode])

  useEffect(() => {
    if (!extraRoot || !extraExpanded) return
    const normalizedExtraPath = normalizePath(extraRoot.rootPath)
    if (!dirMap[extraRoot.serverId]?.[normalizedExtraPath]) {
      void loadDir(extraRoot.serverId, normalizedExtraPath, true)
    }
  }, [dirMap, extraExpanded, extraRoot, loadDir])

  const toggleServer = useCallback(
    async (server: CliServer) => {
      setExpandedServers((prev) => {
        const next = new Set(prev)
        if (next.has(server.id)) {
          next.delete(server.id)
        } else {
          next.add(server.id)
        }
        return next
      })
      const rootPath = normalizePath(rootByServer.get(server.id) || '/')
      if (!dirMap[server.id]?.[rootPath]) {
        await loadDir(server.id, rootPath, true)
      }
    },
    [dirMap, loadDir, rootByServer]
  )

  const togglePath = useCallback(
    async (serverId: string, path: string) => {
      const normalizedPath = normalizePath(path)
      setExpandedPaths((prev) => {
        const next = new Set(prev[serverId] || [])
        if (next.has(normalizedPath)) {
          next.delete(normalizedPath)
        } else {
          next.add(normalizedPath)
        }
        return { ...prev, [serverId]: next }
      })
      if (!dirMap[serverId]?.[normalizedPath]) {
        await loadDir(serverId, normalizedPath, false)
      }
    },
    [dirMap, loadDir]
  )

  const resolveTargetDir = useCallback(() => {
    if (selected) {
      if (selected.item.type === 'directory') {
        return {
          ...selected,
          item: { ...selected.item, path: normalizePath(selected.item.path) },
        }
      }
      const parentSegments = splitPath(selected.item.path).slice(0, -1)
      return {
        serverId: selected.serverId,
        item: { ...selected.item, path: joinPath(parentSegments), type: 'directory' as const },
      }
    }
    if (servers.length === 1) {
      const server = servers[0]
      const rootPath = normalizePath(rootByServer.get(server.id) || '/')
      return {
        serverId: server.id,
        item: {
          name: rootPath,
          path: rootPath,
          type: 'directory' as const,
          size: null,
          is_readable: false,
          modified_at: null,
          mime_type: null,
        },
      }
    }
    return null
  }, [rootByServer, selected, servers])

  const resolvePluginId = useCallback((item: CliFileItem) => {
    const extPluginId = getPluginIdFromExtension(item.name)
    if (extPluginId === BUILTIN_PLUGINS.NOTEBOOK) {
      const lower = item.name.toLowerCase()
      if (
        lower.endsWith('.md') ||
        lower.endsWith('.markdown') ||
        lower.endsWith('.mdx')
      ) {
        return extPluginId
      }
    }
    if (item.mime_type) {
      const mimePluginId = getPluginIdFromMimeType(item.mime_type)
      if (mimePluginId) {
        if (mimePluginId === BUILTIN_PLUGINS.TEXT_VIEWER && extPluginId) {
          return extPluginId
        }
        return mimePluginId
      }
    }
    return extPluginId
  }, [])

  const handleOpenFile = useCallback(
    (entry: SelectedEntry) => {
      const server = serverById.get(entry.serverId)
      if (server && isOfflineStatus(server.status)) {
        addToast({
          type: 'warning',
          title: 'CLI server offline',
          description: `Last heartbeat ${formatRelative(server.last_seen_at)} (${formatTimestamp(server.last_seen_at)}).`,
        })
        return
      }
      const sensitive = findSensitiveMarker(entry.item.path)
      if (sensitive) {
        addToast({
          type: 'warning',
          title: 'Access blocked',
          description: `Sensitive file access blocked (${sensitive}).`,
        })
        return
      }
      const pluginId = resolvePluginId(entry.item)
      if (!pluginId) {
        addToast({
          type: 'warning',
          title: 'No viewer available',
          description: 'Open the file in the CLI to inspect it.',
        })
        return
      }
      const serverRoot = entry.serverRoot
        ? normalizePath(entry.serverRoot)
        : rootByServer.get(entry.serverId) ?? undefined
      const fileId = buildCliFileId({
        projectId,
        serverId: entry.serverId,
        path: entry.item.path,
      })
      const fileMeta = {
        updatedAt: entry.item.modified_at ?? undefined,
        sizeBytes: entry.item.size ?? undefined,
        mimeType: entry.item.mime_type ?? undefined,
      }
      openTab({
        pluginId,
        context: {
          type: 'file',
          resourceId: fileId,
          resourcePath: toCliResourcePath({
            serverId: entry.serverId,
            path: entry.item.path,
            serverRoot,
          }),
          resourceName: entry.item.name,
          mimeType: entry.item.mime_type ?? undefined,
          customData: {
            projectId,
            fileSource: 'cli',
            cliServerId: entry.serverId,
            cliPath: entry.item.path,
            cliRoot: serverRoot,
            fileMeta,
            readOnly: readOnly ?? false,
            readonly: readOnly ?? false,
            ...(tabCustomData ?? {}),
          },
        },
        title: entry.item.name,
      })
    },
    [addToast, openTab, projectId, readOnly, resolvePluginId, rootByServer, serverById, tabCustomData]
  )

  const handleCreate = useCallback(
    (type: 'file' | 'folder') => {
      if (readOnly) return
      const target = resolveTargetDir()
      if (!target) {
        addToast({
          type: 'warning',
          title: 'Select a folder',
          description: 'Choose a CLI server folder first.',
        })
        return
      }
      const server = serverById.get(target.serverId)
      if (server && isOfflineStatus(server.status)) {
        addToast({
          type: 'warning',
          title: 'CLI server offline',
          description: `Last heartbeat ${formatRelative(server.last_seen_at)} (${formatTimestamp(server.last_seen_at)}).`,
        })
        return
      }
      setCreateName('')
      setCreateDialog({ type, serverId: target.serverId, targetPath: target.item.path })
    },
    [addToast, readOnly, resolveTargetDir, serverById]
  )

  const confirmCreate = useCallback(async () => {
    if (!createDialog) return
    const server = serverById.get(createDialog.serverId)
    if (server && isOfflineStatus(server.status)) {
      addToast({
        type: 'warning',
        title: 'CLI server offline',
        description: `Last heartbeat ${formatRelative(server.last_seen_at)} (${formatTimestamp(server.last_seen_at)}).`,
      })
      return
    }
    const name = createName.trim()
    if (!name) return
    const targetPath = normalizePath(`${createDialog.targetPath}/${name}`)
    try {
      if (createDialog.type === 'folder') {
        await writeCliFile(projectId, createDialog.serverId, { path: targetPath, operation: 'mkdir' })
      } else {
        await writeCliFile(projectId, createDialog.serverId, { path: targetPath, content: '', operation: 'write' })
      }
      setCreateDialog(null)
      setCreateName('')
      await loadDir(createDialog.serverId, createDialog.targetPath, true)
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Create failed',
        description: 'Unable to create item.',
      })
    }
  }, [addToast, createDialog, createName, loadDir, projectId, serverById])

  const handleUpload = useCallback(() => {
    if (readOnly) return
    const target = resolveTargetDir()
    if (!target) {
      addToast({
        type: 'warning',
        title: 'Select a folder',
        description: 'Choose a CLI server folder first.',
      })
      return
    }
    const server = serverById.get(target.serverId)
    if (server && isOfflineStatus(server.status)) {
      addToast({
        type: 'warning',
        title: 'CLI server offline',
        description: `Last heartbeat ${formatRelative(server.last_seen_at)} (${formatTimestamp(server.last_seen_at)}).`,
      })
      return
    }
    fileInputRef.current?.click()
  }, [addToast, readOnly, resolveTargetDir, serverById])

  useImperativeHandle(
    ref,
    () => ({
      createFile: () => handleCreate('file'),
      createFolder: () => handleCreate('folder'),
      upload: () => handleUpload(),
      refresh: () => refreshTree(),
    }),
    [handleCreate, handleUpload, refreshTree]
  )

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (readOnly) return
      const files = Array.from(event.target.files || [])
      const target = resolveTargetDir()
      if (!target) return
      const server = serverById.get(target.serverId)
      if (server && isOfflineStatus(server.status)) {
        addToast({
          type: 'warning',
          title: 'CLI server offline',
          description: `Last heartbeat ${formatRelative(server.last_seen_at)} (${formatTimestamp(server.last_seen_at)}).`,
        })
        return
      }
      for (const file of files) {
        if (file.size > TEXT_PREVIEW_MAX_BYTES) {
          addToast({
            type: 'warning',
            title: 'Upload too large',
            description: `${file.name} exceeds 1 MB.`,
          })
          continue
        }
        await uploadCliFile(projectId, target.serverId, file, target.item.path)
      }
      event.target.value = ''
      await loadDir(target.serverId, target.item.path, true)
    },
    [addToast, loadDir, projectId, readOnly, resolveTargetDir, serverById]
  )

  const renderItems = (
    serverId: string,
    path: string,
    depth: number,
    serverRootOverride?: string | null
  ) => {
    const normalizedPath = normalizePath(path)
    const dirState = dirMap[serverId]?.[normalizedPath]
    if (!dirState) {
      return null
    }
    if (dirState.isLoading) {
      return (
        <div className="py-1 text-xs text-[var(--text-muted-on-dark)]">{t('cli_tree_loading')}</div>
      )
    }
    if (dirState.error) {
      return (
        <div className="py-1 text-xs text-red-500">{dirState.error}</div>
      )
    }
    const visibleItems = hideDotfiles
      ? dirState.items.filter((item) => !item.name.startsWith('.'))
      : dirState.items

    return visibleItems.map((item) => {
      const isDir = item.type === 'directory'
      const isExpanded = expandedPaths[serverId]?.has(item.path)
      const isSelected =
        selected?.serverId === serverId && normalizePath(selected.item.path) === item.path
      const effectKey = buildCliEffectKey(serverId, item.path)
      const isHighlighted = highlightedKey === effectKey
      const isReading = readingKeys.has(effectKey)
      const isWriting = writingKeys.has(effectKey)
      const isMoved = movedKeys.has(effectKey)
      const isRenamed = renamedKeys.has(effectKey)
      const showEye = isReading || isWriting
      return (
        <div key={item.path}>
          <button
            type="button"
            className={cn(
              'cli-tree-item',
              'flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs',
              'text-[var(--text-muted-on-dark)] hover:text-[var(--text-on-dark)] hover:bg-white/[0.06]',
              isSelected && 'bg-white/[0.08] text-[var(--text-on-dark)]',
              isHighlighted && 'is-highlighted',
              isReading && 'is-reading',
              isWriting && 'is-writing',
              isMoved && 'is-moved',
              isRenamed && 'is-renamed'
            )}
            style={{ paddingLeft: 8 + depth * 12 }}
            onClick={() => {
              setSelected({ serverId, item })
              if (isWriting) clearWrite(effectKey)
              if (isMoved) clearMove(effectKey)
              if (isRenamed) clearRename(effectKey)
              if (isDir) {
                void togglePath(serverId, item.path)
              } else {
                void handleOpenFile({ serverId, item, serverRoot: serverRootOverride ?? normalizedPath })
              }
            }}
          >
            {isDir ? (
              isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )
            ) : (
              <span className="h-3 w-3" />
            )}
            <span className="truncate flex-1 min-w-0">{item.name}</span>
            {(showEye || isWriting || isMoved || isRenamed) && (
              <span className="file-tree-effect-icons ml-2 flex items-center gap-1">
                {showEye && (
                  <Eye
                    className={cn('file-tree-effect-icon', isWriting ? 'is-writing' : 'is-reading')}
                    aria-label={
                      isWriting
                        ? `${t('cli_tree_recently_written')} (${t('cli_tree_recently_read')})`
                        : t('cli_tree_recently_read')
                    }
                  />
                )}
                {isWriting && (
                  <PenLine className="file-tree-effect-icon is-writing" aria-label={t('cli_tree_recently_written')} />
                )}
                {isMoved && (
                  <ArrowRightLeft className="file-tree-effect-icon is-moving" aria-label={t('cli_tree_recently_moved')} />
                )}
                {isRenamed && (
                  <Type className="file-tree-effect-icon is-renaming" aria-label={t('cli_tree_recently_renamed')} />
                )}
              </span>
            )}
          </button>
          {isDir && isExpanded ? (
            <div>{renderItems(serverId, item.path, depth + 1, serverRootOverride ?? normalizedPath)}</div>
          ) : null}
        </div>
      )
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      <ScrollArea className="flex-1 min-h-0 file-tree-scroll">
        <div className="space-y-1 pr-2">
          {servers.length === 0 ? (
            <div className="px-2 text-xs text-[var(--text-muted-on-dark)]">
              No CLI servers connected.
            </div>
          ) : (
            servers.map((server) => {
              const isExpanded = expandedServers.has(server.id)
              const isOffline = isOfflineStatus(server.status)
              return (
                <div key={server.id} className="rounded">
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-1 rounded px-2 py-1 text-xs font-medium',
                      'text-[var(--text-muted-on-dark)] hover:text-[var(--text-on-dark)] hover:bg-white/[0.06]'
                    )}
                    onClick={() => void toggleServer(server)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    <span className="truncate">{server.name || server.hostname || server.id}</span>
                    <span
                      className={cn(
                        'ml-auto flex items-center gap-1 text-[10px] uppercase',
                        isOffline ? 'text-red-400' : 'text-emerald-400'
                      )}
                      title={`Last heartbeat ${formatRelative(server.last_seen_at)} (${formatTimestamp(
                        server.last_seen_at
                      )})`}
                    >
                      <span
                        className={cn('h-1.5 w-1.5 rounded-full', isOffline ? 'bg-red-400' : 'bg-emerald-400')}
                      />
                      {server.status}
                    </span>
                  </button>
                  {isOffline ? (
                    <div className="px-5 pb-1 text-[10px] text-[var(--text-muted-on-dark)]">
                      Last heartbeat {formatRelative(server.last_seen_at)} ({formatTimestamp(server.last_seen_at)})
                    </div>
                  ) : null}
                  {isExpanded ? (
                    <div className="pl-2">
                      {(() => {
                        const rootPath = rootByServer.get(server.id) || '/'
                        return renderItems(server.id, rootPath, 1, rootPath)
                      })()}
                    </div>
                  ) : null}
                </div>
              )
            })
          )}

          {extraRoot ? (
            <div className="mt-2 border-t border-white/[0.06] pt-2">
              <div className="rounded">
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-1 rounded px-2 py-1 text-xs font-medium',
                    'text-[var(--text-muted-on-dark)] hover:text-[var(--text-on-dark)] hover:bg-white/[0.06]'
                  )}
                  onClick={() => setExtraExpanded((prev) => !prev)}
                >
                  {extraExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <span className="truncate">{extraRoot.label}</span>
                  {extraRoot.subtitle ? (
                    <span className="ml-auto truncate text-[10px] font-normal text-[var(--text-muted-on-dark)]">
                      {extraRoot.subtitle}
                    </span>
                  ) : null}
                </button>
                {extraExpanded ? (
                  <div className="pl-2">
                    {(() => {
                      const rootPath = normalizePath(extraRoot.rootPath)
                      return renderItems(extraRoot.serverId, rootPath, 1, rootPath)
                    })()}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </ScrollArea>

      <Dialog open={Boolean(createDialog)} onOpenChange={() => setCreateDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {createDialog?.type === 'folder' ? 'Create folder' : 'Create file'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <Input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder={createDialog?.type === 'folder' ? 'Folder name' : 'File name'}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => setCreateDialog(null)}>
              Cancel
            </Button>
            <Button onClick={confirmCreate} disabled={!createName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})

export default CliExplorerTree
