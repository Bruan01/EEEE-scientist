'use client'

import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { listCliFiles, readCliFile, writeCliFile, deleteCliFile, uploadCliFile } from '@/lib/api/cli'
import { normalizePath } from '../lib/file-utils'
import type { CliFileItem, CliFileContentResponse } from '../types/cli'

const CLI_OFFLINE_MESSAGE = 'CLI server offline. Please ensure the CLI is running.'

const resolveErrorMessage = (err: unknown, fallback: string) => {
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

export function useFileBrowser(
  projectId?: string | null,
  serverId?: string | null,
  rootPath?: string | null
) {
  const [path, setPath] = useState('/')
  const [items, setItems] = useState<CliFileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const normalizedRoot = normalizePath(rootPath || '/')

  const load = useCallback(
    async (nextPath: string, refresh = false) => {
      if (!projectId || !serverId) return
      const normalizedPath = normalizePath(nextPath)
      setIsLoading(true)
      setError(null)
      try {
        const response = await listCliFiles(projectId, serverId, normalizedPath, refresh)
        const normalizedItems = response.items.map((item) => ({
          ...item,
          path: normalizePath(item.path),
        }))
        setItems(normalizedItems)
        setPath(normalizePath(response.path || normalizedPath))
      } catch (err) {
        console.error('[CLI] Failed to load files:', err)
        setError(resolveErrorMessage(err, 'Failed to load files'))
      } finally {
        setIsLoading(false)
      }
    },
    [projectId, serverId]
  )

  const readFile = useCallback(
    async (filePath: string, tailBytes?: number): Promise<CliFileContentResponse | null> => {
      if (!projectId || !serverId) return null
      try {
        return await readCliFile(projectId, serverId, filePath, tailBytes)
      } catch (err) {
        console.error('[CLI] Failed to read file:', err)
        return null
      }
    },
    [projectId, serverId]
  )

  const writeFile = useCallback(
    async (filePath: string, content: string) => {
      if (!projectId || !serverId) return
      await writeCliFile(projectId, serverId, { path: filePath, content, operation: 'write' })
      await load(path, true)
    },
    [projectId, serverId, load, path]
  )

  const removeFile = useCallback(
    async (filePath: string, recursive = false) => {
      if (!projectId || !serverId) return
      await deleteCliFile(projectId, serverId, filePath, recursive)
      await load(path, true)
    },
    [projectId, serverId, load, path]
  )

  const uploadFile = useCallback(
    async (file: File, targetPath: string) => {
      if (!projectId || !serverId) return
      await uploadCliFile(projectId, serverId, file, targetPath)
      await load(path, true)
    },
    [projectId, serverId, load, path]
  )

  useEffect(() => {
    if (!projectId || !serverId) return
    void load(normalizedRoot, true)
  }, [projectId, serverId, normalizedRoot, load])

  return {
    path,
    items,
    isLoading,
    error,
    load,
    readFile,
    writeFile,
    removeFile,
    uploadFile,
    setPath,
  }
}
