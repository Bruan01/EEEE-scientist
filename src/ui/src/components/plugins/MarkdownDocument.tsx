import MarkdownRenderer from '@/lib/plugins/markdown-viewer/components/MarkdownRenderer'
import { MARKDOWN_VIEWER_STYLES } from '@/lib/plugins/markdown-viewer/markdownStyles'
import { getQuestMarkdownContextFromDocument } from '@/lib/markdown/quest-assets'
import { cn } from '@/lib/utils'

export function splitFrontmatter(content: string) {
  if (!content.startsWith('---\n')) {
    return { frontmatter: '', body: content }
  }
  const end = content.indexOf('\n---\n', 4)
  if (end < 0) {
    return { frontmatter: '', body: content }
  }
  return {
    frontmatter: content.slice(4, end).trim(),
    body: content.slice(end + 5),
  }
}

export function slugifyHeading(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[`*_~()[\]{}<>]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function MarkdownDocument({
  content,
  hideFrontmatter = false,
  containerClassName,
  frontmatterClassName,
  bodyClassName,
  questId,
  documentId,
}: {
  content: string
  hideFrontmatter?: boolean
  containerClassName?: string
  frontmatterClassName?: string
  bodyClassName?: string
  questId?: string
  documentId?: string
}) {
  const { frontmatter, body } = splitFrontmatter(content)
  const questContext = getQuestMarkdownContextFromDocument(
    questId && documentId
      ? {
          quest_id: questId,
          document_id: documentId,
        }
      : null
  )

  return (
    <div className={cn('flex h-full min-h-0 flex-col gap-4', containerClassName)}>
      <style dangerouslySetInnerHTML={{ __html: MARKDOWN_VIEWER_STYLES }} />
      {frontmatter && !hideFrontmatter ? (
        <div
          className={cn(
            'rounded-[24px] border border-black/10 bg-black/[0.03] px-4 py-3 dark:border-white/[0.12] dark:bg-white/[0.04]',
            frontmatterClassName
          )}
        >
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Front Matter</div>
          <pre className="overflow-auto whitespace-pre-wrap text-xs leading-6 text-muted-foreground">{frontmatter}</pre>
        </div>
      ) : null}
      <div
        className={cn(
          'markdown-body feed-scrollbar min-h-0 flex-1 overflow-auto rounded-[28px] bg-white/[0.60] px-5 py-4 dark:bg-white/[0.04]',
          bodyClassName
        )}
      >
        <MarkdownRenderer content={body || ''} questContext={questContext} />
      </div>
    </div>
  )
}
