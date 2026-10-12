'use client'

import { useEffect, useMemo, useState } from 'react'
import { checkProjectAccess } from '@/lib/api/projects'
import type { CliEditGranularity, CliPermissionLevel } from '../types/permissions'
import { mapProjectRoleToPermission, resolveCliCapabilities } from '../types/permissions'

export function useCliAccess(options: {
  projectId?: string | null
  serverId?: string | null
  readOnly?: boolean
}) {
  const { projectId, serverId, readOnly } = options
  const [permission, setPermission] = useState<CliPermissionLevel>('none')
  const [granularity, setGranularity] = useState<CliEditGranularity | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId || !serverId) {
      setPermission('none')
      setGranularity(null)
      return
    }

    if (readOnly) {
      setPermission('view')
      setGranularity(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    const resolveAccess = async () => {
      try {
        const access = await checkProjectAccess(projectId)
        if (cancelled) return
        const rolePermission = mapProjectRoleToPermission(access?.role)
        setPermission(rolePermission)
        setGranularity(null)
      } catch (err) {
        if (cancelled) return
        setPermission('none')
        setGranularity(null)
        setError('Failed to resolve CLI permissions')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void resolveAccess()
    return () => {
      cancelled = true
    }
  }, [projectId, readOnly, serverId])

  const capabilities = useMemo(() => resolveCliCapabilities(permission, granularity), [permission, granularity])

  return {
    permission,
    granularity,
    capabilities,
    isLoading,
    error,
  }
}
