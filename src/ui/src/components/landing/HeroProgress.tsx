'use client'

import { cn } from '@/lib/utils'
import type { Locale } from '@/types'
import { getHeroBundle } from './hero-content'
import { PngIcon } from '@/components/ui/png-icon'
import { ArrowRight } from 'lucide-react'

type HeroProgressProps = {
  progress: number
  stageIndex: number
  locale: Locale
  className?: string
}

export default function HeroProgress({ progress, stageIndex, locale, className }: HeroProgressProps) {
  const hero = getHeroBundle(locale)
  return (
    <div className={cn('pointer-events-none', className)}>
      <div className="mx-auto w-full max-w-[90vw] px-6 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4 items-center gap-2 text-[10px] text-[#6F6B66] sm:text-[11px]">
          {hero.stages.map((stage, index) => (
            <div key={stage.key} className="flex min-w-0 items-center justify-center gap-2 sm:justify-start">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full transition-colors',
                  index <= stageIndex ? 'bg-[#9FB1C2]' : 'bg-[#D7C6AE]/60'
                )}
              />
              <span
                className={cn(
                  'hidden min-w-0 truncate sm:inline',
                  index === stageIndex ? 'text-[#2D2A26]' : undefined
                )}
              >
                {stage.title}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-[#D7C6AE]/40">
          <div
            className="h-full bg-[#9FB1C2] transition-[width] duration-200"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <div className="mt-2 hidden items-center gap-2 text-[11px] text-[#7E8B97] sm:flex">
          <PngIcon
            name="ArrowRight"
            size={12}
            className="h-3 w-3 opacity-70"
            fallback={<ArrowRight className="h-3 w-3" />}
          />
          {locale === 'zh' ? '滚动继续探索' : 'Scroll to explore'}
        </div>
      </div>
    </div>
  )
}
