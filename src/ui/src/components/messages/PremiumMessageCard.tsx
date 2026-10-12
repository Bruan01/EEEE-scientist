'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ModalFooter } from '@/components/ui/modal'
import { ScrollArea } from '@/components/ui/scroll-area'
import dynamic from 'next/dynamic'
import { MARKDOWN_VIEWER_STYLES } from '@/lib/plugins/markdown-viewer/markdownStyles'
import styles from './PremiumMessageDialog.module.css'

const MarkdownRenderer = dynamic(
  () => import('@/lib/plugins/markdown-viewer/components/MarkdownRenderer'),
  {
    ssr: false,
    loading: () => (
      <div className="text-xs text-muted-foreground">Rendering…</div>
    ),
  }
)

export function PremiumMessageCard({
  title,
  imageUrl,
  level,
  content,
  loading,
  hasNext = false,
  step = 1,
  total = 1,
  onClose,
  onNext,
  onDontRemind,
}: {
  title: string
  imageUrl?: string
  level?: 'info' | 'warning' | 'error'
  content: string
  loading?: boolean
  hasNext?: boolean
  step?: number
  total?: number
  onClose?: () => void
  onNext?: () => void
  onDontRemind?: () => void
}) {
  const levelLabel = level === 'error' ? 'Important' : level === 'warning' ? 'Notice' : 'Update'

  const isMulti = total > 1
  const isLast = !hasNext

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: MARKDOWN_VIEWER_STYLES }} />

      <div className="relative flex min-h-0 flex-col gap-4">
        <div className="flex items-start justify-between gap-3 pr-8">
          <div className="min-w-0">
            <div className={`text-lg font-semibold truncate ${styles.title}`}>{title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={styles.levelBadge}>
                {levelLabel}
              </Badge>
              {total > 1 ? (
                <span className="text-xs text-black/60 dark:text-foreground/65 tabular-nums">
                  {Math.min(total, Math.max(1, step))}/{total}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className={`rounded-2xl p-4 flex-1 min-h-0 ${styles.contentPanel}`}>
          <ScrollArea className={`max-h-[58vh] pr-1 sm:max-h-[60vh] ${styles.content}`}>
            <div className="space-y-4">
              {imageUrl ? (
                <div className="overflow-hidden rounded-xl border border-black/10 bg-black/[0.02] dark:border-white/15 dark:bg-white/[0.04]">
                  <img
                    src={imageUrl}
                    alt={title || 'Premium message image'}
                    className="max-h-72 w-full object-contain"
                    loading="lazy"
                  />
                </div>
              ) : null}

              {loading ? (
                <div className="text-sm text-black/70 dark:text-foreground/70">Loading…</div>
              ) : (
                <div
                  className={styles.markdown}
                  style={{
                    ['--foreground' as any]: 'currentColor',
                    ['--border' as any]: 'rgba(127, 127, 127, 0.24)',
                    ['--muted' as any]: 'rgba(127, 127, 127, 0.12)',
                    ['--primary' as any]: '#1A1A1A',
                  }}
                >
                  <MarkdownRenderer content={content || ''} />
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <ModalFooter className={`-mx-6 -mb-4 mt-4 ${styles.footer}`}>
          <Button
            variant="secondary"
            className={styles.secondaryButton}
            onClick={onClose}
            disabled={loading || !onClose}
          >
            Close
          </Button>
          {hasNext ? (
            <Button
              variant="secondary"
              className={styles.primaryButton}
              onClick={onNext}
              disabled={loading || !onNext}
            >
              Next
            </Button>
          ) : null}
          {!isMulti || isLast ? (
            <Button
              variant="outline"
              className={styles.outlineButton}
              onClick={onDontRemind}
              disabled={loading || !onDontRemind}
            >
              Do not remind me
            </Button>
          ) : null}
        </ModalFooter>
      </div>
    </>
  )
}
