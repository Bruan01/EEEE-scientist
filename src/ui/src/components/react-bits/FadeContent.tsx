'use client'

import * as React from 'react'
import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'

interface FadeContentProps {
  children: React.ReactNode
  blur?: boolean
  duration?: number
  delay?: number
  threshold?: number
  initialOpacity?: number
  y?: number
  once?: boolean
  onComplete?: () => void
  className?: string
  style?: React.CSSProperties
}

const FadeContent: React.FC<FadeContentProps> = ({
  children,
  blur = false,
  duration = 0.6,
  delay = 0,
  threshold = 0.1,
  initialOpacity = 0,
  y = 20,
  once = true,
  onComplete,
  className = '',
  style
}) => {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, {
    once,
    amount: threshold
  })
  const prefersReducedMotion = useReducedMotion()

  // Skip animation if user prefers reduced motion
  if (prefersReducedMotion) {
    return (
      <div ref={ref} className={className} style={style}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial={{
        opacity: initialOpacity,
        y: y,
        filter: blur ? 'blur(10px)' : 'blur(0px)'
      }}
      animate={isInView ? {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)'
      } : {
        opacity: initialOpacity,
        y: y,
        filter: blur ? 'blur(10px)' : 'blur(0px)'
      }}
      transition={{
        duration: duration,
        delay: delay,
        ease: [0.25, 0.1, 0.25, 1] // cubic-bezier for smooth easing
      }}
      onAnimationComplete={() => {
        if (isInView && onComplete) {
          onComplete()
        }
      }}
    >
      {children}
    </motion.div>
  )
}

export default FadeContent
