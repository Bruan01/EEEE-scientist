import { Download, FileText, Folder, Trash2 } from 'lucide-react'
import type { CliFileItem } from '../types/cli'
import { formatFileSize } from '../lib/file-utils'
import { cn } from '@/lib/utils'

export function FileItem({
  item,
  isSelected,
  isChecked,
  onToggle,
  onOpen,
  onDownload,
  onDelete,
  readOnly,
  canDownload,
  canDelete,
}: {
  item: CliFileItem
  isSelected?: boolean
  isChecked?: boolean
  onToggle?: (item: CliFileItem) => void
  onOpen: (item: CliFileItem) => void
  onDownload?: (item: CliFileItem) => void
  onDelete?: (item: CliFileItem) => void
  readOnly?: boolean
  canDownload?: boolean
  canDelete?: boolean
}) {
  const isDir = item.type === 'directory'

  return (
    <div
      className={cn(
        'flex w-full items-center justify-between rounded-lg border border-transparent px-3 py-2 text-left text-sm transition',
        'hover:bg-white/60',
        isSelected && 'border-white/70 bg-white/70'
      )}
    >
      <button type="button" onClick={() => onOpen(item)} className="flex flex-1 items-center gap-2">
        <input
          type="checkbox"
          checked={Boolean(isChecked)}
          onChange={() => onToggle?.(item)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Select ${item.name}`}
          className="cli-focus-ring h-3.5 w-3.5 accent-[var(--cli-accent-olive)]"
        />
        {isDir ? <Folder className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        <span className="text-[var(--cli-ink-1)]">{item.name}</span>
      </button>
      <div className="flex items-center gap-2 text-xs text-[var(--cli-muted-1)]">
        <span>{isDir ? 'Folder' : formatFileSize(item.size)}</span>
        {onDownload && !isDir ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              if (!canDownload) return
              onDownload(item)
            }}
            disabled={!canDownload}
            className="cli-focus-ring text-[var(--cli-muted-1)] hover:text-[var(--cli-ink-1)] disabled:opacity-50"
            title={canDownload ? 'Download' : 'Download not allowed'}
            aria-label={canDownload ? `Download ${item.name}` : 'Download not allowed'}
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              if (readOnly || !canDelete) return
              onDelete(item)
            }}
            disabled={readOnly || !canDelete}
            className="cli-focus-ring text-[var(--cli-muted-1)] hover:text-[var(--cli-ink-1)] disabled:opacity-50"
            title={readOnly || !canDelete ? 'Delete not allowed' : 'Delete'}
            aria-label={readOnly || !canDelete ? 'Delete not allowed' : `Delete ${item.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
