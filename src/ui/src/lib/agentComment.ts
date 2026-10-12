import type { AgentComment } from '@/types'

export const DEFAULT_MONITOR_CADENCE_SECONDS = [60, 120, 300, 600, 1800]

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed || undefined
}

function asNumber(value: unknown): number | null | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

function asStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  const items = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
  return items.length ? items : undefined
}

function parseStructuredString(value?: string): Record<string, unknown> | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as unknown
    return asRecord(parsed)
  } catch {
    return null
  }
}

export function normalizeAgentComment(value: unknown): AgentComment | null {
  const direct = asString(value)
  if (direct) {
    return {
      raw: direct,
      summary: direct,
    }
  }

  const record = asRecord(value)
  if (!record) {
    return null
  }

  const summary = asString(record.summary) || asString(record.message) || asString(record.comment) || asString(record.raw)
  const whyNow = asString(record.why_now) || asString(record.whyNow) || asString(record.rationale)
  const next = asString(record.next) || asString(record.next_step) || asString(record.nextStep) || asString(record.plan)
  const checkAfterSeconds =
    asNumber(record.check_after_seconds) ??
    asNumber(record.checkAfterSeconds) ??
    asNumber(record.next_check_after_seconds) ??
    asNumber(record.nextCheckAfterSeconds) ??
    null
  const checkStage = asString(record.check_stage) || asString(record.checkStage) || asString(record.stage) || null
  const risks = asStringList(record.risks)

  if (!summary && !whyNow && !next && checkAfterSeconds == null && !checkStage && !risks?.length) {
    return null
  }

  return {
    raw: asString(record.raw) || summary,
    summary,
    whyNow,
    next,
    checkAfterSeconds,
    checkStage,
    risks,
  }
}

export function extractOperationComment({
  args,
  output,
  metadata,
}: {
  args?: string
  output?: string
  metadata?: Record<string, unknown>
}): AgentComment | null {
  const parsedArgs = parseStructuredString(args)
  const parsedOutput = parseStructuredString(output)
  const candidates: unknown[] = [
    metadata?.comment,
    metadata?.agent_comment,
    parsedArgs?.comment,
    parsedArgs?.agent_comment,
    parsedOutput?.comment,
    parsedOutput?.agent_comment,
  ]
  for (const candidate of candidates) {
    const normalized = normalizeAgentComment(candidate)
    if (normalized) {
      return normalized
    }
  }
  return null
}

export function extractArtifactComment(record: Record<string, unknown>): AgentComment | null {
  const details = asRecord(record.details)
  const attachments = Array.isArray(record.attachments) ? record.attachments : []
  const candidates: unknown[] = [
    record.comment,
    details?.comment,
  ]

  for (const attachment of attachments) {
    const normalizedAttachment = asRecord(attachment)
    if (!normalizedAttachment) continue
    if (normalizedAttachment.comment != null) {
      candidates.push(normalizedAttachment.comment)
      continue
    }
    const kind = asString(normalizedAttachment.kind)
    if (kind && ['comment', 'agent_comment', 'long_run_monitor'].includes(kind)) {
      candidates.push(normalizedAttachment)
    }
  }

  for (const candidate of candidates) {
    const normalized = normalizeAgentComment(candidate)
    if (normalized) {
      return normalized
    }
  }
  return null
}

function normalizeSecondsList(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  const items = value
    .map((item) => asNumber(item))
    .filter((item): item is number => typeof item === 'number' && item > 0)
  return items.length ? items : undefined
}

export function extractOperationMonitorFields({
  metadata,
  comment,
}: {
  metadata?: Record<string, unknown>
  comment?: AgentComment | null
}) {
  const monitorPlanSeconds =
    normalizeSecondsList(metadata?.monitor_plan_seconds) ||
    normalizeSecondsList(metadata?.monitorPlanSeconds) ||
    DEFAULT_MONITOR_CADENCE_SECONDS
  const nextCheckAfterSeconds =
    (asNumber(metadata?.next_check_after_seconds) ??
      asNumber(metadata?.nextCheckAfterSeconds) ??
      comment?.checkAfterSeconds) ??
    null
  let monitorStepIndex =
    (asNumber(metadata?.monitor_step_index) ?? asNumber(metadata?.monitorStepIndex)) ?? null

  if (monitorStepIndex == null && nextCheckAfterSeconds != null) {
    const exactIndex = monitorPlanSeconds.findIndex((item) => item === nextCheckAfterSeconds)
    if (exactIndex >= 0) {
      monitorStepIndex = exactIndex
    } else {
      const fallbackIndex = monitorPlanSeconds.findIndex((item) => item >= nextCheckAfterSeconds)
      monitorStepIndex = fallbackIndex >= 0 ? fallbackIndex : monitorPlanSeconds.length - 1
    }
  }

  return {
    monitorPlanSeconds,
    monitorStepIndex,
    nextCheckAfterSeconds,
  }
}

export function formatDurationCompact(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) {
    return ''
  }
  const rounded = Math.max(0, Math.round(seconds))
  if (rounded < 60) {
    return `${rounded}s`
  }
  if (rounded < 3600) {
    const minutes = Math.floor(rounded / 60)
    const remainder = rounded % 60
    return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`
  }
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor((rounded % 3600) / 60)
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

export function formatCadenceLabel(seconds: number): string {
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`
  }
  const hours = Math.round(seconds / 3600)
  return `${hours}h`
}
