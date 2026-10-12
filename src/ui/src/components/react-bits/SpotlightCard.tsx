'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

export type SpotlightCardProps = React.HTMLAttributes<HTMLDivElement> & {
  asChild?: boolean
  /**
   * Spotlight color in rgba(). Keep it low-saturation for Morandi style.
   */
  spotlightColor?: `rgba(${number}, ${number}, ${number}, ${number})` | string
  /**
   * Enable spotlight only on hover-capable devices.
   */
  hoverOnly?: boolean
}

const SpotlightCard = React.forwardRef<HTMLElement, SpotlightCardProps>(function SpotlightCard(
  { asChild = false, spotlightColor = 'rgba(143, 163, 184, 0.18)', hoverOnly = true, className, style, onMouseMove, ...props },
  forwardedRef
) {
  const localRef = React.useRef<HTMLElement | null>(null)
  const rafRef = React.useRef<number | null>(null)
  const lastPoint = React.useRef<{ x: number; y: number } | null>(null)
  const [canHover, setCanHover] = React.useState(false)

  const setVars = React.useCallback((x: number, y: number) => {
    const node = localRef.current
    if (!node) return
    node.style.setProperty('--ds-spotlight-x', `${x}px`)
    node.style.setProperty('--ds-spotlight-y', `${y}px`)
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

  React.useEffect(() => {
    const node = localRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    setVars(Math.max(0, rect.width - 40), 46)
  }, [setVars])

  const handleMouseMove: React.MouseEventHandler<HTMLElement> = (e) => {
    if (!canHover) {
      onMouseMove?.(e as any)
      return
    }
    const node = localRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    lastPoint.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    if (rafRef.current) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      const p = lastPoint.current
      if (!p) return
      setVars(p.x, p.y)
    })
    onMouseMove?.(e as any)
  }

  React.useEffect(() => {
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const setRef = React.useCallback(
    (node: HTMLElement | null) => {
      localRef.current = node
      if (!forwardedRef) return
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else (forwardedRef as React.MutableRefObject<HTMLElement | null>).current = node
    },
    [forwardedRef]
  )

  const Comp: any = asChild ? Slot : 'div'

  return (
    <Comp
      ref={setRef}
      className={cn('ds-spotlight', className)}
      style={{
        ...(style as React.CSSProperties),
        // CSS variables used by .ds-spotlight styles.
        ['--ds-spotlight-color' as any]: spotlightColor,
      }}
      onMouseMove={handleMouseMove as any}
      {...props}
    />
  )
})

export default SpotlightCard

