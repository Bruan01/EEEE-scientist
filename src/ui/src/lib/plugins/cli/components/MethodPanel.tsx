'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  RefreshCw,
  Timer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SpotlightCard, Stepper, Step } from '@/components/react-bits'
import { cn } from '@/lib/utils'
import { createCliMethod, listCliMethods } from '@/lib/api/cli'
import type { CliMethodConfig } from '../types/cli'
import { useCliSocket } from '../hooks/useCliSocket'
import { unwrapPayload } from '../lib/socket'

type MethodStatus = {
  step?: number
  message?: string
  percent?: number
}

type MethodPanelProps = {
  projectId: string
  serverId: string
  canCreate: boolean
}

const createId = () => {
  try {
    return crypto.randomUUID()
  } catch {
    return `method-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

const formatTimestamp = (value?: string | null) => {
  if (!value) return 'n/a'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString()
}

export function MethodPanel({ projectId, serverId, canCreate }: MethodPanelProps) {
  const [methods, setMethods] = useState<CliMethodConfig[]>([])
  const [methodsLoading, setMethodsLoading] = useState(false)
  const [methodsError, setMethodsError] = useState<string | null>(null)

  const [paperSource, setPaperSource] = useState('')
  const [methodName, setMethodName] = useState('')
  const [topic, setTopic] = useState('')
  const [codeSource, setCodeSource] = useState('')
  const [autoName, setAutoName] = useState(true)
  const [autoCreateEnabled, setAutoCreateEnabled] = useState(true)

  const [countdown, setCountdown] = useState<number | null>(null)
  const [createInProgress, setCreateInProgress] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [status, setStatus] = useState<MethodStatus | null>(null)
  const [currentStep, setCurrentStep] = useState(1)

  const activeRequestIdRef = useRef<string | null>(null)

  const requiredReady = paperSource.trim().length > 0
  const canSubmit = requiredReady && canCreate && !createInProgress
  const totalSteps = 4
  const isFinalStep = currentStep === totalSteps
  const autoCreateReady = canSubmit && autoCreateEnabled && isFinalStep

  const loadMethods = useCallback(async () => {
    setMethodsLoading(true)
    setMethodsError(null)
    try {
      const response = await listCliMethods(projectId, serverId)
      setMethods(response.methods || [])
    } catch (err) {
      setMethodsError('Unable to load methods.')
    } finally {
      setMethodsLoading(false)
    }
  }, [projectId, serverId])

  const socketHandlers = useMemo(
    () => ({
      onMethodStatus: (envelope: Record<string, unknown>) => {
        const payload = unwrapPayload<Record<string, unknown>>(envelope)
        const requestId = payload?.request_id
        if (!activeRequestIdRef.current) {
          return
        }
        if (requestId && requestId !== activeRequestIdRef.current) {
          return
        }
        const update: MethodStatus = {
          step: typeof payload?.step === 'number' ? payload.step : undefined,
          message: typeof payload?.message === 'string' ? payload.message : undefined,
          percent: typeof payload?.percent === 'number' ? payload.percent : undefined,
        }
        setStatus(update)
      },
      onMethodDone: (envelope: Record<string, unknown>) => {
        const payload = unwrapPayload<Record<string, unknown>>(envelope)
        const requestId = payload?.request_id
        if (!activeRequestIdRef.current) {
          return
        }
        if (requestId && requestId !== activeRequestIdRef.current) {
          return
        }
        activeRequestIdRef.current = null
        setCreateInProgress(false)
        setCountdown(null)
        setStatus({
          step: 6,
          message: 'Method created',
          percent: 100,
        })
        setAutoCreateEnabled(false)
        void loadMethods()
      },
      onMethodError: (envelope: Record<string, unknown>) => {
        const payload = unwrapPayload<Record<string, unknown>>(envelope)
        const requestId = payload?.request_id
        if (!activeRequestIdRef.current) {
          return
        }
        if (requestId && requestId !== activeRequestIdRef.current) {
          return
        }
        activeRequestIdRef.current = null
        setCreateInProgress(false)
        setCountdown(null)
        const message =
          typeof payload?.error === 'string' ? payload.error : 'Method creation failed.'
        setCreateError(message)
        setAutoCreateEnabled(false)
      },
    }),
    [loadMethods]
  )

  useCliSocket({
    projectId,
    serverId,
    handlers: socketHandlers,
  })

  useEffect(() => {
    void loadMethods()
    setCountdown(null)
    setCreateInProgress(false)
    setCreateError(null)
    setStatus(null)
    activeRequestIdRef.current = null
  }, [loadMethods])

  useEffect(() => {
    if (!autoCreateReady) {
      setCountdown(null)
      return
    }
    setCountdown(4)
  }, [autoCreateReady, paperSource, methodName, topic, codeSource])

  const handleCreate = useCallback(async () => {
    if (!canSubmit) return
    setCreateInProgress(true)
    setCreateError(null)
    setStatus({ step: 0, message: 'Queued for creation', percent: 0 })
    const sessionId = createId()
    try {
      const response = await createCliMethod(projectId, serverId, {
        session_id: sessionId,
        method_name: autoName ? undefined : methodName.trim() || undefined,
        paper_source: paperSource.trim(),
        topic: topic.trim() || undefined,
        code_source: codeSource.trim() || undefined,
        auto_name: autoName,
      })
      activeRequestIdRef.current = response.request_id || sessionId
    } catch (err) {
      setCreateInProgress(false)
      setCreateError('Failed to queue method creation.')
    }
  }, [autoName, canSubmit, codeSource, methodName, paperSource, projectId, serverId, topic])

  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) {
      setCountdown(null)
      void handleCreate()
      return
    }
    const timer = window.setTimeout(() => {
      setCountdown((prev) => (prev != null ? prev - 1 : prev))
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [countdown, handleCreate])

  const handleReset = () => {
    setPaperSource('')
    setMethodName('')
    setTopic('')
    setCodeSource('')
    setAutoName(true)
    setAutoCreateEnabled(true)
    setCountdown(null)
    setCreateError(null)
    setStatus(null)
    setCurrentStep(1)
  }

  const requirementSummary = useMemo(
    () => [
      { label: 'Paper source', ready: paperSource.trim().length > 0 },
      { label: 'Method name', ready: autoName || methodName.trim().length > 0, optional: true },
      { label: 'Topic', ready: topic.trim().length > 0, optional: true },
      { label: 'Code repo', ready: codeSource.trim().length > 0, optional: true },
    ],
    [autoName, codeSource, methodName, paperSource, topic]
  )

  const statusPercent = Math.min(100, Math.max(0, status?.percent ?? 0))

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="space-y-6">
        <SpotlightCard className="cli-card rounded-2xl border border-white/40 bg-white/70 p-6 shadow-[0_10px_24px_rgba(20,20,20,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="cli-h2 text-[var(--cli-ink-1)]">Method report</div>
              <div className="text-xs text-[var(--cli-muted-1)]">
                Provide core inputs. Creation runs automatically when required fields are ready.
              </div>
            </div>
            <div className="rounded-full border border-white/50 bg-white/80 px-3 py-1 text-[10px] uppercase tracking-wide text-[var(--cli-muted-1)]">
              Session anchored
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/40 bg-white/80 px-4 py-3">
              <div className="text-[10px] uppercase tracking-wide text-[var(--cli-muted-1)]">
                Project
              </div>
              <div className="mt-1 text-sm font-semibold text-[var(--cli-ink-1)]">
                {projectId}
              </div>
            </div>
            <div className="rounded-xl border border-white/40 bg-white/80 px-4 py-3">
              <div className="text-[10px] uppercase tracking-wide text-[var(--cli-muted-1)]">
                Server
              </div>
              <div className="mt-1 text-sm font-semibold text-[var(--cli-ink-1)]">
                {serverId}
              </div>
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="cli-card rounded-2xl border border-white/40 bg-white/70 p-6 shadow-[0_10px_24px_rgba(20,20,20,0.08)]">
          <Stepper
            initialStep={currentStep}
            onStepChange={setCurrentStep}
            onFinalStepCompleted={() => void handleCreate()}
            backButtonText="Previous"
            nextButtonText={(step, total) =>
              step >= total ? (createInProgress ? 'Creating...' : 'Create method') : 'Next'
            }
            nextDisabled={(step, total) => {
              if (step === 1) return !requiredReady
              if (step >= total) return !canSubmit
              return false
            }}
            backDisabled={() => createInProgress}
          >
            <Step title="Paper source" description="Provide a PDF/MD path or a URL.">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[var(--cli-muted-1)]">
                  <span>Required input</span>
                  <span className="rounded-full border border-white/60 bg-white/70 px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--cli-status-busy)]">
                    Required
                  </span>
                </div>
                <input
                  value={paperSource}
                  onChange={(event) => setPaperSource(event.target.value)}
                  placeholder="https://arxiv.org/abs/0000.00000 or /path/to/paper.pdf"
                  className="cli-focus-ring w-full rounded-lg border border-white/40 bg-white/80 px-3 py-2 text-sm text-[var(--cli-ink-1)] outline-none"
                />
                <p className="text-xs text-[var(--cli-muted-1)]">
                  Links to arxiv/openreview are parsed automatically.
                </p>
              </div>
            </Step>

            <Step title="Method identity" description="Supply a name or let the model derive one.">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[var(--cli-muted-1)]">
                  <span>Optional input</span>
                  <span className="rounded-full border border-white/60 bg-white/70 px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--cli-muted-1)]">
                    Optional
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    value={methodName}
                    onChange={(event) => {
                      const nextValue = event.target.value
                      setMethodName(nextValue)
                      if (nextValue.trim()) {
                        setAutoName(false)
                      }
                    }}
                    placeholder="Contrastive Ablation Method"
                    disabled={autoName}
                    className={cn(
                      'cli-focus-ring w-full rounded-lg border border-white/40 bg-white/80 px-3 py-2 text-sm text-[var(--cli-ink-1)] outline-none',
                      autoName && 'opacity-60'
                    )}
                  />
                  <label className="flex items-center gap-2 rounded-lg border border-white/40 bg-white/80 px-3 py-2 text-xs text-[var(--cli-muted-1)]">
                    <input
                      type="checkbox"
                      checked={autoName}
                      onChange={(event) => {
                        const enabled = event.target.checked
                        setAutoName(enabled)
                        if (enabled) {
                          setMethodName('')
                        }
                      }}
                      className="h-4 w-4 accent-[var(--cli-accent-olive)]"
                    />
                    Auto-name
                  </label>
                </div>
              </div>
            </Step>

            <Step title="Focus and code" description="Optionally narrow scope or point to code.">
              <div className="grid gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-[var(--cli-muted-1)]">
                    Topic
                  </label>
                  <input
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    placeholder="Transformer pruning / Diffusion speedup"
                    className="cli-focus-ring mt-2 w-full rounded-lg border border-white/40 bg-white/80 px-3 py-2 text-sm text-[var(--cli-ink-1)] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-[var(--cli-muted-1)]">
                    Code repo or path
                  </label>
                  <input
                    value={codeSource}
                    onChange={(event) => setCodeSource(event.target.value)}
                    placeholder="https://github.com/org/repo or /path/to/code"
                    className="cli-focus-ring mt-2 w-full rounded-lg border border-white/40 bg-white/80 px-3 py-2 text-sm text-[var(--cli-ink-1)] outline-none"
                  />
                </div>
              </div>
            </Step>

            <Step title="Run controls" description="Review the report and submit.">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--cli-muted-1)]">
                  <span>Auto-run begins on the final step.</span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autoCreateEnabled}
                      onChange={(event) => setAutoCreateEnabled(event.target.checked)}
                      className="h-4 w-4 accent-[var(--cli-accent-olive)]"
                    />
                    Auto-run enabled
                  </label>
                </div>

                {countdown !== null && autoCreateReady ? (
                  <div className="flex items-center justify-between rounded-xl border border-white/40 bg-white/80 px-4 py-3 text-xs text-[var(--cli-muted-1)]">
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4 text-[var(--cli-muted-1)]" />
                      Auto-creating in {countdown}s
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => setCountdown(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="secondary" onClick={handleReset} disabled={createInProgress}>
                    Reset
                  </Button>
                  {!canCreate ? (
                    <div className="flex items-center gap-2 text-xs text-[var(--cli-status-error)]">
                      <AlertTriangle className="h-4 w-4" />
                      You do not have permission to create methods.
                    </div>
                  ) : null}
                </div>

                {createError ? (
                  <div className="flex items-center gap-2 text-xs text-[var(--cli-status-error)]">
                    <AlertTriangle className="h-4 w-4" />
                    {createError}
                  </div>
                ) : null}
              </div>
            </Step>
          </Stepper>
        </SpotlightCard>
      </div>

      <div className="space-y-6">
        <SpotlightCard className="cli-card rounded-2xl border border-white/40 bg-white/70 p-6 shadow-[0_10px_24px_rgba(20,20,20,0.08)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--cli-ink-1)]">Checklist</div>
              <div className="text-xs text-[var(--cli-muted-1)]">Required vs optional inputs</div>
            </div>
            <span className="rounded-full border border-white/50 bg-white/80 px-3 py-1 text-[10px] uppercase tracking-wide text-[var(--cli-muted-1)]">
              Report status
            </span>
          </div>
          <div className="mt-4 space-y-2 text-xs">
            {requirementSummary.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-lg border border-white/40 bg-white/80 px-3 py-2"
              >
                <span className="text-[var(--cli-ink-1)]">{item.label}</span>
                <span
                  className={cn(
                    'flex items-center gap-1 text-[10px] uppercase tracking-wide',
                    item.ready ? 'text-[var(--cli-status-online)]' : 'text-[var(--cli-muted-1)]'
                  )}
                >
                  {item.ready ? <CheckCircle2 className="h-3 w-3" /> : null}
                  {item.optional ? 'Optional' : 'Required'}
                </span>
              </div>
            ))}
          </div>
        </SpotlightCard>

        <SpotlightCard className="cli-card rounded-2xl border border-white/40 bg-white/70 p-6 shadow-[0_10px_24px_rgba(20,20,20,0.08)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--cli-ink-1)]">Creation status</div>
              <div className="text-xs text-[var(--cli-muted-1)]">Live progress from the CLI agent</div>
            </div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--cli-muted-1)]">
              {createInProgress ? 'Running' : 'Idle'}
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-white/40 bg-white/80 px-4 py-3">
            <div className="flex items-center justify-between text-xs text-[var(--cli-muted-1)]">
              <span>{status?.message || 'Awaiting input'}</span>
              <span>{status?.percent ? `${status?.percent}%` : '0%'}</span>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-white/60">
              <div
                className="h-full rounded-full bg-[var(--cli-accent-olive)] transition-all"
                style={{ width: `${statusPercent}%` }}
              />
            </div>
            {status?.step ? (
              <div className="mt-2 text-[10px] uppercase tracking-wide text-[var(--cli-muted-1)]">
                Step {status.step}
              </div>
            ) : null}
          </div>
        </SpotlightCard>

        <SpotlightCard className="cli-card rounded-2xl border border-white/40 bg-white/70 p-6 shadow-[0_10px_24px_rgba(20,20,20,0.08)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--cli-ink-1)]">Methods</div>
              <div className="text-xs text-[var(--cli-muted-1)]">Registered methods for this project</div>
            </div>
            <Button variant="secondary" size="sm" onClick={loadMethods} disabled={methodsLoading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', methodsLoading && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          {methodsLoading ? (
            <div className="mt-6 flex items-center justify-center text-xs text-[var(--cli-muted-1)]">
              Loading methods...
            </div>
          ) : methodsError ? (
            <div className="mt-6 flex items-center gap-2 text-xs text-[var(--cli-status-error)]">
              <AlertTriangle className="h-4 w-4" />
              {methodsError}
            </div>
          ) : methods.length === 0 ? (
            <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/40 bg-white/60 px-4 py-6 text-xs text-[var(--cli-muted-1)]">
              <FileText className="h-5 w-5" />
              No methods recorded yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {methods.map((method) => {
                const title =
                  method.method_name || method.method_slug || method.method_id || 'Method'
                const statusLabel = method.status || 'created'
                return (
                  <div
                    key={method.method_id || method.method_slug || title}
                    className="rounded-xl border border-white/40 bg-white/80 px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-[var(--cli-ink-1)]">
                          {title}
                        </div>
                        <div className="text-[11px] text-[var(--cli-muted-1)]">
                          {method.method_id || 'unknown id'}
                        </div>
                      </div>
                      <span className="rounded-full border border-white/50 bg-white/90 px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--cli-muted-1)]">
                        {statusLabel}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-[var(--cli-muted-1)]">
                      <div>Paper: {method.paper?.source || 'n/a'}</div>
                      <div>Code: {method.code?.source || 'n/a'}</div>
                      <div>Created: {formatTimestamp(method.created_at)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SpotlightCard>
      </div>
    </div>
  )
}
