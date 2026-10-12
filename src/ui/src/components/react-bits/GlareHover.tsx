'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

type GlareHoverProps = {
  children: React.ReactNode
  className?: string
  /**
   * Strength of the glare (0-1). Recommended: 0.25–0.45 for subtle “ink flash”.
   */
  strength?: number
  /**
   * Radius of the glare gradient in px.
   */
  radius?: number
  /**
   * Enable glare only on hover-capable devices.
   */
  hoverOnly?: boolean
}

export default function GlareHover({
  children,
  className,
  strength = 0.35,
  radius = 220,
  hoverOnly = true,
}: GlareHoverProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const rafRef = React.useRef<number | null>(null)
  const lastPoint = React.useRef<{ x: number; y: number } | null>(null)
  const [canHover, setCanHover] = React.useState(false)

  const setVars = React.useCallback((x: number, y: number) => {
    const node = ref.current
    if (!node) return
    node.style.setProperty('--ds-glare-x', `${x}px`)
    node.style.setProperty('--ds-glare-y', `${y}px`)
  }, [])

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      const node = ref.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      lastPoint.current = { x, y }
      if (rafRef.current) return
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null
        const p = lastPoint.current
        if (!p) return
        setVars(p.x, p.y)
      })
    },
    [setVars]
  )

  const onPointerLeave = React.useCallback(() => {
    lastPoint.current = null
  }, [])

  React.useEffect(() => {
    if (!hoverOnly) {
      setCanHover(true)
      return
    }
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(hover: hover) and (pointer: fine)')
    const update = () => setCanHover(mql.matches)
    update()
    mql.addEventListener?.('change', update)
    return () => mql.removeEventListener?.('change', update)
  }, [hoverOnly])

  // Default glare origin: top-right, like a soft studio light.
  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    setVars(Math.max(0, rect.width - 40), 40)
  }, [setVars])

  const layerStyle: React.CSSProperties = {
    backgroundImage: `radial-gradient(circle ${radius}px at var(--ds-glare-x) var(--ds-glare-y), rgba(255,255,255,${strength}) 0%, rgba(255,255,255,0) 60%)`,
  }

  return (
    <div
      ref={ref}
      className={cn('group relative', className)}
      onPointerMove={canHover ? onPointerMove : undefined}
      onPointerLeave={canHover ? onPointerLeave : undefined}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300',
          'mix-blend-soft-light',
          'group-hover:opacity-100'
        )}
        style={layerStyle}
      />
      {children}
    </div>
  )
}
