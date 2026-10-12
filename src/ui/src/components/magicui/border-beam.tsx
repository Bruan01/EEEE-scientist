'use client'

import { cn } from '@/lib/utils'
import './magicui.css'

export function BorderBeam({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('relative rounded-2xl', className)}>
      <div className="magicui-border-beam" aria-hidden />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
