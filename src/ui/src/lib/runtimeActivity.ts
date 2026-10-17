import { buildOperationIdentity, mergeFeedItemsForRender, type RenderOperationFeedItem } from '@/lib/feedOperations'
import type { FeedItem, QuestSummary } from '@/types'

export type RuntimeActivityStatus = 'queued' | 'running' | 'completed' | 'failed' | 'retrying'

export type RuntimeActivityKind = 'request' | 'run' | 'memory' | 'artifact' | 'tool' | 'runtime'

export type RuntimeActivityLabel =
  | 'request_received'
  | 'run_created'
  | 'run_completed'
  | 'run_failed'
  | 'retrying'
  | 'memory_list'
  | 'memory_search'
  | 'memory_read'
  | 'memory_write'
  | 'memory_promote'
  | 'artifact_recorded'
  | 'tool_running'
  | 'tool_completed'
  | 'tool_failed'
  | 'runtime_event'

export type RuntimeActivity = {
  id: string
  kind: RuntimeActivityKind
  label: RuntimeActivityLabel
  status: RuntimeActivityStatus
  detail?: string
  target?: string
  runId?: string | null
  skillId?: string | null
  toolName?: string | null
  createdAt?: string
  completedAt?: string
  technical?: Record<string, string>
}

export type RuntimeActivityOptions = {
  questRoot?: string | null
  limit?: number
  includeGenericTools?: boolean
}

type JsonRecord = Record<string, unknown>
type OperationItem = Extract<FeedItem, { type: 'operation' }>
type EventItem = Extract<FeedItem, { type: 'event' }>

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (!text) return value
  try {
    return JSON.parse(text)
  } catch {
    return value
  }
}

function unwrapPayload(value: unknown): unknown {
  let current: unknown = parseJson(value)

  for (let depth = 0; depth < 6; depth += 1) {
    const record = asRecord(current)
    if (!record) return current

    for (const key of ['structured_content', 'structured_result', 'structuredContent', 'structuredResult']) {
      if (record[key] !== undefined) {
        current = parseJson(record[key])
        break
      }
    }
    if (current !== record) continue

    if (Array.isArray(record.content)) {
      const textBlock = record.content.find((item) => {
        const itemRecord = asRecord(item)
        return typeof itemRecord?.text === 'string' && itemRecord.text.trim()
      })
      const text = asRecord(textBlock)?.text
      if (typeof text === 'string') {
        current = parseJson(text)
        continue
      }
    }

    if (record.result !== undefined && (record.result !== record || Object.keys(record).length <= 3)) {
      current = parseJson(record.result)
      continue
    }

    return record
  }

  return current
}

function payloadRecord(value: unknown): JsonRecord | null {
  return asRecord(unwrapPayload(value))
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
}

function firstText(record: JsonRecord | null, keys: string[]): string {
  if (!record) return ''
  for (const key of keys) {
    const value = textValue(record[key])
    if (value) return value
  }
  return ''
}

function numberValue(record: JsonRecord | null, keys: string[]): number | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value)
    }
  }
  return null
}

function compactText(value: unknown, limit = 132): string {
  const text = textValue(value).replace(/\s+/g, ' ')
  if (!text) return ''
  return text.length <= limit ? text : `${text.slice(0, Math.max(1, limit - 1))}…`
}

function compactPath(value: unknown, questRoot?: string | null): string {
  const raw = textValue(value).replace(/\\/g, '/')
  if (!raw) return ''
  const root = textValue(questRoot).replace(/\\/g, '/').replace(/\/$/, '')
  if (root && (raw === root || raw.startsWith(`${root}/`))) {
    return raw.slice(root.length).replace(/^\/+/, '') || '.'
  }
  if (!raw.startsWith('/')) return raw
  const parts = raw.split('/').filter(Boolean)
  return parts.slice(-3).join('/')
}

