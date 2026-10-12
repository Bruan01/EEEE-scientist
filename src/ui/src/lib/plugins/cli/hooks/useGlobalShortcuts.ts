'use client'

import { useEffect } from 'react'

export function useGlobalShortcuts(actions: {
  onSearch?: () => void
  onClear?: () => void
  onNewSession?: () => void
  onCloseSession?: () => void
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && key === 'f') {
        event.preventDefault()
        actions.onSearch?.()
      }
      if ((event.ctrlKey || event.metaKey) && key === 'l') {
        event.preventDefault()
        actions.onClear?.()
      }
      if (event.ctrlKey && event.shiftKey && key === 't') {
        event.preventDefault()
        actions.onNewSession?.()
      }
      if (event.ctrlKey && event.shiftKey && key === 'w') {
        event.preventDefault()
        actions.onCloseSession?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [actions])
}
