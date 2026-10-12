'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const COLORS = ['#6B6D94', '#9B8FB8', '#B8D4C2', '#F4D7D1', '#CC9F6D']

export function ConfettiBurst({
  active,
  className,
  count = 18,
  onComplete,
}: {
  active: boolean
  className?: string
  count?: number
  onComplete?: () => void
}) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, index) => ({
        id: index,
        angle: (360 / count) * index,
        distance: 60 + Math.random() * 40,
        color: COLORS[index % COLORS.length],
      })),
    [count]
  )

  if (!active) return null

  return (
    <div className={cn('pointer-events-none absolute inset-0 flex items-center justify-center', className)}>
      {pieces.map((piece) => (
        <motion.span
          key={piece.id}
          className="absolute h-2 w-2 rounded-sm"
          style={{ backgroundColor: piece.color }}
          initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1, 0.8],
            x: Math.cos((piece.angle * Math.PI) / 180) * piece.distance,
            y: Math.sin((piece.angle * Math.PI) / 180) * piece.distance,
          }}
          transition={{ duration: 1, ease: 'easeOut' }}
          onAnimationComplete={piece.id === pieces.length - 1 ? onComplete : undefined}
        />
      ))}
    </div>
  )
}
