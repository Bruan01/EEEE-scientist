'use client'

import { ArrowUpCircle, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { loadSystemUpdateStatus } from '@/lib/system-update-status'
import type { SystemUpdateStatus } from '@/types'

import { SystemUpdateDialog } from './SystemUpdateDialog'

const LABELS = {
  zh: '更新',
  en: 'Update',
} as const

function isNativeWindowsBrowser() {
  if (typeof navigator === 'undefined') {
    return false
  }
  return /windows/i.test(navigator.userAgent)
}

export function SystemUpdateButton() {
  const { locale } = useI18n()
  const label = LABELS[locale]
  const [status, setStatus] = useState<SystemUpdateStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const intervalRef = useRef<number | null>(null)
  const disablePolling = isNativeWindowsBrowser()

  useEffect(() => {
    let cancelled = false

    const loadStatus = async () => {
      try {
        const payload = await loadSystemUpdateStatus({ force: false, maxAgeMs: 5000 })
        if (cancelled) {
          return
        }
        setStatus(payload)
        setError(null)
      } catch (caught) {
        if (cancelled) {
          return
        }
        setError(caught instanceof Error ? caught.message : 'Failed to load update status.')
      }
    }

    void loadStatus()
    if (!disablePolling) {
      intervalRef.current = window.setInterval(() => {
        void loadStatus()
      }, 60_000)
    }

    return () => {
      cancelled = true
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [disablePolling])

  const visible = Boolean(status?.update_available || status?.busy)
  if (!visible) {
    return null
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className="relative rounded-full border border-amber-400/40 bg-amber-50/80 pr-3 text-amber-900 hover:bg-amber-100/90 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-100"
        title={status?.latest_version ? `${label} ${status.latest_version}` : label}
      >
        <ArrowUpCircle className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
        <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 text-amber-500" />
      </Button>
      <SystemUpdateDialog open={open} onOpenChange={setOpen} status={status} error={error} />
    </>
  )
}
