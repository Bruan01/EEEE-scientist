'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { listCliLogs, getCliLogObject } from '@/lib/api/cli'
import type { CliLogObject } from '../types/cli'

export function useOperationLogs(projectId?: string | null, serverId?: string | null) {
  const DEFAULT_LIMIT = 20
  const [items, setItems] = useState<CliLogObject[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(DEFAULT_LIMIT)
  const [offset, setOffset] = useState(0)
  const paramsRef = useRef<{ start_time?: string; end_time?: string }>({})
  const paginationRef = useRef({ limit: DEFAULT_LIMIT, offset: 0 })

  const load = useCallback(
    async (
      params?: { start_time?: string; end_time?: string },
      options?: { append?: boolean }
    ) => {
      if (!projectId || !serverId) return
      setIsLoading(true)
      setError(null)
      try {
        if (params) {
          paramsRef.current = params
        }
        const nextOffset = options?.append
          ? paginationRef.current.offset + paginationRef.current.limit
          : 0
        const response = await listCliLogs(projectId, serverId, {
          ...paramsRef.current,
          limit: paginationRef.current.limit,
          offset: nextOffset,
        })
        paginationRef.current = { limit: response.limit, offset: response.offset }
        setTotal(response.total)
        setLimit(response.limit)
        setOffset(response.offset)
        setItems((prev) => (options?.append ? [...prev, ...response.items] : response.items))
      } catch (err) {
        console.error('[CLI] Failed to load logs:', err)
        setError('Failed to load logs')
      } finally {
        setIsLoading(false)
      }
    },
    [projectId, serverId]
  )

  const downloadLog = useCallback(
    async (
      logObjectId: string,
      options?: { download?: boolean; decompress?: boolean }
    ) => {
      if (!projectId || !serverId) return null
      return getCliLogObject(projectId, serverId, logObjectId, options)
    },
    [projectId, serverId]
  )

  useEffect(() => {
    if (!projectId || !serverId) return
    void load()
  }, [projectId, serverId, load])

  const loadMore = useCallback(async () => {
    if (isLoading) return
    if (items.length >= total) return
    await load(undefined, { append: true })
  }, [isLoading, items.length, load, total])

  return {
    items,
    isLoading,
    error,
    load,
    loadMore,
    total,
    limit,
    offset,
    downloadLog,
  }
}
