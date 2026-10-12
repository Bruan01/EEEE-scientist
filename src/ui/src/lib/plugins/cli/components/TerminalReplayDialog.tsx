'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/lib/i18n/useI18n'
import { useTerminal } from '../hooks/useTerminal'

type RecordingEntry = {
  ts: number
  data: string
}

const SPEED_OPTIONS = [0.5, 1, 2, 4]

export function TerminalReplayDialog({
  open,
  onOpenChange,
  entries,
  title,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entries: RecordingEntry[]
  title: string
}) {
  const { t } = useI18n('cli')
  const [cursor, setCursor] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const timerRef = useRef<number | null>(null)
  const [terminalReady, setTerminalReady] = useState(false)
  const { containerRef, terminalRef, write, clear } = useTerminal({
    enabled: open,
    autoFocus: false,
    onReady: (terminal) => {
      terminal.options.disableStdin = true
      setTerminalReady(true)
    },
  })

  const hasEntries = entries.length > 0

  const resetTerminal = useCallback(() => {
    const terminal = terminalRef.current
    if (!terminal) {
      clear()
      return
    }
    try {
      terminal.reset()
    } catch {
      terminal.clear()
    }
    terminal.options.disableStdin = true
  }, [clear])

  const resetPlayback = useCallback(() => {
    setCursor(0)
    setIsPlaying(false)
    resetTerminal()
  }, [resetTerminal])

  const fullOutput = useMemo(() => entries.map((entry) => entry.data).join(''), [entries])

  useEffect(() => {
    if (!open) {
      setIsPlaying(false)
      setTerminalReady(false)
      resetPlayback()
      return
    }
    resetPlayback()
  }, [open, resetPlayback, entries])

  useEffect(() => {
    if (!open || !isPlaying) return
    if (!terminalReady) return
    if (cursor >= entries.length) {
      setIsPlaying(false)
      return
    }

    const prevTs = cursor > 0 ? entries[cursor - 1]?.ts ?? entries[cursor].ts : entries[cursor].ts
    const delta = Math.max(0, entries[cursor].ts - prevTs)
    const delay = Math.min(2000, Math.max(20, delta / speed))

    timerRef.current = window.setTimeout(() => {
      write(entries[cursor].data)
      setCursor((prev) => prev + 1)
    }, delay)

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [open, isPlaying, cursor, entries, speed])

  const handlePlay = () => {
    if (!hasEntries) return
    if (!terminalReady) return
    if (cursor >= entries.length) {
      resetPlayback()
    }
    setIsPlaying(true)
  }

  const handlePause = () => {
    setIsPlaying(false)
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
    }
  }

  const handleShowFull = () => {
    setIsPlaying(false)
    if (!terminalReady) return
    setCursor(entries.length)
    resetTerminal()
    write(fullOutput)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cli-root max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t('replay_title', { title })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--cli-muted-1)]">
            <div className="rounded-full border border-white/40 bg-white/70 px-3 py-1">
              {t('entries_count', { count: entries.length })}
            </div>
            <div className="flex items-center gap-2">
              <span>{t('speed')}</span>
              <Select value={String(speed)} onValueChange={(value) => setSpeed(Number(value))}>
                <SelectTrigger className="h-8 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPEED_OPTIONS.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handlePlay} disabled={!hasEntries}>
                {t('play')}
              </Button>
              <Button variant="secondary" size="sm" onClick={handlePause} disabled={!isPlaying}>
                {t('pause')}
              </Button>
              <Button variant="ghost" size="sm" onClick={resetPlayback} disabled={!hasEntries}>
                {t('restart')}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleShowFull} disabled={!hasEntries}>
                {t('show_full')}
              </Button>
            </div>
          </div>

          <div className="relative h-[360px] rounded-2xl border border-white/40 bg-white/70 p-2">
            <div ref={containerRef} className="cli-terminal h-full" />
            {!hasEntries ? (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--cli-muted-1)]">
                {t('no_recording_available')}
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
