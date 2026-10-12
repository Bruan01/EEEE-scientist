import type { CliLogObject } from '../types/cli'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

function formatTimestamp(value?: string) {
  if (!value) return 'n/a'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'n/a'
  return parsed.toLocaleString()
}

export function OperationLogItem({
  log,
  onDownload,
}: {
  log: CliLogObject
  onDownload?: (logId: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/40 bg-white/70 px-4 py-3">
      <div>
        <div className="text-sm font-medium text-[var(--cli-ink-1)]">
          {formatTimestamp(log.time_start)} - {formatTimestamp(log.time_end)}
        </div>
        <div className="mt-1 text-xs text-[var(--cli-muted-1)]">
          {log.entry_count} entries · {log.format}
        </div>
      </div>
      {onDownload ? (
        <Button variant="secondary" size="sm" onClick={() => onDownload(log.id)}>
          <Download className="mr-2 h-3.5 w-3.5" />
          Download
        </Button>
      ) : null}
    </div>
  )
}
