'use client'

import * as React from 'react'
import { FileText, Image as ImageIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { AttachmentPreviewModal, type AttachmentPreviewItem } from './AttachmentPreviewModal'

type QuestMessageAttachmentsProps = {
  attachments?: Array<Record<string, unknown>> | null
  className?: string
}

function attachmentName(item: Record<string, unknown>, index: number) {
  return String(
    item.name ||
      item.file_name ||
      item.label ||
      item.quest_relative_path ||
      item.path ||
      item.url ||
      `attachment-${index + 1}`
  ).trim()
}

function attachmentSubtitle(item: Record<string, unknown>) {
  const error = String(item.error || item.download_error || '').trim()
  if (error) return error
  return String(item.quest_relative_path || item.extracted_text_path || item.content_type || 'Attachment').trim()
}

function attachmentPreviewUrl(item: Record<string, unknown>) {
  const candidate = String(item.preview_url || item.asset_url || item.file_url || '').trim()
  return candidate || null
}

function isImageAttachment(item: Record<string, unknown>) {
  return String(item.content_type || item.mime_type || item.kind || '')
    .trim()
    .toLowerCase()
    .startsWith('image')
}

export function QuestMessageAttachments({
  attachments,
  className,
}: QuestMessageAttachmentsProps) {
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const [previewIndex, setPreviewIndex] = React.useState(0)
  const normalized = Array.isArray(attachments)
    ? attachments.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : []
  const visibleItems = normalized.slice(0, 2)
  const hiddenCount = Math.max(0, normalized.length - visibleItems.length)
  const previewItems = React.useMemo<AttachmentPreviewItem[]>(
    () =>
      normalized.map((item, index) => ({
        id: `${attachmentName(item, index)}-${index}`,
        name: attachmentName(item, index),
        contentType: String(item.content_type || item.mime_type || '').trim() || null,
        sizeBytes: typeof item.size_bytes === 'number' ? item.size_bytes : typeof item.size === 'number' ? item.size : null,
        status: String(item.status || '').trim() || null,
        previewUrl: attachmentPreviewUrl(item),
        assetUrl: String(item.asset_url || item.file_url || '').trim() || null,
        questRelativePath: String(item.quest_relative_path || '').trim() || null,
        path: String(item.path || '').trim() || null,
        extractedTextPath: String(item.extracted_text_path || '').trim() || null,
        kind: String(item.kind || '').trim() || null,
        error: String(item.error || item.download_error || '').trim() || null,
      })),
    [normalized]
  )

  if (!normalized.length) return null

  return (
    <>
    <div className={cn('mt-2 flex flex-wrap gap-2', className)}>
      {visibleItems.map((item, index) => {
        const name = attachmentName(item, index)
        const subtitle = attachmentSubtitle(item)
        const previewUrl = attachmentPreviewUrl(item)
        const isImage = isImageAttachment(item)
        const body = (
          <button
            type="button"
            onClick={() => {
              setPreviewIndex(index)
              setPreviewOpen(true)
            }}
            className="group flex h-11 min-w-0 max-w-[220px] items-center gap-2.5 overflow-hidden rounded-full border border-black/[0.06] bg-black/[0.03] px-2.5 py-1.5 text-left transition hover:bg-black/[0.045] dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.06]"
          >
            <div className="shrink-0">
              {isImage && previewUrl ? (
                <img
                  src={previewUrl}
                  alt={name}
                  className="h-8 w-8 rounded-[10px] object-cover ring-1 ring-black/6 dark:ring-white/10"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-black/[0.04] text-muted-foreground dark:bg-white/[0.06]">
                  {isImage ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium leading-4">{name}</div>
              <div className="mt-0.5 truncate text-[10px] leading-4 text-muted-foreground">
                {isImage ? 'Image' : subtitle}
              </div>
            </div>
          </button>
        )
        return <div key={`${name}-${index}`}>{body}</div>
      })}
      {hiddenCount > 0 ? (
        <button
          type="button"
          className="inline-flex h-11 items-center rounded-full border border-black/[0.08] bg-white/78 px-3 text-[12px] font-medium text-foreground transition hover:bg-black/[0.03] dark:border-white/[0.10] dark:bg-white/[0.06] dark:hover:bg-white/[0.08]"
          onClick={() => {
            setPreviewIndex(visibleItems.length)
            setPreviewOpen(true)
          }}
        >
          +{hiddenCount} more
        </button>
      ) : null}
    </div>
    <AttachmentPreviewModal
      open={previewOpen}
      onClose={() => setPreviewOpen(false)}
      items={previewItems}
      initialIndex={previewIndex}
    />
    </>
  )
}

export default QuestMessageAttachments