function parseTimestamp(value?: string) {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function eventRunId(item: EventItem): string | null {
  return item.runId?.trim() || textValue(item.data?.run_id) || null
}

function eventSkillId(item: EventItem): string | null {
  return item.skillId?.trim() || textValue(item.data?.skill_id) || null
}

function activityFromEvent(item: EventItem): RuntimeActivity | null {
  const label = item.label.trim().toLowerCase()
  const runId = eventRunId(item)
  const skillId = eventSkillId(item)
  const data = item.data ?? {}
  const technical = {
    ...(runId ? { run_id: runId } : {}),
    ...(skillId ? { skill: skillId } : {}),
  }

  if (label === 'run_started') {
    const model = textValue(data.model)
    return {
      id: item.id,
      kind: 'run',
      label: 'run_created',
      status: 'running',
      detail: [runId, skillId, model].filter(Boolean).join(' · '),
      runId,
      skillId,
      createdAt: item.createdAt,
      technical,
    }
  }

  if (label === 'run_finished') {
    const summary = compactText(data.summary || item.content)
    const exitCode = textValue(data.exit_code)
    return {
      id: item.id,
      kind: 'run',
      label: 'run_completed',
      status: 'completed',
      detail: [runId, exitCode ? `exit ${exitCode}` : '', summary].filter(Boolean).join(' · '),
      runId,
      skillId,
      createdAt: item.createdAt,
      technical: {
        ...technical,
        ...(exitCode ? { exit_code: exitCode } : {}),
      },
    }
  }

  if (label === 'run_failed') {
    return {
      id: item.id,
      kind: 'run',
      label: 'run_failed',
      status: 'failed',
      detail: [runId, compactText(data.summary || item.content)].filter(Boolean).join(' · '),
      runId,
      skillId,
      createdAt: item.createdAt,
      technical,
    }
  }

  if (label.includes('retry')) {
    const attempt = numberValue(data, ['attempt_index', 'next_attempt_index'])
    const maxAttempts = numberValue(data, ['max_attempts'])
    const attemptText = attempt != null ? (maxAttempts != null ? `${attempt}/${maxAttempts}` : String(attempt)) : ''
    return {
      id: item.id,
      kind: 'run',
      label: 'retrying',
      status: label.includes('exhausted') || label.includes('aborted') ? 'failed' : 'retrying',
      detail: [runId, attemptText, compactText(data.summary || data.failure_summary || item.content)].filter(Boolean).join(' · '),
      runId,
      skillId,
      createdAt: item.createdAt,
      technical: {
        ...technical,
        ...(attemptText ? { attempt: attemptText } : {}),
      },
    }
  }

  if (label.startsWith('quest_') && label !== 'quest_runtime_reconciled') {
    return {
      id: item.id,
      kind: 'runtime',
      label: 'runtime_event',
      status: item.status === 'failed' || label.includes('failed') ? 'failed' : 'completed',
      detail: compactText(data.summary || item.content),
      runId,
      skillId,
      createdAt: item.createdAt,
      technical,
    }
  }

  return null
}

function canonicalToolName(item: OperationItem): string {
  const toolName = textValue(item.toolName).toLowerCase()
  if (toolName) return toolName
  const server = textValue(item.mcpServer).toLowerCase()
  const tool = textValue(item.mcpTool).toLowerCase()
  return server && tool ? `${server}.${tool}` : tool || server
}

function operationStatus(item: RenderOperationFeedItem): RuntimeActivityStatus {
  const status = textValue(item.status).toLowerCase()
  if (status.includes('fail') || status.includes('error')) return 'failed'
  if (item.hasResult || item.label === 'tool_result') return 'completed'
  if (status.includes('queue') || status.includes('pending')) return 'queued'
  return 'running'
}

function scopeFrom(args: JsonRecord | null, output: JsonRecord | null): string {
  return firstText(args, ['scope']) || firstText(memoryRecord(output), ['scope']) || firstText(output, ['scope'])
}

function resultCount(output: JsonRecord | null): number | null {
  const count = numberValue(output, ['count', 'total', 'item_count'])
  if (count != null) return count
  return Array.isArray(output?.items) ? output.items.length : null
}

function operationTarget(
  args: JsonRecord | null,
  output: JsonRecord | null,
  questRoot?: string | null
): { target?: string; title?: string; kind?: string } {
  const result = memoryRecord(output)
  const metadata = asRecord(result?.metadata) || asRecord(output?.metadata)
  const promotedFrom = asRecord(metadata?.promoted_from) || asRecord(result?.promoted_from) || asRecord(output?.promoted_from)
  const path =
    firstText(result, ['path', 'artifact_path', 'file_path']) ||
    firstText(output, ['path', 'artifact_path', 'file_path']) ||
    firstText(args, ['path', 'file', 'filename']) ||
    firstText(promotedFrom, ['path'])
  return {
    target: compactPath(path, questRoot) || undefined,
    title: firstText(result, ['title']) || firstText(output, ['title']) || firstText(args, ['title']),
    kind: firstText(result, ['type', 'kind']) || firstText(output, ['type', 'kind']) || firstText(args, ['kind']),
  }
}

function memoryRecord(output: JsonRecord | null): JsonRecord | null {
  if (!output) return null
  return asRecord(output.record) || asRecord(output.card) || asRecord(output.memory) || output
}

function memoryId(args: JsonRecord | null, output: JsonRecord | null): string {
  const result = memoryRecord(output)
  return firstText(args, ['card_id', 'id']) || firstText(result, ['id', 'card_id']) || firstText(output, ['id', 'card_id'])
}

function memorySummary(args: JsonRecord | null, output: JsonRecord | null): string {
  const result = memoryRecord(output)
  return compactText(
    firstText(result, ['excerpt', 'summary', 'body']) ||
      firstText(output, ['excerpt', 'summary', 'body']) ||
      firstText(args, ['excerpt', 'summary', 'body']),
    132
  )
}

function memoryTags(args: JsonRecord | null, output: JsonRecord | null): string {
  const result = memoryRecord(output)
  const metadata = asRecord(result?.metadata) || asRecord(output?.metadata)
  const value = result?.tags ?? metadata?.tags ?? output?.tags ?? args?.tags
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(', ')
  return textValue(value)
}

function memoryResultTitles(output: JsonRecord | null): string {
  const items = Array.isArray(output?.items)
    ? output.items
    : Array.isArray(output?.results)
      ? output.results
      : []
  return items
    .slice(0, 3)
    .map((item) => firstText(asRecord(item), ['title', 'id']))
    .filter(Boolean)
    .join(', ')
}

function localOnlyFiles(output: JsonRecord | null): JsonRecord[] {
  const checkpoint = asRecord(output?.checkpoint)
  const values = Array.isArray(output?.excluded_large_files)
    ? output.excluded_large_files
    : Array.isArray(checkpoint?.excluded_large_files)
      ? checkpoint.excluded_large_files
      : []
  return values.map(asRecord).filter((item): item is JsonRecord => Boolean(item))
}

function activityFromOperation(
  item: RenderOperationFeedItem,
  questRoot?: string | null,
  includeGenericTools = true
): RuntimeActivity | null {
  const toolName = canonicalToolName(item)
  const args = payloadRecord(item.args)
  const output = payloadRecord(item.output)
  const status = operationStatus(item)
  const runId = item.runId || null
  const targetInfo = operationTarget(args, output, questRoot)
  const detailBase = [targetInfo.kind, targetInfo.title].filter(Boolean).join(' · ')
  const scope = scopeFrom(args, output)
  const count = resultCount(output)
  const countText = count != null ? `${count} item${count === 1 ? '' : 's'}` : ''
  const requestedLimit = firstText(args, ['limit'])
  const memoryName = toolName.startsWith('memory.') ? toolName.slice('memory.'.length) : ''

  if (memoryName === 'list_recent') {
    const resultTitles = memoryResultTitles(output)
    return {
      id: item.renderId || buildOperationIdentity(item),
      kind: 'memory',
      label: 'memory_list',
      status,
      detail: [scope && `scope ${scope}`, countText, resultTitles && `最近：${resultTitles}`, !item.hasResult && requestedLimit ? `limit ${requestedLimit}` : ''].filter(Boolean).join(' · '),
      target: targetInfo.target,
      runId,
      toolName,
      createdAt: item.createdAt,
      completedAt: item.completedAt,
      technical: { ...(runId ? { run_id: runId } : {}), tool: toolName },
    }
  }

  if (memoryName === 'search') {
    const query = firstText(args, ['query', 'q'])
    const resultTitles = memoryResultTitles(output)
    return {
      id: item.renderId || buildOperationIdentity(item),
      kind: 'memory',
      label: 'memory_search',
      status,
      detail: [query && `“${compactText(query, 72)}”`, scope && `scope ${scope}`, countText, resultTitles && `命中：${resultTitles}`].filter(Boolean).join(' · '),
      target: targetInfo.target,
      runId,
      toolName,
      createdAt: item.createdAt,
      completedAt: item.completedAt,
      technical: { ...(runId ? { run_id: runId } : {}), tool: toolName },
    }
  }

  if (memoryName === 'read') {
    const cardId = memoryId(args, output)
    const summary = memorySummary(args, output)
    return {
      id: item.renderId || buildOperationIdentity(item),
      kind: 'memory',
      label: 'memory_read',
      status,
      detail: [targetInfo.target, targetInfo.title, cardId && !targetInfo.target ? cardId : '', summary && `摘要：${summary}`].filter(Boolean).join(' · '),
      target: targetInfo.target,
      runId,
      toolName,
      createdAt: item.createdAt,
      completedAt: item.completedAt,
      technical: { ...(runId ? { run_id: runId } : {}), tool: toolName, ...(cardId ? { memory_id: cardId } : {}) },
    }
  }

  if (memoryName === 'write') {
    const target = targetInfo.target
    const cardId = memoryId(args, output)
    const summary = memorySummary(args, output)
    const tags = memoryTags(args, output)
    return {
      id: item.renderId || buildOperationIdentity(item),
      kind: 'memory',
      label: 'memory_write',
      status,
      detail: [detailBase, scope && `scope ${scope}`, target && `→ ${target}`, summary && `摘要：${summary}`, tags && `标签：${tags}`].filter(Boolean).join(' · '),
      target,
      runId,
      toolName,
      createdAt: item.createdAt,
      completedAt: item.completedAt,
      technical: {
        ...(runId ? { run_id: runId } : {}),
        tool: toolName,
        ...(cardId ? { memory_id: cardId } : {}),
        ...(target ? { path: target } : {}),
        ...(summary ? { summary } : {}),
        ...(tags ? { tags } : {}),
      },
    }
  }

  if (memoryName === 'promote_to_global') {
    const metadata = asRecord(output?.metadata)
    const promotedFrom = asRecord(metadata?.promoted_from) || asRecord(output?.promoted_from)
    const source = compactPath(firstText(promotedFrom, ['path']) || firstText(args, ['path']), questRoot)
    const target = targetInfo.target
    const cardId = memoryId(args, output)
    return {
      id: item.renderId || buildOperationIdentity(item),
      kind: 'memory',
      label: 'memory_promote',
      status,
      detail: [source && `${source} →`, target || 'global memory'].filter(Boolean).join(' '),
      target,
      runId,
      toolName,
      createdAt: item.createdAt,
      completedAt: item.completedAt,
      technical: {
        ...(runId ? { run_id: runId } : {}),
        tool: toolName,
        ...(source ? { from: source } : {}),
        ...(target ? { to: target } : {}),
        ...(cardId ? { memory_id: cardId } : {}),
      },
    }
  }

  const isArtifact = toolName.startsWith('artifact.')
  if (isArtifact) {
    const artifactTarget = targetInfo.target || compactPath(firstText(output, ['path']), questRoot)
    const localFiles = localOnlyFiles(output)
    const manifestPaths = Array.isArray(output?.weights_manifests)
      ? output.weights_manifests.map(textValue).filter(Boolean)
      : Array.isArray(asRecord(output?.checkpoint)?.weights_manifests)
        ? (asRecord(output?.checkpoint)?.weights_manifests as unknown[]).map(textValue).filter(Boolean)
        : []
    const localOnlyDetail = localFiles.length
      ? `local-only ${localFiles.length} large file${localFiles.length === 1 ? '' : 's'}`
      : ''
    return {
      id: item.renderId || buildOperationIdentity(item),
      kind: 'artifact',
      label: status === 'failed' ? 'tool_failed' : status === 'completed' ? 'artifact_recorded' : 'tool_running',
      status,
      detail: [toolName.replace(/^artifact\./, ''), detailBase, artifactTarget && `→ ${artifactTarget}`, localOnlyDetail, manifestPaths[0] && `manifest ${manifestPaths[0]}`].filter(Boolean).join(' · '),
      target: artifactTarget,
      runId,
      toolName,
      createdAt: item.createdAt,
      completedAt: item.completedAt,
      technical: {
        ...(runId ? { run_id: runId } : {}),
        tool: toolName,
        ...(artifactTarget ? { path: artifactTarget } : {}),
        ...(localFiles.length
          ? { local_only_files: localFiles.map((item) => firstText(item, ['path'])).filter(Boolean).join(', ') }
          : {}),
        ...(manifestPaths.length ? { weights_manifest: manifestPaths.join(', ') } : {}),
      },
    }
  }

  if (!includeGenericTools) return null
  return {
    id: item.renderId || buildOperationIdentity(item),
    kind: 'tool',
    label: status === 'failed' ? 'tool_failed' : status === 'completed' ? 'tool_completed' : 'tool_running',
    status,
    detail: [toolName || 'tool', item.subject || ''].filter(Boolean).join(' · '),
    target: item.subject || undefined,
    runId,
    toolName,
    createdAt: item.createdAt,
    completedAt: item.completedAt,
    technical: { ...(runId ? { run_id: runId } : {}), ...(toolName ? { tool: toolName } : {}) },
  }
}

function activityFromArtifact(item: Extract<FeedItem, { type: 'artifact' }>, questRoot?: string | null): RuntimeActivity {
  const path = item.artifactPath || Object.values(item.paths ?? {}).find(Boolean) || ''
  return {
    id: item.id,
    kind: 'artifact',
    label: 'artifact_recorded',
    status: item.status === 'failed' ? 'failed' : 'completed',
    detail: [item.kind, compactPath(path, questRoot), compactText(item.content, 96)].filter(Boolean).join(' · '),
    target: compactPath(path, questRoot) || undefined,
    createdAt: item.createdAt,
    technical: {
      ...(item.kind ? { kind: item.kind } : {}),
      ...(path ? { path: compactPath(path, questRoot) } : {}),
    },
  }
}

function activityFromUserMessage(item: Extract<FeedItem, { type: 'message' }>): RuntimeActivity | null {
  if (item.role !== 'user' || item.reasoning || !item.content.trim()) return null
  return {
    id: `${item.id}:request`,
    kind: 'request',
    label: 'request_received',
    status: 'completed',
    detail: compactText(item.content, 112),
    runId: item.runId,
    skillId: item.skillId,
    createdAt: item.createdAt,
    technical: {
      ...(item.runId ? { run_id: item.runId } : {}),
      ...(item.skillId ? { skill: item.skillId } : {}),
    },
  }
}

export function buildRuntimeActivities(
  feed: FeedItem[],
  options: RuntimeActivityOptions = {}
): RuntimeActivity[] {
  const activities: RuntimeActivity[] = []
  const includeGenericTools = options.includeGenericTools ?? true

  for (const item of feed) {
    if (item.type === 'message') {
      const activity = activityFromUserMessage(item)
      if (activity) activities.push(activity)
    } else if (item.type === 'event') {
      const activity = activityFromEvent(item)
      if (activity) activities.push(activity)
    } else if (item.type === 'artifact') {
      activities.push(activityFromArtifact(item, options.questRoot))
    }
  }

  for (const item of mergeFeedItemsForRender(feed)) {
    if (item.type !== 'operation') continue
    const activity = activityFromOperation(item, options.questRoot, includeGenericTools)
    if (activity) activities.push(activity)
  }

  const ordered = activities
    .map((activity, index) => ({ activity, index }))
    .sort((left, right) => {
      const leftTime = parseTimestamp(left.activity.createdAt)
      const rightTime = parseTimestamp(right.activity.createdAt)
      if (leftTime == null && rightTime == null) return left.index - right.index
      if (leftTime == null) return -1
      if (rightTime == null) return 1
      return leftTime - rightTime || left.index - right.index
    })
    .map(({ activity }) => activity)

  const limit = Math.max(1, Math.floor(options.limit ?? 10))
  return ordered.slice(-limit)
}

export function runtimeActivityLatestStatus(activities: RuntimeActivity[]): RuntimeActivityStatus | null {
  return activities.length > 0 ? activities[activities.length - 1].status : null
}

export function runtimeActivityStatusIsActive(status: RuntimeActivityStatus) {
  return status === 'running' || status === 'queued' || status === 'retrying'
}

export function runtimeActivityQuestRoot(snapshot?: QuestSummary | null) {
  return snapshot?.quest_root || null
}
