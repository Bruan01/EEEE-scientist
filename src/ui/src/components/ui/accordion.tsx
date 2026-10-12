'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type AccordionItem = {
  id: string
  title: string
  content: React.ReactNode
}

export function Accordion({
  items,
  className,
  defaultOpenId,
}: {
  items: AccordionItem[]
  className?: string
  defaultOpenId?: string | null
}) {
  const [openItem, setOpenItem] = React.useState<string | null>(
    typeof defaultOpenId !== 'undefined' ? defaultOpenId : items[0]?.id ?? null
  )

  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item) => {
        const isOpen = item.id === openItem
        return (
          <div key={item.id} className="rounded-xl border border-white/40 bg-white/70">
            <button
              type="button"
              onClick={() => setOpenItem(isOpen ? null : item.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-[#2E2A25]"
            >
              {item.title}
              <ChevronDown className={cn('h-4 w-4 transition', isOpen ? 'rotate-180' : '')} />
            </button>
            {isOpen ? <div className="px-4 pb-4 text-sm text-[#4B4741]">{item.content}</div> : null}
          </div>
        )
      })}
    </div>
  )
}
