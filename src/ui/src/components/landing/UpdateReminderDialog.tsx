'use client'

import { useEffect, useRef, useState } from 'react'

import { client } from '@/lib/api'
import { loadSystemUpdateStatus } from '@/lib/system-update-status'
import type { SystemUpdateStatus } from '@/types'

import { SystemUpdateDialog } from '@/components/system-update/SystemUpdateDialog'

export function UpdateReminderDialog() {
  const [status, setStatus] = useState<SystemUpdateStatus | null>(null)
  const [open, setOpen] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollingTimerRef = useRef<number | null>(null)
  const promptedVersionRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const markPromptSeen = async (payload: SystemUpdateStatus) => {
      const latestVersion = String(payload.latest_version || '').trim()
      if (!latestVersion || promptedVersionRef.current === latestVersion) {
        return
      }
      promptedVersionRef.current = latestVersion
      try {
        await client.systemUpdateAction('remind_later')
      } catch {
        // Prompt visibility should not fail if the reminder ack request fails.
      }
    }

    const loadStatus = async (initial = false) => {
      try {
        const payload = await loadSystemUpdateStatus({ force: false, maxAgeMs: 5000 })
        if (cancelled) {
          return
        }
        setStatus(payload)
        setError(null)
        if (payload.busy) {
          setOpen(true)
          return
        }
        if (payload.prompt_recommended) {
          setOpen(true)
          void markPromptSeen(payload)
          return
        }
        if (initial) {
          setOpen(false)
        }
      } catch (caught) {
        if (cancelled) {
          return
        }
        if (initial) {
          setOpen(false)
        }
        setError(caught instanceof Error ? caught.message : 'Failed to load update status.')
      }
    }

    void loadStatus(true)

    return () => {
      cancelled = true
      if (pollingTimerRef.current !== null) {
        window.clearInterval(pollingTimerRef.current)
        pollingTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!status?.busy) {
      return
    }
    pollingTimerRef.current = window.setInterval(() => {
      void client
        .systemUpdateStatus()
        .then((payload) => {
          setStatus(payload)
          setError(null)
        })
        .catch((caught) => {
          setError(caught instanceof Error ? caught.message : 'Failed to load update status.')
        })
    }, 3000)

    return () => {
      if (pollingTimerRef.current !== null) {
        window.clearInterval(pollingTimerRef.current)
        pollingTimerRef.current = null
      }
    }
  }, [status?.busy])

  const handleOpenChange = async (nextOpen: boolean) => {
    if (nextOpen) {
      setOpen(true)
      return
    }
    setDismissing(true)
    try {
      setOpen(false)
    } finally {
      setDismissing(false)
    }
  }

  return (
    <SystemUpdateDialog
      open={open}
      onOpenChange={(nextOpen) => {
        void handleOpenChange(nextOpen)
      }}
      status={status}
      error={error}
      dismissing={dismissing}
    />
  )
}
