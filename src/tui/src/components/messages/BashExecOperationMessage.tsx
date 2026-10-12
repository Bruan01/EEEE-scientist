import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Text } from 'ink'
import stringWidth from 'string-width'
import { client } from '../../lib/api.js'
import { theme } from '../../semantic-colors.js'
import type { BashLogEntry, BashProgress, BashSessionStatus } from '../../types.js'

const BULLET_PREFIX = '• '
const LOG_PREFIX = ' | '
const MAX_VISIBLE_LOG_LINES = 18
const BASH_CARRIAGE_RETURN_PREFIX = '__DS_BASH_CR__'
const BASH_PROGRESS_PREFIX = '__DS_PROGRESS__'
const BASH_STATUS_MARKER_PREFIX = '__DS_BASH_STATUS__'
const EMPTY_RESULT_PAYLOAD: Record<string, unknown> = Object.freeze({})

type BashExecOperationMessageProps = {
  label: 'tool_call' | 'tool_result'
  content: string
  toolName?: string
  toolCallId?: string
  status?: string
  args?: string
  output?: string
  mcpServer?: string
  mcpTool?: string
  metadata?: Record<string, unknown>
  width?: number
  baseUrl: string
  questId?: string | null
  live?: boolean
}

const stripAnsi = (value: string) =>
  value.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '').replace(/\u001b[@-_]/g, '')

const parseJsonRecord = (value?: string) => {
  const text = String(value || '').trim()
  if (!text.startsWith('{') || !text.endsWith('}')) {
    return null
  }
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

const isBashExecOperation = ({
  toolName,
  mcpServer,
  mcpTool,
}: {
  toolName?: string
  mcpServer?: string
  mcpTool?: string
}) => {
  const normalizedTool = String(toolName || '').trim().toLowerCase()
  return (
    String(mcpServer || '').trim().toLowerCase() === 'bash_exec' ||
    String(mcpTool || '').trim().toLowerCase() === 'bash_exec' ||
    normalizedTool === 'bash_exec' ||
    normalizedTool === 'bash_exec.bash_exec' ||
    normalizedTool.includes('bash_exec')
  )
}

const decodeReason = (value?: string | null) =>
  String(value || '')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .trim()

const parseStatusMarker = (line: string) => {
  if (!line.startsWith(BASH_STATUS_MARKER_PREFIX)) {
    return null
  }
  const status = line.match(/\bstatus=([^\s]+)/)?.[1] || ''
  const exitCodeRaw = line.match(/\bexit_code=([^\s]+)/)?.[1] || ''
  const reasonRaw = line.match(/\breason=\"((?:\\.|[^\"])*)\"/)?.[1] || ''
  const exitCode =
    exitCodeRaw && exitCodeRaw !== 'none' && Number.isFinite(Number(exitCodeRaw))
      ? Number(exitCodeRaw)
      : null
  return {
    status: (status || 'running') as BashSessionStatus,
    exitCode,
    reason: decodeReason(reasonRaw),
  }
}

const parseProgressMarker = (line: string) => {
  if (!line.startsWith(BASH_PROGRESS_PREFIX)) {
    return null
  }
  try {
    const payload = JSON.parse(line.slice(BASH_PROGRESS_PREFIX.length).trim())
    return payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as BashProgress)
      : null
  } catch {
    return null
  }
}

const normalizeWorkdir = (value?: string | null) => {
  const text = String(value || '').trim()
  if (!text || text === '.') {
    return '~'
  }
  return text.replace(/^\.\//, '')
}

const getProgressPercent = (progress?: BashProgress | null) => {
  if (!progress || typeof progress !== 'object') {
    return null
  }
  if (typeof progress.percent === 'number' && Number.isFinite(progress.percent)) {
    return Math.max(0, Math.min(progress.percent, 100))
  }
  if (
    typeof progress.current === 'number' &&
    typeof progress.total === 'number' &&
    Number.isFinite(progress.current) &&
    Number.isFinite(progress.total) &&
    progress.total > 0
  ) {
    return Math.max(0, Math.min((progress.current / progress.total) * 100, 100))
  }
  return null
}

const formatCountdown = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null
  }
  const totalSeconds = Math.round(value)
  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }
  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}m ${seconds}s`
  }
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

const formatNextAt = (value?: string | null) => {
  const text = String(value || '').trim()
  if (!text) {
    return null
  }
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const formatProgress = (progress?: BashProgress | null) => {
  if (!progress || typeof progress !== 'object') {
    return null
  }
  const parts: string[] = []
  const label =
    typeof progress.label === 'string'
      ? progress.label.trim()
      : typeof progress.phase === 'string'
        ? progress.phase.trim()
        : typeof progress.status === 'string'
          ? progress.status.trim()
          : ''
  const percent = getProgressPercent(progress)
  if (label) {
    parts.push(label)
  }
  if (percent != null) {
    parts.push(`${percent.toFixed(0)}%`)
  }
  if (
    typeof progress.current === 'number' &&
    typeof progress.total === 'number' &&
    Number.isFinite(progress.current) &&
    Number.isFinite(progress.total)
  ) {
    parts.push(`${progress.current}/${progress.total}`)
  }
  if (typeof progress.detail === 'string' && progress.detail.trim()) {
    parts.push(progress.detail.trim())
  }
  const nextUpdate = formatCountdown(progress.next_reply_in ?? progress.next_check_in ?? progress.eta)
  if (nextUpdate) {
    parts.push(`next update in ${nextUpdate}`)
  }
  const nextAt = formatNextAt(progress.next_reply_at ?? progress.next_check_at)
  if (nextAt) {
    parts.push(`next ${nextAt}`)
  }
  return parts.filter(Boolean).join(' · ') || null
}

const wrapPrefixedLine = (text: string, width: number, prefix = LOG_PREFIX) => {
  const sanitized = stripAnsi(text.replace(/\t/g, '    '))
  const available = Math.max(1, width - stringWidth(prefix))
  if (!sanitized) {
    return [prefix]
  }
  const lines: string[] = []
  let current = ''
  let currentWidth = 0
  for (const char of Array.from(sanitized)) {
    const charWidth = Math.max(1, stringWidth(char))
    if (currentWidth + charWidth > available && current) {
      lines.push(`${prefix}${current}`)
      current = char
      currentWidth = charWidth
      continue
    }
    current += char
    currentWidth += charWidth
  }
  if (current || lines.length === 0) {
    lines.push(`${prefix}${current}`)
  }
  return lines
}

const compactCommand = (value: string, limit = 120) => {
  const text = value.trim().replace(/\s+/g, ' ')
  if (!text) {
    return 'bash_exec'
  }
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`
}

