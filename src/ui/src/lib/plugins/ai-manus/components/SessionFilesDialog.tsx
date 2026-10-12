'use client'

import { FileText } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n/useI18n'
import { formatFileSize } from '@/lib/types/file'
import type { SessionFileResponse } from '@/lib/api/sessions'

export function SessionFilesDialog({
  open,
  onOpenChange,
  files,
  loading,
  onOpenFile,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  files: SessionFileResponse[]
  loading?: boolean
  onOpenFile: (fileId: string) => void
}) {
  const { t } = useI18n('ai_manus')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md rounded-[12px] border border-[var(--border-light)] bg-[var(--background-card)] p-5 text-[var(--text-primary)] shadow-[0px_18px_40px_-30px_var(--shadow-M)]"
        showCloseButton
      >
        <DialogTitle className="text-[11px] font-semibold text-[var(--text-primary)]">
          {t('session_files')}
        </DialogTitle>
        <DialogDescription className="text-[9px] text-[var(--text-tertiary)]">
          {t('session_files_desc')}
        </DialogDescription>
        <div className="mt-4 flex flex-col gap-2">
          {loading ? (
            <div className="text-[10px] text-[var(--text-tertiary)]">{t('loading_files_short')}</div>
          ) : files.length === 0 ? (
            <div className="text-[10px] text-[var(--text-tertiary)]">{t('no_files_yet')}</div>
          ) : (
            files.map((file) => (
              <div
                key={file.file_id ?? file.file_path ?? file.filename}
                className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--border-light)] bg-[var(--fill-tsp-white-light)] px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 text-[var(--icon-secondary)]" />
                  <div className="min-w-0">
                    <div className="truncate text-[10px] text-[var(--text-primary)]">
                      {file.filename}
                    </div>
                    <div className="text-[9px] text-[var(--text-tertiary)]">
                      {formatFileSize(file.size ?? undefined)}
                    </div>
                  </div>
                </div>
                {file.file_id ? (
                  <button
                    type="button"
                    onClick={() => onOpenFile(file.file_id as string)}
                    className="rounded-[8px] border border-[var(--border-light)] px-2 py-1 text-[9px] font-medium text-[var(--text-secondary)] hover:bg-[var(--background-white-main)]"
                  >
                    {t('open')}
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default SessionFilesDialog
