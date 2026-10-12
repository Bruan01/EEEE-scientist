'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { CheckCircle2, Layers, UploadCloud } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { acquireCliSocket } from '../lib/socket'
import { nextSeq, wrapEnvelope, type CliEnvelope } from '../lib/protocol'
import { uploadCliFile } from '@/lib/api/cli'
import { useI18n } from '@/lib/i18n/useI18n'
import { useCliStore } from '../stores/cli-store'
import { cn } from '@/lib/utils'

type CommandResult = {
  status: 'sent' | 'streaming' | 'confirm' | 'blocked' | 'error'
  output: string
  operationId: string
  command: string
  detail?: string
}

type UploadResult = {
  status: 'success' | 'error'
  detail?: string
}

const MAX_OUTPUT_CHARS = 8000
const DEFAULT_COLS = 120
const DEFAULT_ROWS = 40

const commandStatusClasses: Record<CommandResult['status'], string> = {
  sent: 'bg-[var(--cli-status-idle)] text-[var(--cli-ink-0)]',
  streaming: 'bg-[var(--cli-status-busy)] text-[var(--cli-ink-0)]',
  confirm: 'bg-[var(--cli-status-warning)] text-[var(--cli-ink-0)]',
  blocked: 'bg-[var(--cli-status-offline)] text-[var(--cli-ink-0)]',
  error: 'bg-[var(--cli-status-error)] text-[var(--cli-ink-0)]',
}

const uploadStatusClasses: Record<UploadResult['status'], string> = {
  success: 'bg-[var(--cli-status-online)] text-[var(--cli-ink-0)]',
  error: 'bg-[var(--cli-status-error)] text-[var(--cli-ink-0)]',
}

