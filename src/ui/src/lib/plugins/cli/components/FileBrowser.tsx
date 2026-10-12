'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { Loader2, RefreshCw, Upload } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { downloadCliFile } from '@/lib/api/cli'
import type { CliFileItem, CliServerStatus } from '../types/cli'
import { useFileBrowser } from '../hooks/useFileBrowser'
import { FileItem } from './FileItem'
import { FadeContent, SpotlightCard } from '@/components/react-bits'
import {
  findSensitiveMarker,
  DOWNLOAD_MAX_BYTES,
  joinPath,
  normalizePath,
  splitPath,
  TEXT_PREVIEW_MAX_BYTES,
} from '../lib/file-utils'
import { useTabsStore } from '@/lib/stores/tabs'
import { BUILTIN_PLUGINS, getPluginIdFromExtension, getPluginIdFromMimeType } from '@/lib/types/plugin'
import { buildCliFileId } from '@/lib/api/cli-file-id'
import { toCliResourcePath } from '@/lib/utils/resource-paths'

const CLI_OFFLINE_MESSAGE = 'CLI server offline. Please ensure the CLI is running.'

const resolveCliError = (err: unknown, fallback: string) => {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail ?? err.response?.data?.message
    if (detail) {
      const detailStr = String(detail)
      const lower = detailStr.toLowerCase()
      if (lower.includes('not connected') || lower.includes('offline')) {
        return CLI_OFFLINE_MESSAGE
      }
      return detailStr
    }
    if (err.response?.status === 503) {
      return CLI_OFFLINE_MESSAGE
    }
  }
  if (err instanceof Error && err.message) {
    return err.message
  }
  return fallback
}

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

