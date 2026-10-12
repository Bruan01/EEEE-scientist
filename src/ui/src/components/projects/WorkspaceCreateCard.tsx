'use client'

import { Plus } from 'lucide-react'

import { cn } from '@/lib/utils'

const MORANDI_GRADIENTS = [
  'from-[#d8cdc3] via-[#c4ccc7] to-[#b5becb]',
  'from-[#d7cbbf] via-[#cbc9be] to-[#b9c3cf]',
  'from-[#d1d5cc] via-[#bcc7c8] to-[#adb7c3]',
  'from-[#d8d0c8] via-[#c6c8d2] to-[#b1bac8]',
  'from-[#d5cabf] via-[#bec8c0] to-[#acbbc4]',
  'from-[#d4d1c5] via-[#c0c7c1] to-[#b3bec9]',
] as const

function gradientIndexFromSeed(seed: string) {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  return hash % MORANDI_GRADIENTS.length
}

function gradientFromSeed(seed: string) {
  return MORANDI_GRADIENTS[gradientIndexFromSeed(seed)]
}

interface WorkspaceCreateCardProps {
  onClick: () => void
  title: string
  subtitle: string
  seed: string
  ariaLabel: string
  dataAction?: string
  loading?: boolean
  loadingText?: string
  className?: string
}

export function WorkspaceCreateCard({
  onClick,
  title,
  subtitle,
  seed,
  ariaLabel,
  dataAction,
  loading = false,
  loadingText = 'Creating…',
  className,
}: WorkspaceCreateCardProps) {
  const gradientClass = gradientFromSeed(seed)

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label={ariaLabel}
      data-action={dataAction}
      className={cn(
        'group relative flex h-[138px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border p-4 text-foreground transition-all duration-200',
        'border-black/10 bg-gradient-to-br backdrop-blur-sm',
        'hover:border-black/20 hover:shadow-[0_16px_36px_-28px_rgba(0,0,0,0.35)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-70',
        'dark:border-black/12 dark:focus-visible:ring-black/20 dark:focus-visible:ring-offset-white',
        gradientClass,
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_2%,rgba(255,255,255,0.52),transparent_58%)]"
      />
      <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-black text-white shadow-sm">
        <Plus className="h-7 w-7" />
      </div>
      <div className="relative mt-3 text-sm font-semibold tracking-wide text-black/85 dark:text-black/85">
        {title}
      </div>
      <div className="relative mt-1 text-[11px] text-black/65 dark:text-black/65">{subtitle}</div>
      {loading ? <div className="relative mt-2 text-[10px] text-black/55 dark:text-black/55">{loadingText}</div> : null}
    </button>
  )
}

export default WorkspaceCreateCard
