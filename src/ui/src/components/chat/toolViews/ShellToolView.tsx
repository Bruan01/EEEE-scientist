'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { AlertTriangle } from 'lucide-react'
import { writeShellSession } from '@/lib/api/sessions'
import { EnhancedTerminal } from '@/lib/plugins/cli/components/EnhancedTerminal'
import { cn } from '@/lib/utils'
import type { ToolViewProps } from './types'
import '@/lib/plugins/cli/styles/terminal.css'

const CliToolTerminal = dynamic(
  () => import('@/components/cli-terminal').then((mod) => mod.CliToolTerminal),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-xs text-[var(--text-tertiary)]">
        Loading terminal...
      </div>
    ),
  }
)

type ConsoleEntry = { ps1?: string; command?: string; output?: string }

function formatConsole(consoleEntries: unknown): string {
  if (!consoleEntries) return ''
  if (typeof consoleEntries === 'string') return consoleEntries
  if (!Array.isArray(consoleEntries) || consoleEntries.length === 0) return ''
  return (consoleEntries as ConsoleEntry[])
    .map((entry) => {
      const prompt = entry.ps1 ? `${entry.ps1} ` : ''
      const command = entry.command ?? ''
      const output = entry.output ?? ''
      return `${prompt}${command}\n${output}`
    })
    .join('\n')
}

function getShellErrorMessage(error: unknown): string {
  const fallback = 'Sandbox is starting or unavailable. Retrying...'
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (typeof error !== 'object') return fallback

  const responseStatus = (error as { response?: { status?: number } }).response?.status
  if (responseStatus === 429) {
    return 'Too many requests. Retrying...'
  }

  const response = (error as { response?: { data?: { detail?: unknown } } }).response
  const detail = response?.data?.detail
  if (typeof detail === 'string') {
    const normalized = detail.toLowerCase()
    if (normalized.includes('docker_not_available')) {
      return 'Sandbox is unavailable (Docker not available).'
    }
    if (normalized.includes('sandbox_quota_exceeded')) {
      return 'Sandbox quota exceeded. Stop another sandbox session to continue.'
    }
    if (normalized.includes('sandbox_global_limit')) {
      return 'Sandbox capacity reached. Please retry shortly.'
    }
    if (normalized.includes('sandbox_starting')) {
      return 'Sandbox is starting. Retrying...'
    }
    if (
      normalized.includes('session id does not exist') ||
      normalized.includes('session_not_found') ||
      normalized.includes('session not found')
    ) {
      return 'Shell session not found. Run a shell command first.'
    }
    if (normalized.includes('process has ended')) {
      return 'Shell process ended. Run a new command to create a session.'
    }
    if (normalized.includes('timeout') || normalized.includes('timed out')) {
      return fallback
    }
    return detail
  }

  const message = (error as { message?: unknown }).message
  if (typeof message === 'string') {
    const normalized = message.toLowerCase()
    if (normalized.includes('timeout') || normalized.includes('timed out')) {
      return fallback
    }
    if (normalized.includes('connection refused') || normalized.includes('connect')) {
      return 'Sandbox service is unavailable. Retrying...'
    }
  }

  return fallback
}

function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const responseStatus = (error as { response?: { status?: number } }).response?.status
  if (responseStatus === 429) return true
  const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
  if (typeof detail === 'string' && detail.toLowerCase().includes('rate')) {
    return true
  }
  const message = (error as { message?: unknown }).message
  if (typeof message === 'string') {
    const normalized = message.toLowerCase()
    return normalized.includes('429') || normalized.includes('rate limit')
  }
  return false
}

type InputChunk = { input: string; pressEnter: boolean }

function splitInputPayload(data: string): InputChunk[] {
  if (!data) return []
  const chunks: InputChunk[] = []
  let buffer = ''
  for (let i = 0; i < data.length; i += 1) {
    const char = data[i]
    if (char === '\r') {
      if (data[i + 1] === '\n') {
        i += 1
      }
      chunks.push({ input: buffer, pressEnter: true })
      buffer = ''
      continue
    }
    if (char === '\n') {
      chunks.push({ input: buffer, pressEnter: true })
      buffer = ''
      continue
    }
    buffer += char
  }
  if (buffer) {
    chunks.push({ input: buffer, pressEnter: false })
  }
  return chunks
}

