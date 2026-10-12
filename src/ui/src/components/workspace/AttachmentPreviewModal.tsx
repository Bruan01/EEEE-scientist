'use client'

import * as React from 'react'
import { ExternalLink, FileText, Image as ImageIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'

export type AttachmentPreviewItem = {
  id: string
  name: string
  contentType?: string | null
  sizeBytes?: number | null
  status?: string | null
  previewUrl?: string | null
  assetUrl?: string | null
  questRelativePath?: string | null
  path?: string | null
  extractedTextPath?: string | null
  kind?: string | null
  error?: string | null
  file?: File | null
}

const TEXT_LIKE_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'csv',
  'tsv',
  'yaml',
  'yml',
  'toml',
  'xml',
  'html',
  'css',
  'js',
  'jsx',
  'ts',
  'tsx',
  'py',
  'sh',
  'bash',
  'zsh',
  'sql',
  'tex',
  'bib',
  'log',
])

function isImageAttachment(item: AttachmentPreviewItem) {
  return String(item.contentType || item.kind || '')
    .trim()
    .toLowerCase()
    .startsWith('image')
}

function isPdfAttachment(item: AttachmentPreviewItem) {
  return String(item.contentType || '')
    .trim()
    .toLowerCase() === 'application/pdf'
}

function isTextLikeAttachment(item: AttachmentPreviewItem) {
  const mime = String(item.contentType || '')
    .trim()
    .toLowerCase()
  if (
    mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('xml') ||
    mime.includes('yaml') ||
    mime.includes('csv') ||
    mime.includes('javascript')
  ) {
    return true
  }
  const name = String(item.name || '').trim()
  const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() || '' : ''
  return TEXT_LIKE_EXTENSIONS.has(extension)
}

function humanSize(value?: number | null) {
  const size = typeof value === 'number' && Number.isFinite(value) ? value : null
  if (size == null) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size >= 10 * 1024 ? 0 : 1)} KB`
  return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`
}

async function loadAttachmentText(item: AttachmentPreviewItem) {
  if (item.file) {
    return item.file.text()
  }
  const target = String(item.assetUrl || item.previewUrl || '').trim()
  if (!target) {
    throw new Error('No preview source available.')
  }
  const response = await fetch(target, { credentials: 'same-origin' })
  if (!response.ok) {
    throw new Error(`Failed to load preview (${response.status}).`)
  }
  return response.text()
}

export function AttachmentPreviewModal({
  open,
  onClose,
  items,
  initialIndex = 0,
}: {
  open: boolean
  onClose: () => void
  items: AttachmentPreviewItem[]
  initialIndex?: number
}) {
  const normalizedItems = React.useMemo(() => items.filter((item) => item && item.name), [items])
  const [selectedIndex, setSelectedIndex] = React.useState(initialIndex)
  const [textPreview, setTextPreview] = React.useState('')
  const [loadingText, setLoadingText] = React.useState(false)
  const [textError, setTextError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setSelectedIndex(Math.min(Math.max(initialIndex, 0), Math.max(normalizedItems.length - 1, 0)))
  }, [initialIndex, normalizedItems.length, open])

  const current = normalizedItems[selectedIndex] || null

  React.useEffect(() => {
    let canceled = false
    if (!open || !current) {
      setTextPreview('')
      setTextError(null)
      setLoadingText(false)
      return
    }
    if (!isTextLikeAttachment(current)) {
      setTextPreview('')
      setTextError(null)
      setLoadingText(false)
      return
    }
    setLoadingText(true)
    setTextPreview('')
    setTextError(null)
    void loadAttachmentText(current)
      .then((text) => {
        if (canceled) return
        setTextPreview(text.slice(0, 200_000))
      })
      .catch((caught) => {
        if (canceled) return
        setTextError(caught instanceof Error ? caught.message : String(caught))
      })
      .finally(() => {
        if (canceled) return
        setLoadingText(false)
      })
    return () => {
      canceled = true
    }
  }, [current, open])

  if (!open || !current) return null

  const sourceUrl = String(current.assetUrl || current.previewUrl || '').trim() || null
  const metadata = [
    current.contentType ? `Type: ${current.contentType}` : '',
    humanSize(current.sizeBytes),
    current.status ? `Status: ${current.status}` : '',
    current.questRelativePath || current.path || current.extractedTextPath || '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={current.name}
      description={metadata || undefined}
      size="xl"
      className="max-h-[min(88vh,920px)] max-w-[min(1100px,96vw)]"
    >
      <div className="flex max-h-[72vh] min-h-[420px] flex-col gap-4 md:flex-row">
        {normalizedItems.length > 1 ? (
          <div className="md:w-[280px] md:shrink-0">
            <div className="max-h-[72vh] overflow-y-auto rounded-[20px] border border-black/[0.08] bg-black/[0.02] p-2 dark:border-white/[0.10] dark:bg-white/[0.03]">
              {normalizedItems.map((item, index) => {
                const active = index === selectedIndex
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedIndex(index)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[16px] px-3 py-2 text-left transition',
                      active ? 'bg-black/[0.08] dark:bg-white/[0.10]' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                    )}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-black/[0.05] text-muted-foreground dark:bg-white/[0.08]">
                      {isImageAttachment(item) ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{item.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {item.questRelativePath || item.path || item.contentType || 'Attachment'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-hidden rounded-[20px] border border-black/[0.08] bg-black/[0.02] dark:border-white/[0.10] dark:bg-white/[0.03]">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.08]">
            <div className="text-sm font-medium">{current.name}</div>
            {sourceUrl ? (
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a href={sourceUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open
                </a>
              </Button>
            ) : null}
          </div>
          <div className="max-h-[calc(72vh-56px)] overflow-auto p-4">
            {isImageAttachment(current) && sourceUrl ? (
              <img
                src={sourceUrl}
                alt={current.name}
                className="mx-auto max-h-[60vh] rounded-[16px] object-contain shadow-[0_20px_48px_-36px_rgba(15,23,42,0.28)]"
              />
            ) : isPdfAttachment(current) && sourceUrl ? (
              <iframe
                title={current.name}
                src={sourceUrl}
                className="h-[60vh] w-full rounded-[16px] border border-black/[0.08] bg-white dark:border-white/[0.08]"
              />
            ) : isTextLikeAttachment(current) ? (
              loadingText ? (
                <div className="text-sm text-muted-foreground">Loading preview…</div>
              ) : textError ? (
                <div className="text-sm text-rose-600 dark:text-rose-300">{textError}</div>
              ) : (
                <pre className="whitespace-pre-wrap break-words rounded-[16px] bg-black/[0.04] p-4 text-xs leading-6 text-foreground dark:bg-white/[0.04]">
                  {textPreview || 'Empty file.'}
                </pre>
              )
            ) : (
              <div className="space-y-3 text-sm text-muted-foreground">
                <div>No inline preview is available for this file type.</div>
                {current.error ? <div className="text-rose-600 dark:text-rose-300">{current.error}</div> : null}
                {current.questRelativePath || current.path || current.extractedTextPath ? (
                  <div className="rounded-[16px] bg-black/[0.04] p-4 text-xs leading-6 text-foreground dark:bg-white/[0.04]">
                    {current.questRelativePath || current.path || current.extractedTextPath}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default AttachmentPreviewModal
