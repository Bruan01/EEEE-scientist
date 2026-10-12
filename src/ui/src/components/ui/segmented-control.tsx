'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { motion, useReducedMotion } from 'framer-motion'

export interface SegmentedItem<T extends string> {
  value: T
  label: string
  icon?: React.ReactNode
  disabled?: boolean
}

interface SegmentedControlProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  items: SegmentedItem<T>[]
  size?: 'sm' | 'md'
  className?: string
  ariaLabel?: string
}

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  items,
  size = 'md',
  className,
  ariaLabel,
}: SegmentedControlProps<T>) {
  const prefersReducedMotion = useReducedMotion()
  const layoutId = React.useId()
  const sizeClasses =
    size === 'sm'
      ? {
          root: 'p-0.5 rounded-lg',
          item: 'px-2.5 py-1 text-xs rounded-md',
          icon: 'h-3.5 w-3.5',
        }
      : {
          root: 'p-1 rounded-lg',
          item: 'px-3 py-1.5 text-sm rounded-md',
          icon: 'h-4 w-4',
        }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex items-center gap-0.5 bg-muted border border-border',
        sizeClasses.root,
        className
      )}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
            className={cn(
              'relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap outline-none font-medium',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              active
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
              sizeClasses.item
            )}
          >
            {active ? (
              prefersReducedMotion ? (
                <div className="absolute inset-0 rounded-md bg-background shadow-sm" />
              ) : (
                <motion.div
                  layoutId={`segmented-indicator-${layoutId}`}
                  className="absolute inset-0 rounded-md bg-background shadow-sm"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )
            ) : null}
            {item.icon ? (
              <span className={cn('relative z-10 shrink-0', sizeClasses.icon)} aria-hidden>
                {item.icon}
              </span>
            ) : null}
            <span className="relative z-10 leading-none">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default SegmentedControl
