'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

type TabsContextValue = {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

export function Tabs({
  value,
  onValueChange,
  className,
  children,
}: {
  value: string
  onValueChange: (value: string) => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-white/40 bg-white/60 p-1',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function TabsTrigger({
  value,
  disabled,
  className,
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string
}) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) {
    throw new Error('TabsTrigger must be used within Tabs')
  }
  const isActive = ctx.value === value

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event)
    if (!event.defaultPrevented) {
      ctx.onValueChange(value)
    }
  }

  return (
    <button
      type="button"
      disabled={disabled}
      role="tab"
      aria-selected={isActive}
      onClick={handleClick}
      className={cn(
        'rounded-lg px-3 py-1 text-xs font-medium transition',
        isActive ? 'bg-white text-[#2E2A25] shadow-sm' : 'text-[#6A645D] hover:text-[#2E2A25]',
        disabled && 'cursor-not-allowed opacity-60',
        className
      )}
      data-state={isActive ? 'active' : 'inactive'}
      {...props}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  value,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  value: string
}) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) {
    throw new Error('TabsContent must be used within Tabs')
  }
  if (ctx.value !== value) return null
  return (
    <div className={className} {...props}>
      {children}
    </div>
  )
}
