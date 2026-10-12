'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function AnimatedList<T>({
  items,
  renderItem,
  className,
  stagger = 0.04,
}: {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  stagger?: number
}) {
  return (
    <motion.div
      className={cn('flex flex-col gap-3', className)}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: stagger },
        },
      }}
    >
      {items.map((item, index) => (
        <motion.div
          key={(item as { id?: string })?.id ?? index}
          variants={{
            hidden: { opacity: 0, y: 12 },
            show: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.3 }}
        >
          {renderItem(item, index)}
        </motion.div>
      ))}
    </motion.div>
  )
}
