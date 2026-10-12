'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type DsToolAccent = 'blue' | 'sage' | 'violet' | 'amber' | 'rose'
type DsToolTone = 'default' | 'success' | 'warning' | 'danger' | 'muted'

const ACCENT_STYLES: Record<DsToolAccent, { frame: string; title: string; soft: string }> = {
  blue: {
    frame:
      'border-[rgba(121,145,182,0.22)] bg-[linear-gradient(180deg,rgba(237,243,250,0.96),rgba(255,255,255,0.98))]',
    title: 'text-[#6382ad]',
    soft: 'bg-[rgba(121,145,182,0.10)] text-[#58779f]',
  },
  sage: {
    frame:
      'border-[rgba(139,164,149,0.22)] bg-[linear-gradient(180deg,rgba(239,245,241,0.96),rgba(255,255,255,0.98))]',
    title: 'text-[#6e8a79]',
    soft: 'bg-[rgba(139,164,149,0.10)] text-[#66816f]',
  },
  violet: {
    frame:
      'border-[rgba(146,138,172,0.22)] bg-[linear-gradient(180deg,rgba(242,240,247,0.96),rgba(255,255,255,0.98))]',
    title: 'text-[#7a7297]',
    soft: 'bg-[rgba(146,138,172,0.10)] text-[#72698f]',
  },
  amber: {
    frame:
      'border-[rgba(189,164,120,0.22)] bg-[linear-gradient(180deg,rgba(248,243,233,0.96),rgba(255,255,255,0.98))]',
    title: 'text-[#977a42]',
    soft: 'bg-[rgba(189,164,120,0.12)] text-[#8c7240]',
  },
  rose: {
    frame:
      'border-[rgba(176,136,136,0.22)] bg-[linear-gradient(180deg,rgba(247,240,240,0.96),rgba(255,255,255,0.98))]',
    title: 'text-[#976b6b]',
    soft: 'bg-[rgba(176,136,136,0.12)] text-[#8a6262]',
  },
}

const TONE_STYLES: Record<DsToolTone, string> = {
  default: 'bg-[rgba(99,130,173,0.10)] text-[#5d79a0]',
  success: 'bg-[rgba(110,138,121,0.12)] text-[#5f7a68]',
  warning: 'bg-[rgba(189,164,120,0.14)] text-[#8f733d]',
  danger: 'bg-[rgba(176,136,136,0.14)] text-[#8a5f5f]',
  muted: 'bg-[rgba(117,118,125,0.10)] text-[var(--text-tertiary)]',
}

export function DsToolFrame({
  title,
  subtitle,
  accent = 'blue',
  badge,
  meta,
  footer,
  className,
  children,
}: {
  title: string
  subtitle?: string | null
  accent?: DsToolAccent
  badge?: ReactNode
  meta?: ReactNode
  footer?: ReactNode
  className?: string
  children: ReactNode
}) {
  const styles = ACCENT_STYLES[accent]

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[18px] border px-4 py-4 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.28)]',
        styles.frame,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className={cn('text-[13px] font-semibold tracking-[0.01em]', styles.title)}>{title}</div>
          {subtitle ? (
            <div className="mt-1 whitespace-pre-wrap text-[12px] leading-6 text-[var(--text-secondary)]">
              {subtitle}
            </div>
          ) : null}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      {meta ? <div className="mt-3 flex flex-wrap gap-2">{meta}</div> : null}
      <div className="mt-4 flex flex-col gap-3">{children}</div>
      {footer ? <div className="mt-4 border-t border-[var(--border-light)] pt-3">{footer}</div> : null}
    </div>
  )
}

export function DsToolPill({
  children,
  tone = 'default',
  className,
}: {
  children: ReactNode
  tone?: DsToolTone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium tracking-[0.02em]',
        TONE_STYLES[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

export function DsToolSection({
  title,
  children,
  compact = false,
}: {
  title: string
  children: ReactNode
  compact?: boolean
}) {
  return (
    <div className={cn('rounded-[14px] border border-[var(--border-light)] bg-[rgba(255,255,255,0.74)]', compact ? 'px-3 py-2.5' : 'px-3.5 py-3')}>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
        {title}
      </div>
      <div className="text-[12px] leading-6 text-[var(--text-primary)]">{children}</div>
    </div>
  )
}

