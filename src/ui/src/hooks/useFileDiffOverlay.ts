'use client'

import * as React from 'react'
import type { FileDiffPayload } from '@/lib/types/ui-effects'

export type FileDiffEventDetail = {
  fileId?: string
  filePath?: string
  fileName?: string
  projectId?: string
  changeType?: 'create' | 'update' | 'delete'
  diff?: FileDiffPayload
  source?: string
}

function matchesTarget(detail: FileDiffEventDetail, target: FileDiffEventDetail) {
  if (target.projectId && detail.projectId && target.projectId !== detail.projectId) {
    return false
  }
  if (target.fileId && detail.fileId && target.fileId !== detail.fileId) {
    return false
  }
  if (target.filePath && detail.filePath && target.filePath !== detail.filePath) {
    return false
  }
  return true
}

export function useFileDiffOverlay({
  fileId,
  filePath,
  projectId,
  ttlMs = 6000,
}: {
  fileId?: string | null
  filePath?: string | null
  projectId?: string | null
  ttlMs?: number
}) {
  const [diffEvent, setDiffEvent] = React.useState<FileDiffEventDetail | null>(null)

  React.useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<FileDiffEventDetail>).detail
      if (!detail?.diff) return
      if (!matchesTarget(detail, { fileId: fileId || undefined, filePath: filePath || undefined, projectId: projectId || undefined })) {
        return
      }
      setDiffEvent({ ...detail })
    }

    window.addEventListener('ds:file:diff', handler as EventListener)
    return () => window.removeEventListener('ds:file:diff', handler as EventListener)
  }, [fileId, filePath, projectId])

  React.useEffect(() => {
    const handler = () => {
      if (!diffEvent) return
      setDiffEvent(null)
    }
    window.addEventListener('ds:tool:call', handler as EventListener)
    return () => window.removeEventListener('ds:tool:call', handler as EventListener)
  }, [diffEvent])

  React.useEffect(() => {
    if (!diffEvent) return
    const timer = window.setTimeout(() => setDiffEvent(null), ttlMs)
    return () => window.clearTimeout(timer)
  }, [diffEvent, ttlMs])

  return {
    diffEvent,
    clearDiff: () => setDiffEvent(null),
  }
}

export default useFileDiffOverlay
