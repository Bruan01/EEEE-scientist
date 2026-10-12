'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n/useI18n'

export function DangerCommandDialog({
  open,
  command,
  level,
  description,
  matchedPattern,
  onConfirm,
  onCancel,
}: {
  open: boolean
  command: string
  level?: string
  description?: string
  matchedPattern?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useI18n('cli')
  const [confirmText, setConfirmText] = useState('')

  useEffect(() => {
    if (!open) setConfirmText('')
  }, [open])

  const canConfirm = confirmText.trim().toUpperCase() === 'RUN'

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onCancel())}>
      <DialogContent className="cli-root max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('danger_confirm_title')}</DialogTitle>
          <DialogDescription>
            {description || t('danger_default_desc')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--cli-muted-1)]">
          {level ? (
            <span className="rounded-full border border-white/40 bg-white/70 px-2 py-0.5 text-[10px] text-[var(--cli-ink-1)]">
              {t('danger_risk', { level: level.toUpperCase() })}
            </span>
          ) : null}
          {matchedPattern ? (
            <span className="rounded-full border border-white/40 bg-white/70 px-2 py-0.5 text-[10px] text-[var(--cli-ink-1)]">
              {t('danger_pattern', { pattern: matchedPattern })}
            </span>
          ) : null}
        </div>
        <div className="rounded-xl border border-black/5 bg-black/90 p-3 font-mono text-xs text-white">
          {command}
        </div>
        <div className="space-y-2">
          <label className="text-xs text-[var(--cli-muted-1)]">{t('danger_type_run')}</label>
          <input
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder="RUN"
            className="w-full rounded-lg border border-white/40 bg-white/70 px-3 py-2 text-xs text-[var(--cli-ink-1)] outline-none"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="secondary" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button onClick={onConfirm} disabled={!canConfirm}>
            {t('run_command')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
