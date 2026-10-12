'use client'

import type { CSSProperties, ElementType, ReactNode, ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import './StarBorder.css'

type StarBorderProps<T extends ElementType> = {
  as?: T
  className?: string
  color?: string
  speed?: string
  thickness?: number
  spread?: number
  children: ReactNode
  style?: CSSProperties
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'color' | 'children' | 'style'>

const StarBorder = <T extends ElementType = 'div'>({
  as,
  className = '',
  color = 'rgba(210, 190, 120, 0.85)',
  speed = '7s',
  thickness = 1,
  spread = 6,
  children,
  style,
  ...rest
}: StarBorderProps<T>) => {
  const Component = (as || 'div') as ElementType
  return (
    <Component
      className={cn('star-border-container', className)}
      style={
        {
          ['--star-border-color' as any]: color,
          ['--star-border-speed' as any]: speed,
          ['--star-border-thickness' as any]: `${thickness}px`,
          ['--star-border-spread' as any]: `${spread}px`,
          ...style,
        } as CSSProperties
      }
      {...rest}
    >
      <div className="border-gradient-bottom" aria-hidden="true" />
      <div className="border-gradient-top" aria-hidden="true" />
      <div className="inner-content">{children}</div>
    </Component>
  )
}

export default StarBorder
