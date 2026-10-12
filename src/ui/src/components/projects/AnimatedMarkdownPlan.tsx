import * as React from 'react'
import { useReducedMotion } from 'framer-motion'

import MarkdownRenderer from '@/lib/plugins/markdown-viewer/components/MarkdownRenderer'
import { cn } from '@/lib/utils'

type AnimatedMarkdownPlanProps = {
  content: string
  animateKey?: string | number | null
  className?: string
  markdownClassName?: string
  lineDelayMs?: number
  initialDelayMs?: number
  maxAnimatedLines?: number
  onComplete?: () => void
}

function splitMarkdownLines(content: string) {
  return String(content || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
}

const completedAnimationKeys = new Set<string>()

export function AnimatedMarkdownPlan({
  content,
  animateKey = null,
  className,
  markdownClassName,
  lineDelayMs = 90,
  initialDelayMs = 120,
  maxAnimatedLines = 24,
  onComplete,
}: AnimatedMarkdownPlanProps) {
  const shouldReduceMotion = useReducedMotion()
  const lines = React.useMemo(() => splitMarkdownLines(content), [content])
  const safeAnimateKey = `${animateKey ?? ''}:${content.length}:${content.slice(0, 96)}`
  const alreadyCompleted = completedAnimationKeys.has(safeAnimateKey)
  const [visibleLineCount, setVisibleLineCount] = React.useState(() =>
    shouldReduceMotion || alreadyCompleted ? lines.length : Math.min(lines.length, 1)
  )

  React.useEffect(() => {
    if (alreadyCompleted || shouldReduceMotion || lines.length === 0) {
      setVisibleLineCount(lines.length)
      if (!alreadyCompleted && lines.length > 0) {
        completedAnimationKeys.add(safeAnimateKey)
        window.setTimeout(() => onComplete?.(), 0)
      }
      return
    }

    let cancelled = false
    const animatedLimit = Math.min(lines.length, maxAnimatedLines)
    setVisibleLineCount(Math.min(lines.length, 1))

    const startTimer = window.setTimeout(() => {
      let nextCount = Math.min(lines.length, 1)
      const timer = window.setInterval(() => {
        if (cancelled) return
        nextCount += 1
        if (nextCount >= animatedLimit) {
          completedAnimationKeys.add(safeAnimateKey)
          setVisibleLineCount(lines.length)
          window.setTimeout(() => onComplete?.(), 80)
          window.clearInterval(timer)
          return
        }
        setVisibleLineCount(nextCount)
      }, lineDelayMs)
    }, initialDelayMs)

    return () => {
      cancelled = true
      window.clearTimeout(startTimer)
    }
  }, [alreadyCompleted, initialDelayMs, lineDelayMs, lines.length, maxAnimatedLines, onComplete, safeAnimateKey, shouldReduceMotion])

  const visibleMarkdown = React.useMemo(
    () => lines.slice(0, visibleLineCount).join('\n'),
    [lines, visibleLineCount]
  )
  const isAnimating = visibleLineCount < lines.length

  return (
    <div className={cn('relative', className)}>
      <MarkdownRenderer
        content={visibleMarkdown}
        className={cn(
          'prose prose-sm max-w-none break-words text-[rgba(56,52,47,0.9)] [&_.md-h1]:mb-3 [&_.md-h1]:text-xl [&_.md-h1]:font-semibold [&_.md-h1]:tracking-[-0.03em] [&_.md-h2]:mb-2 [&_.md-h2]:mt-4 [&_.md-h2]:text-base [&_.md-h2]:font-semibold [&_.md-h3]:mb-2 [&_.md-h3]:mt-3 [&_.md-h3]:text-sm [&_.md-h3]:font-semibold [&_.md-p]:my-2 [&_.md-p]:whitespace-normal [&_.md-ul]:my-2 [&_.md-ol]:my-2 [&_.md-li]:my-1 [&_.md-table]:my-3 [&_.md-table]:w-full [&_.md-table]:overflow-x-auto [&_.md-table]:rounded-xl [&_.md-table]:border [&_.md-table]:border-[rgba(45,42,38,0.08)] [&_.md-code]:break-all [&_.md-a]:break-all [&_.md-td]:border [&_.md-td]:border-[rgba(45,42,38,0.08)] [&_.md-td]:px-2.5 [&_.md-td]:py-2 [&_.md-th]:bg-white/60 [&_.md-th]:font-semibold',
          !shouldReduceMotion && 'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300',
          markdownClassName
        )}
      />
      {isAnimating ? (
        <span className="ml-0.5 inline-flex h-4 w-2 translate-y-0.5 animate-pulse rounded-full bg-[rgba(45,42,38,0.72)]" aria-hidden="true" />
      ) : null}
    </div>
  )
}

export default AnimatedMarkdownPlan