export function ShellToolView({
  sessionId,
  toolContent,
  live,
  projectId,
  executionTarget,
  cliServerId,
  readOnly,
  active,
  panelMode,
}: ToolViewProps) {
  const runtime =
    (toolContent.content?.runtime as string | undefined) ??
    (toolContent.content?.execution_target as string | undefined) ??
    executionTarget ??
    'sandbox'
  const isTerminalMode = panelMode === 'terminal'
  const shellSessionId = useMemo(() => {
    const args = toolContent.args as Record<string, unknown>
    if (typeof args?.id === 'string') return args.id
    if (typeof toolContent.content?.session_id === 'string') return toolContent.content.session_id
    if (typeof toolContent.content?.shell_session_id === 'string') return toolContent.content.shell_session_id
    return ''
  }, [toolContent])

  const useCliTerminal = Boolean(
    runtime === 'cli' && projectId && cliServerId && sessionId && active && isTerminalMode
  )
  const canInput = false

  const [output, setOutput] = useState('')
  const [shellError, setShellError] = useState<string | null>(null)
  const shellErrorMessage = shellError ?? ''
  const showShellError = shellErrorMessage.length > 0
  const outputRef = useRef('')
  const terminalWriteRef = useRef<(data: string, onComplete?: () => void) => void>(() => {})
  const terminalClearRef = useRef<() => void>(() => {})
  const terminalScrollRef = useRef<() => void>(() => {})
  const terminalSearchRef = useRef<(query: string) => boolean>(() => false)
  const terminalReadyRef = useRef(false)
  const pendingScrollRef = useRef<string | null>(null)
  const inputQueueRef = useRef<InputChunk[]>([])
  const inputActiveRef = useRef(false)
  const rateLimitRef = useRef({ until: 0, delay: 0 })

  const fallbackOutput = useMemo(() => {
    const consoleEntries = toolContent.content?.console
    const rawOutput = toolContent.content?.output as string | undefined
    const formattedConsole = formatConsole(consoleEntries)
    return formattedConsole || rawOutput || ''
  }, [toolContent])

  const scrollTarget = useMemo(() => {
    if (live) return null
    const args = toolContent.args as Record<string, unknown>
    if (typeof args?.command === 'string' && args.command.trim()) return args.command.trim()
    if (typeof args?.input === 'string' && args.input.trim()) return args.input.trim()
    return null
  }, [live, toolContent])

  useEffect(() => {
    pendingScrollRef.current = scrollTarget
  }, [scrollTarget, toolContent.tool_call_id])

  const handleRateLimit = useCallback(() => {
    const now = Date.now()
    const prevDelay = rateLimitRef.current.delay
    const nextDelay = Math.min(prevDelay ? prevDelay * 2 : 1500, 15000)
    rateLimitRef.current = { until: now + nextDelay, delay: nextDelay }
    setShellError('Too many requests. Retrying...')
  }, [])

  const applyOutput = useCallback(
    (next: string) => {
      if (!terminalReadyRef.current) {
        outputRef.current = next
        return
      }
      const prev = outputRef.current
      if (next === prev) return
      if (next.startsWith(prev)) {
        terminalWriteRef.current?.(next.slice(prev.length))
      } else {
        terminalClearRef.current?.()
        terminalWriteRef.current?.(next)
      }
      outputRef.current = next

      if (pendingScrollRef.current) {
        const found = terminalSearchRef.current?.(pendingScrollRef.current)
        if (found) {
          pendingScrollRef.current = null
        }
        return
      }

      if (active || live) {
        terminalScrollRef.current?.()
      }
    },
    [active, live]
  )

  const refreshOutput = useCallback(() => {
    setOutput(fallbackOutput)
    setShellError(null)
  }, [fallbackOutput])

  useEffect(() => {
    refreshOutput()
  }, [refreshOutput, toolContent.tool_call_id])

  useEffect(() => {
    applyOutput(output)
  }, [applyOutput, output])

  const flushInputQueue = useCallback(async () => {
    if (inputActiveRef.current) return
    if (!sessionId || !shellSessionId || readOnly) {
      inputQueueRef.current = []
      return
    }
    inputActiveRef.current = true
    while (inputQueueRef.current.length > 0) {
      const next = inputQueueRef.current.shift()
      if (!next) break
      const { input, pressEnter } = next
      if (!input && !pressEnter) continue
      try {
        const response = await writeShellSession(sessionId, shellSessionId, input, pressEnter)
        const formattedConsole = formatConsole(response.console)
        const nextOutput = formattedConsole || response.output
        if (nextOutput) {
          setOutput(nextOutput)
        }
        setShellError(null)
        rateLimitRef.current = { until: 0, delay: 0 }
      } catch (error) {
        if (isRateLimitError(error)) {
          handleRateLimit()
          continue
        }
        setShellError(getShellErrorMessage(error))
        console.error('[ShellToolView] Failed to write to shell', error)
      }
    }
    inputActiveRef.current = false
    refreshOutput()
  }, [handleRateLimit, readOnly, refreshOutput, sessionId, shellSessionId])

  const enqueueInput = useCallback(
    (input: string, pressEnter: boolean) => {
      if (!input && !pressEnter) return
      const queue = inputQueueRef.current
      const last = queue[queue.length - 1]
      if (last && !last.pressEnter && !pressEnter) {
        last.input += input
      } else {
        queue.push({ input, pressEnter })
      }
      void flushInputQueue()
    },
    [flushInputQueue]
  )

  const handleInput = useCallback(
    (data: string) => {
      const chunks = splitInputPayload(data)
      if (chunks.length === 0) return
      chunks.forEach((chunk) => enqueueInput(chunk.input, chunk.pressEnter))
    },
    [enqueueInput]
  )

  return (
    <div className={cn('flex h-full min-h-0 flex-col', isTerminalMode && 'ds-terminal-shell')}>
      {!isTerminalMode ? (
        <div className="flex h-[36px] items-center border-b border-[var(--border-main)] bg-[var(--background-gray-main)] px-3 shadow-[inset_0px_1px_0px_0px_#FFFFFF]">
          <div className="flex-1 truncate text-center text-xs font-medium text-[var(--text-tertiary)]">
            {shellSessionId || 'Shell'}
          </div>
        </div>
      ) : null}
      <div
        className={cn(
          'flex-1 overflow-auto bg-[var(--background-white-main)]',
          isTerminalMode && 'ds-terminal-shell-body'
        )}
      >
        {useCliTerminal ? (
          <div className={cn('relative h-full p-3', isTerminalMode && 'p-2')}>
            <CliToolTerminal
              projectId={projectId ?? ''}
              serverId={cliServerId ?? ''}
              chatSessionId={sessionId ?? ''}
              shellSessionId={shellSessionId || undefined}
              operationId={(toolContent.content as Record<string, unknown>)?.operation_id as string | undefined}
              readOnly={readOnly}
              showHeader={!isTerminalMode}
            />
            {showShellError ? (
              <div className="ds-tool-error-banner" role="status">
                <AlertTriangle className="ds-tool-error-icon" />
                <span>{shellErrorMessage}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <div className={cn('flex h-full min-h-0 flex-col p-3', isTerminalMode && 'p-2')}>
            <div className="relative flex min-h-0 flex-1">
              <div className="cli-root flex min-h-0 flex-1 flex-col">
                <EnhancedTerminal
                  onInput={canInput ? handleInput : () => {}}
                  onResize={() => {}}
                  searchOpen={false}
                  onSearchOpenChange={() => {}}
                  appearance="terminal"
                  autoFocus={canInput}
                  showHeader={!isTerminalMode}
                  onReady={({ write, clear, scrollToBottom, focus, search }) => {
                    terminalWriteRef.current = write
                    terminalClearRef.current = clear
                    terminalScrollRef.current = scrollToBottom
                    terminalSearchRef.current = search
                    terminalReadyRef.current = true
                    applyOutput(outputRef.current)
                    if (canInput) focus()
                  }}
                />
              </div>
              {showShellError ? (
                <div className="ds-tool-error-banner" role="status">
                  <AlertTriangle className="ds-tool-error-icon" />
                  <span>{shellErrorMessage}</span>
                </div>
              ) : null}
            </div>
            {!canInput ? (
              <div className="mt-2 text-xs text-[var(--text-tertiary)]">
                {readOnly
                  ? 'View only. Input is disabled.'
                  : !sessionId
                    ? 'Start a task to run shell commands.'
                    : !isTerminalMode
                      ? 'Switch to terminal view to enter commands.'
                      : runtime === 'cli'
                        ? 'Connect a CLI server to enable terminal input.'
                        : 'Sandbox shell output is view-only. Run a shell tool to execute commands.'}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

export default ShellToolView
