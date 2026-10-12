'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { Copy, Clipboard } from 'lucide-react'
import { cn } from '@/lib/utils'

export function TerminalContextMenu({
  onCopy,
  onPaste,
  children,
}: {
  onCopy: () => void
  onPaste: () => void
  children: ReactNode
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [adjustedPosition, setAdjustedPosition] = useState({ x: 0, y: 0 })

  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 2) return
    event.preventDefault()
    setPosition({ x: event.clientX, y: event.clientY })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open || !menuRef.current) {
      setAdjustedPosition(position)
      return
    }
    const rect = menuRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    let nextX = position.x
    let nextY = position.y
    if (nextX + rect.width > viewportWidth) {
      nextX = Math.max(8, viewportWidth - rect.width - 8)
    }
    if (nextY + rect.height > viewportHeight) {
      nextY = Math.max(8, viewportHeight - rect.height - 8)
    }
    setAdjustedPosition({ x: nextX, y: nextY })
  }, [open, position])

  const menuItems = useMemo(
    () => [
      {
        key: 'copy',
        label: 'Copy',
        icon: <Copy className="h-4 w-4" />,
        onClick: () => onCopy(),
      },
      {
        key: 'paste',
        label: 'Paste',
        icon: <Clipboard className="h-4 w-4" />,
        onClick: () => onPaste(),
      },
    ],
    [onCopy, onPaste]
  )

  return (
    <div onContextMenu={handleContextMenu} className="relative flex flex-1 min-h-0">
      {children}
      {open ? (
        <div
          ref={menuRef}
          className={cn(
            'fixed z-50 w-40 overflow-hidden rounded-lg border border-white/40 bg-white/90 shadow-lg',
            'text-[11px] text-[var(--cli-ink-1)]'
          )}
          style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
        >
          {menuItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                item.onClick()
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left',
                'hover:bg-white/70'
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
