'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import type { SystemUpdateStatus } from '@/types'

const COPY = {
  zh: {
    title: '发现新版本',
    body: 'DeepScientist 检测到新的 npm 版本。请在终端运行下面这条命令完成更新。',
    current: '当前版本',
    latest: '最新版本',
    command: '更新命令',
    busy: 'DeepScientist 正在更新中。若你是从其他终端触发更新，请等待完成后再刷新当前页面。',
    updated: '更新已经完成。如需使用最新版本，请重新启动 DeepScientist。',
    close: '关闭',
    checkError: '更新检查失败',
  },
  en: {
    title: 'Update Available',
    body: 'DeepScientist found a newer npm release. Run the command below in your terminal to update it.',
    current: 'Current version',
    latest: 'Latest version',
    command: 'Update command',
    busy: 'DeepScientist is updating. If another terminal started the update, wait for it to finish and then reload this page.',
    updated: 'The update has completed. Restart DeepScientist to use the latest version.',
    close: 'Close',
    checkError: 'Update check failed',
  },
} as const

export function SystemUpdateDialog({
  open,
  onOpenChange,
  status,
  error,
  dismissing = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  status: SystemUpdateStatus | null
  error?: string | null
  dismissing?: boolean
}) {
  const { locale } = useI18n()
  const t = COPY[locale]
  const showResult = Boolean(status && !status.busy && status.last_update_result)
  const message = status?.last_update_result?.message || null
  const command = status?.manual_update_command || 'npm install -g @researai/deepscientist@latest'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-black/10 bg-[#F6F1E8] text-[#2D2A26]">
        <DialogHeader className="space-y-3 text-left">
          <DialogTitle className="text-[20px] font-semibold text-[#2D2A26]">{t.title}</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-[#5D5A55]">
            {status?.busy ? t.busy : showResult ? message || t.updated : t.body}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-[22px] border border-black/8 bg-white/75 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#7E8B97]">{t.current}</span>
            <span className="font-medium text-[#2D2A26]">{status?.current_version || '...'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#7E8B97]">{t.latest}</span>
            <span className="font-medium text-[#2D2A26]">{status?.latest_version || '...'}</span>
          </div>
          <div className="space-y-1 pt-1">
            <div className="text-xs uppercase tracking-[0.18em] text-[#9AA5AF]">{t.command}</div>
            <div className="rounded-2xl bg-[#201A16] px-3 py-2 font-mono text-xs text-[#F8F4EE]">{command}</div>
          </div>
          {status?.last_check_error ? (
            <div className="rounded-2xl border border-[#D8B9AE] bg-[#FFF3EF] px-3 py-2 text-sm text-[#8A4B37]">
              {t.checkError}: {status.last_check_error}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-2xl border border-[#D8B9AE] bg-[#FFF3EF] px-3 py-2 text-sm text-[#8A4B37]">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-2 gap-2 sm:justify-end">
          <Button
            variant="outline"
            className="border-black/12 bg-white/70 text-[#2D2A26]"
            onClick={() => onOpenChange(false)}
            disabled={dismissing}
          >
            {t.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
