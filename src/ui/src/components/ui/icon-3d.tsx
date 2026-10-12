'use client'

import * as React from 'react'
import { assetUrl } from '@/lib/assets'
import { cn } from '@/lib/utils'

export type Icon3DName =
  | 'folder-plus'
  | 'folder'
  | 'folder-open'
  | 'search-empty'
  | 'sparkle'
  | 'robot'
  | 'trash'
  | 'pencil'
  | 'team'
  | 'link'
  | 'upload'
  | 'document-new'
  | 'template-blank'
  | 'template-book'
  | 'template-flask'
  | 'template-chart'
  | 'template-brain'
  | 'template-bulb'

export type Icon3DSize = 'sm' | 'md' | 'lg' | 'xl'

const sizeMap: Record<Icon3DSize, { width: number; height: number; className: string }> = {
  sm: { width: 32, height: 32, className: 'w-8 h-8' },
  md: { width: 48, height: 48, className: 'w-12 h-12' },
  lg: { width: 64, height: 64, className: 'w-16 h-16' },
  xl: { width: 80, height: 80, className: 'w-20 h-20' },
}

interface Icon3DProps {
  name: Icon3DName
  size?: Icon3DSize | number
  className?: string
  alt?: string
}

export function Icon3D({ name, size = 'md', className, alt }: Icon3DProps) {
  const isNumericSize = typeof size === 'number' && Number.isFinite(size)
  const resolved =
    !isNumericSize && typeof size === 'string' && size in sizeMap
      ? sizeMap[size as Icon3DSize]
      : sizeMap.md

  const width = isNumericSize ? size : resolved.width
  const height = isNumericSize ? size : resolved.height
  const sizeClass = isNumericSize ? '' : resolved.className
  const src = assetUrl(`icons/3d/${name}.png`)

  return (
    <img
      src={src}
      alt={alt || name}
      width={width}
      height={height}
      className={cn(sizeClass, 'object-contain', className)}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  )
}

export default Icon3D
