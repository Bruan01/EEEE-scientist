'use client'

import { useMemo } from 'react'
import { AlertTriangle, Globe } from 'lucide-react'
import { getApiBaseUrl } from '@/lib/api/client'
import type { ToolViewProps } from './types'

export function BrowserToolView({
  toolContent,
  panelMode,
}: ToolViewProps) {
  const showHeader = panelMode == null
  const title = useMemo(() => {
    const args = toolContent.args as Record<string, unknown>
    if (typeof args?.url === 'string') return args.url
    if (typeof toolContent.content?.current_url === 'string') return toolContent.content.current_url
    return 'Browser'
  }, [toolContent])
  const targetUrl = useMemo(() => {
    const args = toolContent.args as Record<string, unknown>
    if (typeof args?.url === 'string' && args.url.trim()) return args.url.trim()
    if (typeof toolContent.content?.current_url === 'string' && toolContent.content.current_url.trim()) {
      return toolContent.content.current_url.trim()
    }
    if (typeof toolContent.content?.url === 'string' && toolContent.content.url.trim()) {
      return toolContent.content.url.trim()
    }
    return ''
  }, [toolContent])
  const normalizedUrl = useMemo(() => {
    if (!targetUrl) return ''
    if (/^https?:\/\//i.test(targetUrl)) return targetUrl
    return `https://${targetUrl}`
  }, [targetUrl])
  const previewUrl = useMemo(() => {
    if (!normalizedUrl) return ''
    const base = getApiBaseUrl()
    return `${base}/api/v1/web/preview?url=${encodeURIComponent(normalizedUrl)}`
  }, [normalizedUrl])
  const error = toolContent.content?.error as string | undefined
  const textContent = useMemo(() => {
    if (typeof toolContent.content?.text === 'string') return toolContent.content.text
    return ''
  }, [toolContent])
  const frameScale = 0.92
  const frameStyle = useMemo(
    () => ({
      transform: `scale(${frameScale})`,
      transformOrigin: 'top left',
      width: `${100 / frameScale}%`,
      height: `${140 / frameScale}%`,
    }),
    [frameScale]
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showHeader ? (
        <div className="flex h-[36px] items-center border-b border-[var(--border-main)] bg-[var(--background-gray-main)] px-3 shadow-[inset_0px_1px_0px_0px_#FFFFFF]">
          <div className="flex-1 truncate text-center text-xs font-medium text-[var(--text-tertiary)]">
            {title}
          </div>
        </div>
      ) : null}
      <div className="relative flex-1 overflow-hidden bg-[var(--fill-white)]">
        {error ? (
          <div className="ds-tool-error-banner" role="status">
            <AlertTriangle className="ds-tool-error-icon" />
            <span>{error}</span>
          </div>
        ) : null}
        {previewUrl ? (
          <div className="relative h-full w-full overflow-auto bg-[var(--background-white-main)]">
            <div className="relative min-h-full min-w-full">
              <div style={frameStyle}>
                <iframe
                  src={previewUrl}
                  title="Website preview"
                  className="h-full w-full border-0 pointer-events-none"
                  referrerPolicy="no-referrer"
                  sandbox="allow-same-origin"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        ) : textContent ? (
          <div className="flex h-full flex-col overflow-auto p-4">
            <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--text-primary)]">
              {textContent}
            </pre>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[var(--text-tertiary)]">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              No URL available.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default BrowserToolView
