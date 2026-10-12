import * as React from 'react'

import { cn } from '@/lib/utils'

const TOOLTIP_WIDTH = 224
const TOOLTIP_GAP = 8
const VIEWPORT_PADDING = 12

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function HintDot({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  const triggerRef = React.useRef<HTMLSpanElement | null>(null)
  const [tooltipStyle, setTooltipStyle] = React.useState<React.CSSProperties>({
    left: VIEWPORT_PADDING,
    top: VIEWPORT_PADDING,
    width: TOOLTIP_WIDTH,
  })

  const updateTooltipPosition = React.useCallback(() => {
    if (typeof window === 'undefined') return
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const width = Math.min(TOOLTIP_WIDTH, Math.max(160, window.innerWidth - VIEWPORT_PADDING * 2))
    const left = clamp(
      rect.left + rect.width / 2 - width / 2,
      VIEWPORT_PADDING,
      window.innerWidth - width - VIEWPORT_PADDING
    )
    const bottomTop = rect.bottom + TOOLTIP_GAP
    const top =
      bottomTop + 96 > window.innerHeight - VIEWPORT_PADDING && rect.top > 112
        ? rect.top - TOOLTIP_GAP
        : bottomTop
    setTooltipStyle({
      left,
      top,
      width,
      transform: top === bottomTop ? undefined : 'translateY(-100%)',
    })
  }, [])

  React.useEffect(() => {
    window.addEventListener('resize', updateTooltipPosition)
    window.addEventListener('scroll', updateTooltipPosition, true)
    return () => {
      window.removeEventListener('resize', updateTooltipPosition)
      window.removeEventListener('scroll', updateTooltipPosition, true)
    }
  }, [updateTooltipPosition])

  return (
    <span className={cn('group relative inline-flex', className)}>
      <span
        ref={triggerRef}
        tabIndex={0}
        aria-label={label}
        onFocus={updateTooltipPosition}
        onMouseEnter={updateTooltipPosition}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-black/[0.10] text-[10px] font-medium leading-none text-muted-foreground outline-none transition hover:border-black/[0.16] hover:text-foreground focus:border-black/[0.16] focus:text-foreground dark:border-white/[0.12] dark:hover:border-white/[0.18] dark:hover:text-white dark:focus:border-white/[0.18] dark:focus:text-white"
      >
        ?
      </span>
      <span
        style={tooltipStyle}
        className="pointer-events-none invisible fixed z-50 rounded-[18px] border border-black/[0.08] bg-[rgba(255,255,255,0.96)] px-3 py-2 text-[11px] font-normal leading-5 text-foreground opacity-0 shadow-[0_20px_40px_-28px_rgba(17,24,39,0.35)] transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 dark:border-white/[0.10] dark:bg-[rgba(24,27,32,0.96)] dark:text-white/88"
      >
        {label}
      </span>
    </span>
  )
}