export function FileBrowser({
  projectId,
  serverId,
  serverRoot,
  serverStatus,
  serverLastSeenAt,
  readOnly,
  canDelete,
  canUpload,
  canDownload,
}: {
  projectId: string
  serverId: string
  serverRoot?: string | null
  serverStatus?: CliServerStatus
  serverLastSeenAt?: string | null
  readOnly?: boolean
  canDelete?: boolean
  canUpload?: boolean
  canDownload?: boolean
}) {
  const { path, items, isLoading, error, load, uploadFile, removeFile } = useFileBrowser(
    projectId,
    serverId,
    serverRoot
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addToast } = useToast()
  const openTab = useTabsStore((state) => state.openTab)
  const [selectedItem, setSelectedItem] = useState<CliFileItem | null>(null)
  const [deleteTargets, setDeleteTargets] = useState<CliFileItem[] | null>(null)
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const isServerOffline = serverStatus === 'offline' || serverStatus === 'error'

  const listMeta = useMemo(() => {
    const fileCount = items.filter((item) => item.type === 'file').length
    const folderCount = items.filter((item) => item.type === 'directory').length
    return { fileCount, folderCount }
  }, [items])

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name)
      return a.type === 'directory' ? -1 : 1
    })
  }, [items])

  const rootPath = useMemo(() => normalizePath(serverRoot || '/'), [serverRoot])

  const relativePath = useMemo(() => {
    if (!rootPath || rootPath === '/') return normalizePath(path)
    if (path.startsWith(rootPath)) {
      const stripped = path.slice(rootPath.length)
      return normalizePath(stripped || '/')
    }
    return normalizePath(path)
  }, [path, rootPath])

  const resolveAbsolutePath = useCallback(
    (nextPath: string) => {
      if (!rootPath || rootPath === '/') return normalizePath(nextPath)
      const normalized = normalizePath(nextPath)
      if (normalized === '/') return rootPath
      return normalizePath(`${rootPath}/${normalized.replace(/^\//, '')}`)
    },
    [rootPath]
  )

  const breadcrumbs = useMemo(() => {
    const segments = splitPath(relativePath)
    const rootLabel = serverRoot || `/CLI/${serverId}`
    const crumbs = [{ label: rootLabel, path: '/' }]
    segments.forEach((segment, index) => {
      crumbs.push({
        label: segment,
        path: joinPath(segments.slice(0, index + 1)),
      })
    })
    return crumbs
  }, [relativePath, serverId, serverRoot])

  const selectedItems = useMemo(
    () => items.filter((item) => selectedPaths.has(item.path)),
    [items, selectedPaths]
  )

  const handleToggleSelect = useCallback((item: CliFileItem) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(item.path)) {
        next.delete(item.path)
      } else {
        next.add(item.path)
      }
      return next
    })
  }, [])

  const resolvePluginId = useCallback(
    (item: CliFileItem) => {
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
    },
    []
  )

  const handleDownload = useCallback(
    async (item: CliFileItem) => {
      if (!canDownload) return
      const sensitive = findSensitiveMarker(item.path)
      if (sensitive) {
        addToast({
          type: 'warning',
          title: 'Download blocked',
          description: `Sensitive file access blocked (${sensitive}).`,
        })
        return
      }
      if (item.size && item.size > DOWNLOAD_MAX_BYTES) {
        addToast({
          type: 'warning',
          title: 'Download too large',
          description: 'This file exceeds the download limit. Use a CLI tool to fetch it.',
        })
        return
      }
      try {
        const blob = await downloadCliFile(projectId, serverId, item.path)
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = item.name
        link.click()
        URL.revokeObjectURL(url)
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Download failed',
          description: 'Unable to download this file.',
        })
      }
    },
    [addToast, canDownload, projectId, serverId]
  )

  const handleOpen = useCallback(
    async (item: CliFileItem) => {
      if (item.type === 'directory') {
        setSelectedItem(null)
        await load(item.path, false)
        return
      }

      const sensitive = findSensitiveMarker(item.path)
      if (sensitive) {
        addToast({
          type: 'warning',
          title: 'Access blocked',
          description: `Sensitive file access blocked (${sensitive}).`,
        })
        return
      }

      const pluginId = resolvePluginId(item)
      if (!pluginId) {
        addToast({
          type: 'warning',
          title: 'No viewer available',
          description: 'Download the file to view it locally.',
        })
        if (canDownload) {
          await handleDownload(item)
        }
        return
      }

      setSelectedItem(item)
      const fileId = buildCliFileId({ projectId, serverId, path: item.path })
      const fileMeta = {
        updatedAt: item.modified_at ?? undefined,
        sizeBytes: item.size ?? undefined,
        mimeType: item.mime_type ?? undefined,
      }

      openTab({
        pluginId,
        context: {
          type: 'file',
          resourceId: fileId,
          resourcePath: toCliResourcePath({
            serverId,
            path: item.path,
            serverRoot: serverRoot ?? undefined,
          }),
          resourceName: item.name,
          mimeType: item.mime_type ?? undefined,
          customData: {
            projectId,
            fileSource: 'cli',
            cliServerId: serverId,
            cliPath: item.path,
            cliRoot: serverRoot ?? undefined,
            fileMeta,
            readOnly: readOnly ?? false,
            readonly: readOnly ?? false,
          },
        },
        title: item.name,
      })
    },
    [
      addToast,
      canDownload,
      handleDownload,
      load,
      openTab,
      projectId,
      readOnly,
      resolvePluginId,
      serverId,
      serverRoot,
    ]
  )

  const handleRefresh = useCallback(() => {
    void load(path, true)
  }, [load, path])

  const handleUpload = useCallback(() => {
    if (readOnly || !canUpload) return
    fileInputRef.current?.click()
  }, [readOnly, canUpload])

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (readOnly || !canUpload) return
      const files = Array.from(event.target.files || [])
      if (files.length === 0) return
      const targetPath = normalizePath(path)
      for (const file of files) {
        if (file.size > TEXT_PREVIEW_MAX_BYTES) {
          addToast({
            type: 'warning',
            title: 'Upload too large',
            description: `${file.name} exceeds 1 MB and cannot be uploaded.`,
          })
          continue
        }
        try {
          await uploadFile(file, targetPath)
        } catch (err) {
          addToast({
            type: 'error',
            title: 'Upload failed',
            description: resolveCliError(err, 'Unable to upload this file.'),
          })
        }
      }
      event.target.value = ''
    },
    [addToast, path, readOnly, canUpload, uploadFile]
  )

  const requestDelete = useCallback(
    (targets: CliFileItem[]) => {
      if (readOnly || !canDelete) return
      setDeleteTargets(targets)
    },
    [readOnly, canDelete]
  )

  const confirmDelete = useCallback(async () => {
    if (!deleteTargets) return
    for (const item of deleteTargets) {
      const sensitive = findSensitiveMarker(item.path)
      if (sensitive) {
        addToast({
          type: 'warning',
          title: 'Delete blocked',
          description: `Sensitive file access blocked (${sensitive}).`,
        })
        continue
      }
      try {
        await removeFile(item.path, item.type === 'directory')
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Delete failed',
          description: resolveCliError(err, 'Unable to delete this file.'),
        })
      }
    }
    setDeleteTargets(null)
    setSelectedPaths(new Set())
  }, [addToast, deleteTargets, removeFile])

  return (
    <div className="flex h-full flex-col gap-4">
      <FadeContent duration={0.4} y={10}>
        <SpotlightCard className="rounded-2xl border border-white/40 bg-white/70 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--cli-ink-1)]">Files</div>
              <div className="text-xs text-[var(--cli-muted-1)]">
                Browse and manage CLI server files.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={handleRefresh}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Refresh
              </Button>
              {!readOnly ? (
                <>
                  <Button size="sm" onClick={handleUpload} disabled={!canUpload}>
                    <Upload className="mr-2 h-3.5 w-3.5" />
                    Upload
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                    aria-label="Upload files"
                  />
                </>
              ) : null}
            </div>
          </div>
        </SpotlightCard>
      </FadeContent>

      <FadeContent duration={0.4} y={10}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SpotlightCard className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/40 bg-white/70 px-3 py-2 text-xs text-[var(--cli-muted-1)]">
            <div className="text-[10px] uppercase tracking-wide text-[var(--cli-muted-1)]">Path</div>
            <div className="flex flex-wrap items-center gap-2">
              {breadcrumbs.map((crumb, index) => (
                <button
                  key={crumb.path}
                  type="button"
                  onClick={() => load(resolveAbsolutePath(crumb.path), false)}
                  className="cli-focus-ring rounded-full border border-white/40 bg-white/60 px-3 py-1 text-[var(--cli-ink-1)] hover:bg-white/80"
                  aria-label={`Navigate to ${crumb.label}`}
                >
                  {crumb.label}
                  {index < breadcrumbs.length - 1 ? ' /' : ''}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[var(--cli-muted-1)]">
              <span className="h-1 w-1 rounded-full bg-[var(--cli-muted-2)]" />
              {listMeta.folderCount} folders · {listMeta.fileCount} files
              {selectedItems.length > 0 ? (
                <>
                  <span className="h-1 w-1 rounded-full bg-[var(--cli-muted-2)]" />
                  {selectedItems.length} selected
                </>
              ) : null}
              {readOnly ? (
                <>
                  <span className="h-1 w-1 rounded-full bg-[var(--cli-muted-2)]" />
                  Read-only
                </>
              ) : null}
            </div>
          </SpotlightCard>

        </div>
      </FadeContent>

      {isServerOffline ? (
        <div className="rounded-xl border border-white/40 bg-white/70 p-4 text-sm text-[var(--cli-muted-1)]">
          <div>CLI server is offline. Please ensure the CLI is running and connected.</div>
          <div className="mt-1 text-[11px] text-[var(--cli-muted-2)]">
            Last heartbeat {formatRelative(serverLastSeenAt)} ({formatTimestamp(serverLastSeenAt)})
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-white/40 bg-white/70 p-4 text-sm text-[var(--cli-muted-1)]">
          {error}
        </div>
      ) : null}

      <div className="h-full min-h-0">
        <SpotlightCard className="h-full rounded-2xl border border-white/40 bg-white/60 p-3">
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="flex items-center justify-center py-6 text-sm text-[var(--cli-muted-1)]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading files...
              </div>
            ) : (
              <div className="space-y-1">
                {sortedItems.map((item) => (
                  <FileItem
                    key={item.path}
                    item={item}
                    isSelected={selectedItem?.path === item.path}
                    isChecked={selectedPaths.has(item.path)}
                    onToggle={handleToggleSelect}
                    onOpen={handleOpen}
                    onDownload={handleDownload}
                    onDelete={(target) => requestDelete([target])}
                    readOnly={readOnly}
                    canDownload={canDownload}
                    canDelete={canDelete}
                  />
                ))}
                {sortedItems.length === 0 ? (
                  <div className="py-6 text-center text-sm text-[var(--cli-muted-1)]">
                    No files in this folder.
                  </div>
                ) : null}
              </div>
            )}
          </ScrollArea>
        </SpotlightCard>
      </div>

      {selectedItems.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/40 bg-white/70 px-4 py-3 text-xs text-[var(--cli-muted-1)]">
          <span>{selectedItems.length} selected</span>
          <div className="flex items-center gap-2">
            {canDownload ? (
              <Button variant="secondary" size="sm" onClick={() => selectedItems.forEach(handleDownload)}>
                Download selected
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => requestDelete(selectedItems)}
              >
                Delete selected
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={() => setSelectedPaths(new Set())}>
              Clear selection
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={Boolean(deleteTargets)} onOpenChange={() => setDeleteTargets(null)}>
      <DialogContent className="cli-root max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm delete</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-[var(--cli-muted-1)]">
            {deleteTargets?.map((target) => (
              <div key={target.path} className="rounded-lg border border-white/40 bg-white/70 px-3 py-2">
                {target.path}
              </div>
            ))}
            <div>This action cannot be undone.</div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => setDeleteTargets(null)}>
              Cancel
            </Button>
            <Button onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
