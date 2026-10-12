'use client'

import { useReducedMotion } from 'framer-motion'
import GradientText from '@/components/effects/GradientText'

export function AnimatedGradientText({
  children,
  className,
  colors = ['#6B6D94', '#9B8FB8', '#FFF5DF'],
}: {
  children: React.ReactNode
  className?: string
  colors?: string[]
}) {
  const prefersReducedMotion = useReducedMotion()
  return (
    <GradientText
      className={className}
      colors={colors}
      animationSpeed={prefersReducedMotion ? 0 : 6}
      showBorder={false}
    >
      {children}
    </GradientText>
  )
}
