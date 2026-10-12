'use client'

import { cn } from '@/lib/utils'
import './magicui.css'

export function AnimatedGridPattern({ className }: { className?: string }) {
  return <div className={cn('magicui-grid-pattern', className)} aria-hidden />
}