export function BatchOperationsDialog({
  open,
  onOpenChange,
  projectId,
  activeServerId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  activeServerId?: string
}) {
  const { t } = useI18n('cli')
  const servers = useCliStore((state) => state.servers)
  const [selectedServers, setSelectedServers] = useState<Set<string>>(new Set())
  const [command, setCommand] = useState('')
  const [commandResults, setCommandResults] = useState<Record<string, CommandResult>>({})
  const [uploadPath, setUploadPath] = useState('~/')
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadResults, setUploadResults] = useState<Record<string, UploadResult>>({})
  const [isSending, setIsSending] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const sessionByServerRef = useRef<Map<string, string>>(new Map())
  const closeTimeoutByServerRef = useRef<Map<string, number>>(new Map())
  const clientIdRef = useRef<string>(crypto.randomUUID())

  const { socket, release } = useMemo(() => acquireCliSocket({ authMode: 'user' }), [])

  const emitEnvelope = useCallback(
    (event: string, serverId: string, payload: Record<string, unknown>, meta: Partial<CliEnvelope> = {}) => {
      const envelope = wrapEnvelope(payload, {
        project_id: projectId,
        server_id: serverId,
        client_id: clientIdRef.current,
        ...meta,
      })
      socket.emit(event, envelope)
    },
    [projectId, socket]
  )

  useEffect(() => {
    if (activeServerId) {
      setSelectedServers((prev) => {
        if (prev.size > 0) return prev
        return new Set([activeServerId])
      })
    }
  }, [activeServerId])

  const clearCloseTimer = useCallback((serverId: string) => {
    const timer = closeTimeoutByServerRef.current.get(serverId)
    if (timer) {
      window.clearTimeout(timer)
      closeTimeoutByServerRef.current.delete(serverId)
    }
  }, [])

  const scheduleAutoClose = useCallback(
    (serverId: string, sessionId: string, delayMs = 20000) => {
      clearCloseTimer(serverId)
      const timer = window.setTimeout(() => {
        emitEnvelope('cli:session:close', serverId, { session_id: sessionId }, { session_id: sessionId })
        sessionByServerRef.current.delete(serverId)
        closeTimeoutByServerRef.current.delete(serverId)
      }, delayMs)
      closeTimeoutByServerRef.current.set(serverId, timer)
    },
    [clearCloseTimer, emitEnvelope]
  )

  const closeAllSessions = useCallback(() => {
    sessionByServerRef.current.forEach((sessionId, serverId) => {
      emitEnvelope('cli:session:close', serverId, { session_id: sessionId }, { session_id: sessionId })
    })
    sessionByServerRef.current.clear()
    closeTimeoutByServerRef.current.forEach((timer) => window.clearTimeout(timer))
    closeTimeoutByServerRef.current.clear()
  }, [emitEnvelope])

  useEffect(() => {
    if (open) return
    closeAllSessions()
    setCommand('')
    setCommandResults({})
    setUploadFiles([])
    setUploadResults({})
  }, [open, closeAllSessions])

  useEffect(() => {
    return () => {
      closeAllSessions()
      release()
    }
  }, [closeAllSessions, release])

  const selectedServerList = useMemo(() => Array.from(selectedServers), [selectedServers])

  useEffect(() => {
    const handleOutput = (payload: CliEnvelope) => {
      const rawSessionId = payload.session_id || (payload.payload as Record<string, unknown>)?.session_id
      const rawServerId = payload.server_id || (payload.payload as Record<string, unknown>)?.server_id
      const sessionId = typeof rawSessionId === 'string' ? rawSessionId : String(rawSessionId || '')
      const serverId = typeof rawServerId === 'string' ? rawServerId : String(rawServerId || '')
      if (!sessionId || !serverId) return
      const expectedSession = sessionByServerRef.current.get(serverId)
      if (!expectedSession || expectedSession !== sessionId) return
      const data = String((payload.payload as Record<string, unknown>)?.data || '')
      if (!data) return
      setCommandResults((prev) => {
        const existing = prev[serverId]
        if (!existing) return prev
        const nextOutput = (existing.output + data).slice(-MAX_OUTPUT_CHARS)
        return {
          ...prev,
          [serverId]: { ...existing, status: 'streaming', output: nextOutput },
        }
      })
      scheduleAutoClose(serverId, sessionId)
    }

    const handleConfirm = (payload: CliEnvelope) => {
      const inner = payload.payload as Record<string, unknown>
      const rawSessionId = payload.session_id || inner?.session_id
      const rawServerId = payload.server_id || inner?.server_id
      const sessionId = typeof rawSessionId === 'string' ? rawSessionId : String(rawSessionId || '')
      const serverId = typeof rawServerId === 'string' ? rawServerId : String(rawServerId || '')
      if (!sessionId || !serverId) return
      const expectedSession = sessionByServerRef.current.get(serverId)
      if (!expectedSession || expectedSession !== sessionId) return
      const danger = (inner?.danger || {}) as Record<string, unknown>
      const detail = danger?.description ? String(danger.description) : 'Confirmation required'
      const commandText = inner?.command ? String(inner.command) : undefined
      clearCloseTimer(serverId)
      setCommandResults((prev) => {
        const existing = prev[String(serverId)]
        if (!existing) return prev
        return {
          ...prev,
          [String(serverId)]: {
            ...existing,
            status: 'confirm',
            detail,
            command: commandText || existing.command,
            operationId: payload.operation_id || existing.operationId,
          },
        }
      })
    }

    const handleBlocked = (payload: CliEnvelope) => {
      const inner = payload.payload as Record<string, unknown>
      const rawSessionId = payload.session_id || inner?.session_id
      const rawServerId = payload.server_id || inner?.server_id
      const sessionId = typeof rawSessionId === 'string' ? rawSessionId : String(rawSessionId || '')
      const serverId = typeof rawServerId === 'string' ? rawServerId : String(rawServerId || '')
      if (!sessionId || !serverId) return
      const expectedSession = sessionByServerRef.current.get(serverId)
      if (!expectedSession || expectedSession !== sessionId) return
      const danger = (inner?.danger || {}) as Record<string, unknown>
      const detail = danger?.description ? String(danger.description) : 'Command blocked for safety.'
      setCommandResults((prev) => {
        const existing = prev[String(serverId)]
        if (!existing) return prev
        return {
          ...prev,
          [String(serverId)]: {
            ...existing,
            status: 'blocked',
            detail,
          },
        }
      })
      scheduleAutoClose(serverId, sessionId, 8000)
    }

    socket.on('cli:terminal:output', handleOutput)
    socket.on('cli:terminal:confirm_required', handleConfirm)
    socket.on('cli:terminal:blocked', handleBlocked)

    return () => {
      socket.off('cli:terminal:output', handleOutput)
      socket.off('cli:terminal:confirm_required', handleConfirm)
      socket.off('cli:terminal:blocked', handleBlocked)
    }
  }, [socket, clearCloseTimer, scheduleAutoClose])

  const toggleServer = useCallback((serverId: string) => {
    setSelectedServers((prev) => {
      const next = new Set(prev)
      if (next.has(serverId)) {
        next.delete(serverId)
      } else {
        next.add(serverId)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedServers(new Set(servers.map((server) => server.id)))
  }, [servers])

  const handleClearSelection = useCallback(() => {
    setSelectedServers(new Set())
  }, [])

  const handleRunCommand = useCallback(async () => {
    const trimmed = command.trim()
    if (!trimmed || selectedServerList.length === 0) return
    setIsSending(true)
    try {
      const sessionIds = await Promise.all(
        selectedServerList.map(async () => crypto.randomUUID())
      )
      const results: Record<string, CommandResult> = {}

      selectedServerList.forEach((serverId, index) => {
        const existingSession = sessionByServerRef.current.get(serverId)
        if (existingSession) {
          emitEnvelope('cli:session:close', serverId, { session_id: existingSession }, { session_id: existingSession })
        }
        const sessionId = sessionIds[index]
        const operationId = crypto.randomUUID()
        sessionByServerRef.current.set(serverId, sessionId)
        results[serverId] = {
          status: 'sent',
          output: '',
          operationId,
          command: trimmed,
        }
        emitEnvelope('cli:session:create', serverId, {
          session_id: sessionId,
          cols: DEFAULT_COLS,
          rows: DEFAULT_ROWS,
          project_id: projectId,
        }, { session_id: sessionId })
        emitEnvelope(
          'cli:terminal:input',
          serverId,
          { data: trimmed.endsWith('\n') ? trimmed : `${trimmed}\n` },
          { session_id: sessionId, operation_id: operationId, seq: nextSeq() }
        )
        scheduleAutoClose(serverId, sessionId)
      })

      setCommandResults(results)
    } catch (err) {
      console.error('[CLI] Batch command failed:', err)
    } finally {
      setIsSending(false)
    }
  }, [command, emitEnvelope, projectId, scheduleAutoClose, selectedServerList])

  const handleConfirmCommand = useCallback((serverId: string) => {
    const result = commandResults[serverId]
    const sessionId = sessionByServerRef.current.get(serverId)
    if (!result || !sessionId) return
    emitEnvelope(
      'cli:terminal:input',
      serverId,
      { data: result.command.endsWith('\n') ? result.command : `${result.command}\n`, confirmed: true },
      { session_id: sessionId, operation_id: result.operationId, seq: nextSeq() }
    )
    scheduleAutoClose(serverId, sessionId)
    setCommandResults((prev) => ({
      ...prev,
      [serverId]: { ...result, status: 'sent', detail: undefined },
    }))
  }, [commandResults, emitEnvelope, scheduleAutoClose])

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : []
    setUploadFiles(files)
  }, [])

  const handleUpload = useCallback(async () => {
    if (!uploadFiles.length || selectedServerList.length === 0) return
    setIsUploading(true)
    const results: Record<string, UploadResult> = {}
    await Promise.all(
      selectedServerList.map(async (serverId) => {
        try {
          for (const file of uploadFiles) {
            await uploadCliFile(projectId, serverId, file, uploadPath)
          }
          results[serverId] = {
            status: 'success',
            detail: `${uploadFiles.length} file(s) uploaded`,
          }
        } catch (err) {
          results[serverId] = {
            status: 'error',
            detail: err instanceof Error ? err.message : 'Upload failed',
          }
        }
      })
    )
    setUploadResults(results)
    setIsUploading(false)
  }, [projectId, selectedServerList, uploadFiles, uploadPath])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cli-root max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            {t('batch_operations')}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-2xl border border-white/40 bg-white/70 p-4 text-sm text-[var(--cli-muted-1)]">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[var(--cli-ink-1)]">{t('batch_target_servers')}</div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleSelectAll}>
                  {t('select_all')}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                  {t('clear')}
                </Button>
              </div>
            </div>
            <ScrollArea className="mt-3 h-60 pr-2">
              <div className="space-y-2">
                {servers.map((server) => (
                  <label
                    key={server.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/40 bg-white/60 px-3 py-2 text-xs text-[var(--cli-muted-1)]"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedServers.has(server.id)}
                        onChange={() => toggleServer(server.id)}
                        className="cli-focus-ring h-3.5 w-3.5 accent-[var(--cli-accent-olive)]"
                        aria-label={`${t('select_all')} ${server.name || server.hostname}`}
                      />
                      <span className="text-[var(--cli-ink-1)]">
                        {server.name || server.hostname}
                      </span>
                    </div>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-[var(--cli-muted-1)]">
                      {server.status}
                    </span>
                  </label>
                ))}
                {servers.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/40 bg-white/50 p-3 text-center text-xs text-[var(--cli-muted-1)]">
                    {t('no_servers_available')}
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/40 bg-white/70 p-4">
              <div className="text-sm font-semibold text-[var(--cli-ink-1)]">{t('batch_run_command')}</div>
              <div className="mt-3 space-y-3">
                <Textarea
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder={t('batch_command_placeholder')}
                  className="min-h-[80px]"
                  aria-label={t('batch_command_input')}
                />
                <Button
                  size="sm"
                  onClick={handleRunCommand}
                  disabled={isSending || !command.trim() || selectedServerList.length === 0}
                >
                  {t('run_on_selected')}
                </Button>
                {Object.keys(commandResults).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(commandResults).map(([serverId, result]) => {
                      const serverLabel =
                        servers.find((server) => server.id === serverId)?.name ||
                        servers.find((server) => server.id === serverId)?.hostname ||
                        serverId
                      return (
                        <div
                          key={serverId}
                          className="rounded-xl border border-white/40 bg-white/60 px-3 py-2 text-xs text-[var(--cli-muted-1)]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--cli-ink-1)]">{serverLabel}</span>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-medium',
                                commandStatusClasses[result.status]
                              )}
                            >
                              {result.status}
                            </span>
                          </div>
                          {result.detail ? (
                            <div className="mt-1 text-[11px] text-[var(--cli-muted-1)]">
                              {result.detail}
                            </div>
                          ) : null}
                          {result.status === 'confirm' ? (
                            <div className="mt-2">
                              <Button size="sm" onClick={() => handleConfirmCommand(serverId)}>
                                {t('confirm_and_run')}
                              </Button>
                            </div>
                          ) : null}
                          {result.output ? (
                            <pre className="mt-2 max-h-32 overflow-auto rounded-lg border border-white/40 bg-white/70 p-2 text-[11px] text-[var(--cli-ink-1)]">
                              {result.output}
                            </pre>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-white/40 bg-white/70 p-4">
              <div className="text-sm font-semibold text-[var(--cli-ink-1)]">{t('batch_upload')}</div>
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={uploadPath}
                    onChange={(event) => setUploadPath(event.target.value)}
                    placeholder={t('batch_upload_target_placeholder')}
                    className="flex-1"
                    aria-label={t('upload_target_path')}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadCloud className="mr-1 h-4 w-4" />
                    {t('select_files')}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                    aria-label={t('select_files_to_upload')}
                  />
                </div>
                {uploadFiles.length > 0 ? (
                  <div className="text-xs text-[var(--cli-muted-1)]">
                    {t('files_selected_count', { count: uploadFiles.length })}
                  </div>
                ) : (
                  <div className="text-xs text-[var(--cli-muted-1)]">{t('no_files_selected')}</div>
                )}
                <Button
                  size="sm"
                  onClick={handleUpload}
                  disabled={isUploading || uploadFiles.length === 0 || selectedServerList.length === 0}
                >
                  {t('upload_to_selected')}
                </Button>
                {Object.keys(uploadResults).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(uploadResults).map(([serverId, result]) => {
                      const serverLabel =
                        servers.find((server) => server.id === serverId)?.name ||
                        servers.find((server) => server.id === serverId)?.hostname ||
                        serverId
                      return (
                        <div
                          key={serverId}
                          className="flex items-center justify-between rounded-xl border border-white/40 bg-white/60 px-3 py-2 text-xs text-[var(--cli-muted-1)]"
                        >
                          <div className="flex items-center gap-2">
                            {result.status === 'success' ? (
                              <CheckCircle2 className="h-4 w-4 text-[var(--cli-status-online)]" />
                            ) : null}
                            <span className="text-[var(--cli-ink-1)]">{serverLabel}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {result.detail ? <span>{result.detail}</span> : null}
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-medium',
                                uploadStatusClasses[result.status]
                              )}
                            >
                              {result.status}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
