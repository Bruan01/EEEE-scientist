import type { CSSProperties, ReactNode } from 'react'

type ShimmerProps = {
  children: ReactNode
  className?: string
  duration?: string
  color?: string
  angle?: string
  width?: string
}

export default function Shimmer({
  children,
  className = '',
  duration = '3s',
  color = 'rgba(255, 255, 255, 0.3)',
  angle = '45deg',
  width = '30%',
}: ShimmerProps) {
  return (
    <div
      className={`shimmer-container ${className}`.trim()}
      style={
        {
          ['--shimmer-duration' as string]: duration,
          ['--shimmer-color' as string]: color,
          ['--shimmer-angle' as string]: angle,
          ['--shimmer-width' as string]: width,
        } as CSSProperties
      }
    >
      {children}
      <div className="shimmer-effect" />
    </div>
  )
}