const compactValue = (value?: string | null, limit = 64) => {
  const text = String(value || '').trim()
  if (!text) {
    return ''
  }
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`
}

function buildListLines(payload: Record<string, unknown>) {
  const items = Array.isArray(payload.items) ? payload.items : []
  return items.slice(0, 8).map((item) => {
    if (!item || typeof item !== 'object') {
      return ''
    }
    const record = item as Record<string, unknown>
    const status = compactValue(typeof record.status === 'string' ? record.status : '', 18)
    const bashId = compactValue(typeof record.bash_id === 'string' ? record.bash_id : '', 18)
    const command = compactCommand(typeof record.command === 'string' ? record.command : '', 72)
    return [status, bashId, command].filter(Boolean).join(' · ')
  }).filter(Boolean)
}

export const BashExecOperationMessage: React.FC<BashExecOperationMessageProps> = ({
  label,
  content,
  toolName,
  toolCallId,
  status,
  args,
  output,
  mcpServer,
  mcpTool,
  metadata,
  width = 80,
  baseUrl,
  questId,
  live = false,
}) => {
  const argsPayload = useMemo(() => parseJsonRecord(args), [args])
  const outputPayload = useMemo(() => parseJsonRecord(output), [output])
  const resultPayload = outputPayload ?? EMPTY_RESULT_PAYLOAD
  const mode = String(argsPayload?.mode || metadata?.mode || 'detach').trim().toLowerCase() || 'detach'
  const command = String(argsPayload?.command || metadata?.command || resultPayload.command || '').trim()
  const workdir = normalizeWorkdir(
    typeof argsPayload?.workdir === 'string'
      ? argsPayload.workdir
      : typeof metadata?.workdir === 'string'
        ? metadata.workdir
        : typeof resultPayload.workdir === 'string'
          ? resultPayload.workdir
          : ''
  )
  const initialBashId =
    typeof resultPayload.bash_id === 'string'
      ? resultPayload.bash_id
      : typeof metadata?.bash_id === 'string'
        ? metadata.bash_id
        : ''
  const initialStatus =
    typeof resultPayload.status === 'string'
      ? (resultPayload.status as BashSessionStatus)
      : typeof metadata?.bash_status === 'string'
        ? (metadata.bash_status as BashSessionStatus)
        : (status as BashSessionStatus | undefined) || null
  const inlineLog =
    typeof resultPayload.log === 'string'
      ? resultPayload.log
      : typeof resultPayload.output === 'string'
        ? resultPayload.output
        : ''
  const initialProgress =
    resultPayload.last_progress && typeof resultPayload.last_progress === 'object'
      ? (resultPayload.last_progress as BashProgress)
      : null
  const listLines = useMemo(() => buildListLines(resultPayload), [outputPayload])
  const [bashId, setBashId] = useState(initialBashId)
  const [sessionStatus, setSessionStatus] = useState<BashSessionStatus | null>(initialStatus)
  const [exitCode, setExitCode] = useState<number | null>(
    typeof resultPayload.exit_code === 'number' ? resultPayload.exit_code : null
  )
  const [stopReason, setStopReason] = useState<string>(
    typeof resultPayload.stop_reason === 'string' ? resultPayload.stop_reason : ''
  )
  const [progress, setProgress] = useState<BashProgress | null>(initialProgress)
  const [logLines, setLogLines] = useState<string[]>([])
  const [connectionLabel, setConnectionLabel] = useState<string>(live ? 'connecting' : 'idle')
  const lastSeqRef = useRef<number | null>(null)

  const appendLogEntry = useCallback((entry: BashLogEntry) => {
    const statusMarker = parseStatusMarker(entry.line)
    if (statusMarker) {
      setSessionStatus(statusMarker.status)
      setExitCode(statusMarker.exitCode)
      setStopReason(statusMarker.reason)
      return
    }
    const progressMarker = parseProgressMarker(entry.line)
    if (progressMarker) {
      setProgress(progressMarker)
      return
    }
    if (entry.line.startsWith(BASH_CARRIAGE_RETURN_PREFIX)) {
      const nextLine = entry.line.slice(BASH_CARRIAGE_RETURN_PREFIX.length)
      setLogLines((previous) => {
        const next = previous.length > 0 ? [...previous.slice(0, -1), nextLine] : [nextLine]
        return next.slice(-MAX_VISIBLE_LOG_LINES)
      })
      return
    }
    setLogLines((previous) => [...previous, entry.line].slice(-MAX_VISIBLE_LOG_LINES))
  }, [])

  useEffect(() => {
    setBashId(initialBashId)
    setSessionStatus(initialStatus)
    setExitCode(typeof resultPayload.exit_code === 'number' ? resultPayload.exit_code : null)
    setStopReason(typeof resultPayload.stop_reason === 'string' ? resultPayload.stop_reason : '')
    setProgress(initialProgress)
    lastSeqRef.current = null
    setLogLines([])
    setConnectionLabel(live ? 'connecting' : 'idle')
    if (mode === 'list') {
      setLogLines(listLines)
      return
    }
    if (!inlineLog) {
      return
    }
    const seeded = inlineLog
      .split(/\r?\n/)
      .map((line) => ({ seq: 0, stream: 'stdout', line, timestamp: '' }))
    seeded.forEach(appendLogEntry)
  }, [appendLogEntry, initialBashId, initialProgress, initialStatus, inlineLog, listLines, live, mode, resultPayload.exit_code, resultPayload.stop_reason])

  useEffect(() => {
    if (!questId || !bashId || !live || mode === 'list') {
      return
    }
    let active = true
    const controller = new AbortController()

    const connect = async () => {
      try {
        const [session, logs] = await Promise.all([
          client.getBashSession(baseUrl, questId, bashId),
          client.getBashLogs(baseUrl, questId, bashId, { limit: MAX_VISIBLE_LOG_LINES, order: 'desc' }),
        ])
        if (!active) {
          return
        }
        setSessionStatus(session.status)
        setExitCode(typeof session.exit_code === 'number' ? session.exit_code : null)
        setStopReason(String(session.stop_reason || ''))
        setProgress((session.last_progress as BashProgress | null | undefined) ?? null)
        setLogLines([])
        const orderedEntries = [...logs.entries].reverse()
        orderedEntries.forEach(appendLogEntry)
        const latestSeq = logs.meta.latestSeq ? Number(logs.meta.latestSeq) : null
        lastSeqRef.current = Number.isFinite(latestSeq as number) ? latestSeq : null
        setConnectionLabel('open')
        await client.streamBashLogs(baseUrl, questId, bashId, {
          signal: controller.signal,
          lastEventId: lastSeqRef.current,
          onSnapshot: (payload) => {
            if (!active) {
              return
            }
            setLogLines([])
            ;(payload.lines || []).forEach(appendLogEntry)
            lastSeqRef.current =
              typeof payload.latest_seq === 'number' ? payload.latest_seq : lastSeqRef.current
            setProgress((payload.progress as BashProgress | null | undefined) ?? null)
          },
          onLogBatch: (payload) => {
            if (!active) {
              return
            }
            ;(payload.lines || []).forEach(appendLogEntry)
            if (typeof payload.to_seq === 'number') {
              lastSeqRef.current = payload.to_seq
            }
          },
          onProgress: (payload) => {
            if (!active) {
              return
            }
            setProgress(payload)
          },
          onDone: (payload) => {
            if (!active) {
              return
            }
            setSessionStatus((payload.status as BashSessionStatus | undefined) || session.status)
            setExitCode(typeof payload.exit_code === 'number' ? payload.exit_code : null)
            setConnectionLabel('done')
          },
        })
      } catch (error) {
        if (!active || controller.signal.aborted) {
          return
        }
        setConnectionLabel(error instanceof Error ? `error: ${error.message}` : 'error')
      }
    }

    void connect()
    return () => {
      active = false
      controller.abort()
    }
  }, [appendLogEntry, baseUrl, bashId, live, mode, questId])

  if (
    !isBashExecOperation({
      toolName,
      mcpServer,
      mcpTool,
    })
  ) {
    return null
  }

  const prefixWidth = BULLET_PREFIX.length
  const contentWidth = Math.max(1, width - prefixWidth)
  const metaParts = [
    `mode:${mode}`,
    workdir ? `cwd:${compactValue(workdir, 48)}` : '',
    bashId ? bashId : '',
    sessionStatus || '',
    formatProgress(progress),
    live && bashId ? connectionLabel : '',
    exitCode != null ? `exit:${exitCode}` : '',
    stopReason ? compactValue(stopReason, 48) : '',
  ].filter(Boolean)
  const header = label === 'tool_call' ? 'DeepScientist is managing bash_exec...' : 'DeepScientist updated bash_exec.'
  const visibleCommand = command ? compactCommand(command) : compactCommand(content)
  const renderedLogLines =
    logLines.length > 0
      ? logLines.flatMap((line) => wrapPrefixedLine(line, contentWidth))
      : bashId && live
        ? wrapPrefixedLine('waiting for live bash output...', contentWidth)
        : []

  return (
    <Box flexDirection="row" width={width}>
      <Box width={prefixWidth}>
        <Text color={theme.text.response}>{BULLET_PREFIX}</Text>
      </Box>
      <Box flexGrow={1} flexDirection="column" width={contentWidth}>
        <Text color={theme.text.link} bold>
          {header}
        </Text>
        <Text color={theme.text.response}>{visibleCommand}</Text>
        {metaParts.length > 0 ? (
          <Box marginTop={1}>
            <Text color={theme.text.secondary}>{metaParts.join(' · ')}</Text>
          </Box>
        ) : null}
        {renderedLogLines.length > 0 ? (
          <Box marginTop={1} flexDirection="column">
            {renderedLogLines.map((line, index) => (
              <Text key={`${toolCallId || bashId || 'bash'}:${index}`} color={theme.text.response}>
                {line}
              </Text>
            ))}
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}
