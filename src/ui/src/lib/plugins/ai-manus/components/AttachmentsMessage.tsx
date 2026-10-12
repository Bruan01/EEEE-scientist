'use client'

import { FileIcon } from '@/components/file-tree/FileIcon'
import { formatFileSize, getMimeTypeFromExtension } from '@/lib/types/file'
import { cn } from '@/lib/utils'
import type { AttachmentsContent } from '../types'

export function AttachmentsMessage({
  content,
  onFileClick,
  compact,
}: {
  content: AttachmentsContent
  onFileClick?: (fileId: string) => void
  compact?: boolean
}) {
  if (!content.attachments.length) return null
  const isCompact = Boolean(compact)

  return (
    <div className="mt-3 flex flex-col gap-2">
      {!isCompact ? (
        <div className="text-[9px] font-medium text-[var(--text-tertiary)]">Attachments</div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {content.attachments.map((file) => {
          const mimeType = file.content_type || getMimeTypeFromExtension(file.filename)
          const status = file.status ?? 'success'
          const ext = file.filename.split('.').pop()
          const typeLabel = ext
            ? ext.toUpperCase()
            : mimeType
              ? mimeType.split('/').pop()?.toUpperCase()
              : 'FILE'
          const sizeLabel = file.size ? formatFileSize(file.size) : ''
          const progressValue = typeof file.progress === 'number' ? file.progress : status === 'success' ? 100 : 0
          const progressClamped = Math.max(0, Math.min(100, progressValue))
          const metaText =
            status === 'failed'
              ? file.error
                ? `Upload failed · ${file.error}`
                : 'Upload failed'
              : status === 'uploading'
                ? `Uploading${typeof file.progress === 'number' ? ` ${Math.round(progressClamped)}%` : '...'}`
                : status === 'queued'
                  ? 'Queued'
                  : [typeLabel, sizeLabel].filter(Boolean).join(' · ')
          return (
            <button
              key={file.file_id}
              type="button"
              onClick={() => onFileClick?.(file.file_id)}
              className={
                isCompact
                  ? 'flex min-w-[min(200px,100%)] items-center gap-2 rounded-[10px] border border-[var(--border-light)] bg-[var(--fill-tsp-white-main)] px-3 py-2 text-left text-[11px] text-[var(--text-primary)] hover:bg-[var(--fill-tsp-white-dark)]'
                  : 'flex min-w-[min(200px,100%)] items-center gap-2 rounded-[10px] border border-[var(--border-light)] bg-[var(--fill-tsp-white-main)] px-3 py-2 text-left text-[9px] text-[var(--text-primary)] hover:bg-[var(--fill-tsp-white-dark)]'
              }
            >
              <FileIcon type="file" mimeType={mimeType} name={file.filename} className="h-4 w-4" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className={isCompact ? 'truncate text-[11px] font-medium' : 'truncate text-[9px] font-medium'}>
                  {file.filename}
                </span>
                <span
                  className={cn(
                    isCompact ? 'text-[10px]' : 'text-[8px]',
                    status === 'failed' ? 'text-[var(--function-error)]' : 'text-[var(--text-tertiary)]'
                  )}
                >
                  {metaText}
                </span>
                {status !== 'success' ? (
                  <div className="mt-1 h-1 w-full rounded-full bg-[var(--fill-tsp-gray-main)]">
                    <div
                      className={cn(
                        'h-1 rounded-full transition-[width] duration-200',
                        status === 'failed'
                          ? 'bg-[var(--function-error)]'
                          : status === 'uploading'
                            ? 'bg-[var(--fill-blue)]'
                            : 'bg-[var(--fill-tsp-white-dark)]'
                      )}
                      style={{ width: `${progressClamped}%` }}
                    />
                  </div>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default AttachmentsMessage
