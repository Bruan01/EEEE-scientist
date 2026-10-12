'use client'

import { useEffect, useRef, useState } from 'react'
import { getVncUrl } from '@/lib/api/sessions'

// @ts-expect-error noVNC has no bundled types
import RFB from '@novnc/novnc/lib/rfb'

export function VNCViewer({
  sessionId,
  enabled = false,
  viewOnly = true,
  onConnected,
  onDisconnected,
  onCredentialsRequired,
}: {
  sessionId: string
  enabled?: boolean
  viewOnly?: boolean
  onConnected?: () => void
  onDisconnected?: (reason?: unknown) => void
  onCredentialsRequired?: () => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rfbRef = useRef<any>(null)
  const [insecureContext, setInsecureContext] = useState(false)

  useEffect(() => {
    let active = true

    const connect = async () => {
      if (!enabled || !containerRef.current) return
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setInsecureContext(true)
        onDisconnected?.('insecure_context')
        return
      }
      setInsecureContext(false)
      if (rfbRef.current) {
        rfbRef.current.disconnect()
        rfbRef.current = null
      }

      try {
        const wsUrl = await getVncUrl(sessionId)
        if (!active || !containerRef.current) return
        const rfb = new RFB(containerRef.current, wsUrl, {
          credentials: { password: '' },
          shared: true,
          repeaterID: '',
        })
        rfb.viewOnly = viewOnly
        rfb.scaleViewport = true

        rfb.addEventListener('connect', () => onConnected?.())
        rfb.addEventListener('disconnect', (event: unknown) => onDisconnected?.(event))
        rfb.addEventListener('credentialsrequired', () => onCredentialsRequired?.())
        rfbRef.current = rfb
      } catch (error) {
        onDisconnected?.(error)
      }
    }

    if (enabled) {
      void connect()
    }

    return () => {
      active = false
      if (rfbRef.current) {
        rfbRef.current.disconnect()
        rfbRef.current = null
      }
    }
  }, [enabled, onConnected, onCredentialsRequired, onDisconnected, sessionId, viewOnly])

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full overflow-auto bg-[#282828]"
    >
      {insecureContext ? (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-white/70">
          Secure context required for live browser preview.
        </div>
      ) : null}
    </div>
  )
}

export default VNCViewer
