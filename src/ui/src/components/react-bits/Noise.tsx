'use client'

import * as React from 'react'
import { assetUrl } from '@/lib/assets'
import { cn } from '@/lib/utils'

type NoiseProps = {
  className?: string
  /**
   * Background tile size in px.
   */
  size?: number
  /**
   * Whether to animate the noise (disabled automatically for reduced motion).
   */
  animated?: boolean
}

export default function Noise({
  className,
  size = 260,
  animated = true,
}: NoiseProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0',
        'opacity-[0.045] dark:opacity-[0.05]',
        animated && 'ds-noise-animate',
        className
      )}
      style={{
        backgroundImage: `url(${assetUrl('noise.svg')})`,
        backgroundSize: `${size}px ${size}px`,
      }}
    />
  )
}
