'use client'

import {
  AlertTriangle,
  ArrowRightLeft,
  Bot,
  FileText,
  GitBranch,
  Globe,
  Milestone,
  Route,
  Sparkles,
} from 'lucide-react'
import type { ToolViewProps } from './types'
import { DsToolFrame, DsToolPill, DsToolSection } from './DsToolFrame'
import {
  asBoolean,
  asNumber,
  asRecord,
  asString,
  asStringArray,
  extractPathEntries,
  getToolArgsRecord,
  getToolResultRecord,
  getToolResultValue,
  resolveMcpIdentity,
  truncateText,
} from './mcp-view-utils'

function formatDate(value?: string) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

function renderRawDetails(value: unknown) {
  if (value == null) return null
  let raw = ''
  if (typeof value === 'string') {
    raw = value
  } else {
    try {
      raw = JSON.stringify(value, null, 2)
    } catch {
      raw = String(value)
    }
  }
  if (!raw.trim()) return null
  return (
    <details className="rounded-[12px] border border-[var(--border-light)] bg-[rgba(255,255,255,0.62)] px-3 py-2">
      <summary className="cursor-pointer text-[11px] font-medium text-[var(--text-secondary)]">Raw payload</summary>
      <pre className="mt-3 overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-6 text-[var(--text-primary)]">
        {raw}
      </pre>
    </details>
  )
}

function renderPathList(paths: Array<{ label: string; path: string }>) {
  if (paths.length === 0) return null
  return (
    <DsToolSection title="Paths" compact>
      <div className="space-y-2">
        {paths.map((entry) => (
          <div key={`${entry.label}:${entry.path}`} className="rounded-[10px] bg-[rgba(255,255,255,0.72)] px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              {entry.label}
            </div>
            <div className="mt-1 break-all font-mono text-[11px] text-[var(--text-primary)]">{entry.path}</div>
          </div>
        ))}
      </div>
    </DsToolSection>
  )
}

function renderBulletList(items: string[]) {
  if (items.length === 0) return null
  return (
    <div className="space-y-1.5">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-2 text-[12px] leading-6 text-[var(--text-secondary)]">
          <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-[rgba(122,114,151,0.65)]" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  )
}

function renderArtifactRecord(tool: string | undefined, resultRecord: Record<string, unknown> | null, args: Record<string, unknown>) {
  const record = asRecord(resultRecord?.record) ?? asRecord(args.payload) ?? resultRecord
  if (!record) return null
  const kind = asString(record.kind) || asString(resultRecord?.recorded) || 'artifact'
  const summary = asString(record.summary) || asString(record.message) || asString(record.reason)
  const reason = asString(record.reason)
  const guidance = asString(resultRecord?.guidance) || asString(record.guidance)
  const recommendedSkillReads = asStringArray(resultRecord?.recommended_skill_reads)
  const suggestedArtifactCalls = Array.isArray(resultRecord?.suggested_artifact_calls)
    ? resultRecord?.suggested_artifact_calls
        .map((entry) => asRecord(entry))
        .filter((entry): entry is NonNullable<ReturnType<typeof asRecord>> => Boolean(entry))
        .map((entry) => {
          const name = asString(entry.name)
          const purpose = asString(entry.purpose)
          return [name, purpose].filter(Boolean).join(' — ')
        })
    : []
  const status = asString(record.status)
  const artifactId = asString(record.artifact_id) || asString(record.id)
  const metricSummary = asRecord(record.metrics_summary)
  const metrics = metricSummary
    ? Object.entries(metricSummary)
        .map(([key, value]) => `${key}: ${typeof value === 'number' ? value.toFixed(4) : String(value)}`)
        .slice(0, 6)
    : []
  const options = Array.isArray(record.options)
    ? record.options
        .map((entry) => asRecord(entry))
        .filter((entry): entry is NonNullable<ReturnType<typeof asRecord>> => Boolean(entry))
        .map((entry) => {
          const label = asString(entry.label) || asString(entry.id)
          const description = asString(entry.description)
          return [label, description].filter(Boolean).join(' — ')
        })
    : []
  const paths = extractPathEntries(record)
  const registryEntry = asRecord(resultRecord?.baseline_registry_entry)

  return (
    <>
      <DsToolSection title="Artifact">
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            <DsToolPill>{tool === 'publish_baseline' ? 'publish_baseline' : 'record'}</DsToolPill>
            {kind ? <DsToolPill tone="muted">{kind}</DsToolPill> : null}
            {status ? <DsToolPill tone={status === 'completed' || status === 'generated' ? 'success' : 'default'}>{status}</DsToolPill> : null}
            {artifactId ? <DsToolPill tone="muted">{artifactId}</DsToolPill> : null}
          </div>
          {summary ? <div className="text-[12px] leading-6 text-[var(--text-primary)]">{summary}</div> : null}
          {reason ? (
            <div className="rounded-[12px] bg-[rgba(255,255,255,0.68)] px-3 py-3 text-[12px] leading-6 text-[var(--text-secondary)]">
              {reason}
            </div>
          ) : null}
          {guidance ? (
            <div className="flex items-start gap-2 rounded-[12px] border border-[var(--border-light)] bg-[rgba(255,255,255,0.68)] px-3 py-3 text-[12px] text-[var(--text-secondary)]">
              <Route className="mt-0.5 h-4 w-4 text-[#7a7297]" />
              <span>{guidance}</span>
            </div>
          ) : null}
          {recommendedSkillReads.length > 0 || suggestedArtifactCalls.length > 0 ? (
            <div className="rounded-[12px] bg-[rgba(255,255,255,0.62)] px-3 py-3 text-[12px] leading-6 text-[var(--text-secondary)]">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 text-[#7a7297]" />
                <div className="space-y-2">
                  {recommendedSkillReads.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-medium text-[var(--text-tertiary)]">Read:</span>
                      {recommendedSkillReads.map((skill) => (
                        <DsToolPill key={skill} tone="muted">
                          {skill}
                        </DsToolPill>
                      ))}
                    </div>
                  ) : null}
                  {suggestedArtifactCalls.length > 0 ? (
                    <div>
                      <div className="text-[11px] font-medium text-[var(--text-tertiary)]">Suggested calls:</div>
                      <div className="mt-2">{renderBulletList(suggestedArtifactCalls)}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </DsToolSection>
      {metrics.length > 0 ? <DsToolSection title="Metrics">{renderBulletList(metrics)}</DsToolSection> : null}
      {options.length > 0 ? <DsToolSection title="Options">{renderBulletList(options)}</DsToolSection> : null}
      {registryEntry ? (
        <DsToolSection title="Registry entry">
          <div className="space-y-2 text-[12px] leading-6 text-[var(--text-secondary)]">
            {asString(registryEntry.baseline_id) ? (
              <div>
                Baseline: <span className="font-medium text-[var(--text-primary)]">{asString(registryEntry.baseline_id)}</span>
              </div>
            ) : null}
            {asString(registryEntry.default_variant_id) ? (
              <div>
                Default variant:{' '}
                <span className="font-medium text-[var(--text-primary)]">{asString(registryEntry.default_variant_id)}</span>
              </div>
            ) : null}
            {asString(registryEntry.summary) ? <div>{asString(registryEntry.summary)}</div> : null}
          </div>
        </DsToolSection>
      ) : null}
      {renderPathList(paths)}
    </>
  )
}

function renderCheckpoint(resultRecord: Record<string, unknown> | null, args: Record<string, unknown>) {
  const message = asString(resultRecord?.message) || asString(args.message)
  const branch = asString(resultRecord?.branch)
  const head = asString(resultRecord?.head) || asString(resultRecord?.commit)
  return (
    <>
      <DsToolSection title="Checkpoint">
        <div className="space-y-2 text-[12px] leading-6 text-[var(--text-secondary)]">
          {message ? <div className="font-medium text-[var(--text-primary)]">{message}</div> : null}
          {branch ? <div>Branch: <span className="font-mono text-[11px] text-[var(--text-primary)]">{branch}</span></div> : null}
          {head ? <div>Head: <span className="font-mono text-[11px] text-[var(--text-primary)]">{head}</span></div> : null}
        </div>
      </DsToolSection>
    </>
  )
}

function renderPrepareBranch(resultRecord: Record<string, unknown> | null) {
  const branch = asString(resultRecord?.branch)
  const parentBranch = asString(resultRecord?.parent_branch)
  const startPoint = asString(resultRecord?.start_point)
  const worktreeRoot = asString(resultRecord?.worktree_root)
  return (
    <>
      <DsToolSection title="Branch plan">
        <div className="space-y-2 text-[12px] leading-6 text-[var(--text-secondary)]">
          {branch ? (
            <div className="flex items-center gap-2 text-[var(--text-primary)]">
              <GitBranch className="h-4 w-4 text-[#7a7297]" />
              <span className="font-medium">{branch}</span>
            </div>
          ) : null}
          {parentBranch ? <div>Parent: <span className="font-mono text-[11px] text-[var(--text-primary)]">{parentBranch}</span></div> : null}
          {startPoint ? <div>Start point: <span className="font-mono text-[11px] text-[var(--text-primary)]">{startPoint}</span></div> : null}
          {worktreeRoot ? <div>Worktree: <span className="break-all font-mono text-[11px] text-[var(--text-primary)]">{worktreeRoot}</span></div> : null}
        </div>
      </DsToolSection>
      {renderPathList(worktreeRoot ? [{ label: 'worktree_root', path: worktreeRoot }] : [])}
    </>
  )
}

function renderActivateBranch(resultRecord: Record<string, unknown> | null) {
  const branch = asString(resultRecord?.branch)
  const worktreeRoot = asString(resultRecord?.worktree_root)
  const ideaId = asString(resultRecord?.idea_id)
  const latestMainRunId = asString(resultRecord?.latest_main_run_id)
  const nextAnchor = asString(resultRecord?.next_anchor)
  const workspaceMode = asString(resultRecord?.workspace_mode)
  const promoteToHead = asBoolean(resultRecord?.promote_to_head)
  const worktreeCreated = asBoolean(resultRecord?.worktree_created)
  const artifactRecord = asRecord(asRecord(resultRecord?.artifact)?.record) ?? asRecord(resultRecord?.artifact)
  const summary = asString(artifactRecord?.summary)
  const reason = asString(artifactRecord?.reason)
  const paths = extractPathEntries({
    paths: {
      worktree_root: worktreeRoot,
      idea_md: asString(resultRecord?.idea_md_path),
      idea_draft_md: asString(resultRecord?.idea_draft_path),
    },
  })

  return (
    <>
      <DsToolSection title="Active workspace">
        <div className="space-y-2.5 text-[12px] leading-6 text-[var(--text-secondary)]">
          {branch ? (
            <div className="flex items-center gap-2 text-[var(--text-primary)]">
              <GitBranch className="h-4 w-4 text-[#7a7297]" />
              <span className="font-medium">{branch}</span>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {workspaceMode ? <DsToolPill>{workspaceMode} workspace</DsToolPill> : null}
            {nextAnchor ? <DsToolPill tone="muted">next: {nextAnchor}</DsToolPill> : null}
            {promoteToHead != null ? (
              <DsToolPill tone={promoteToHead ? 'success' : 'muted'}>
                {promoteToHead ? 'promoted to head' : 'head unchanged'}
              </DsToolPill>
            ) : null}
            {worktreeCreated != null ? (
              <DsToolPill tone={worktreeCreated ? 'success' : 'muted'}>
                {worktreeCreated ? 'created worktree' : 'reused worktree'}
              </DsToolPill>
            ) : null}
          </div>
          {summary ? <div className="text-[var(--text-primary)]">{summary}</div> : null}
          {reason ? (
            <div className="rounded-[12px] bg-[rgba(255,255,255,0.68)] px-3 py-3">
              {reason}
            </div>
          ) : null}
          {ideaId ? (
            <div>
              Active idea: <span className="font-medium text-[var(--text-primary)]">{ideaId}</span>
            </div>
          ) : null}
          {latestMainRunId ? (
            <div>
              Latest main run: <span className="font-medium text-[var(--text-primary)]">{latestMainRunId}</span>
            </div>
          ) : null}
          {worktreeRoot ? (
            <div>
              Worktree: <span className="break-all font-mono text-[11px] text-[var(--text-primary)]">{worktreeRoot}</span>
            </div>
          ) : null}
        </div>
      </DsToolSection>
      {renderPathList(paths)}
    </>
  )
}

function renderAttachBaseline(resultRecord: Record<string, unknown> | null) {
  const attachment = asRecord(resultRecord?.attachment)
  if (!attachment) return null
  const entry = asRecord(attachment.entry)
  const variant = asRecord(attachment.selected_variant)
  const baselineId = asString(attachment.source_baseline_id) || asString(entry?.baseline_id)
  const variantId = asString(attachment.source_variant_id) || asString(variant?.variant_id)
  const summary = asString(entry?.summary)
  return (
    <DsToolSection title="Attached baseline">
      <div className="space-y-2 text-[12px] leading-6 text-[var(--text-secondary)]">
        {baselineId ? <div>Baseline: <span className="font-medium text-[var(--text-primary)]">{baselineId}</span></div> : null}
        {variantId ? <div>Variant: <span className="font-medium text-[var(--text-primary)]">{variantId}</span></div> : null}
        {summary ? <div>{summary}</div> : null}
      </div>
    </DsToolSection>
  )
}

function renderArxiv(resultRecord: Record<string, unknown> | null, args: Record<string, unknown>) {
  const mode = asString(resultRecord?.mode) || asString(args.mode) || 'read'
  if (mode === 'list') {
    const items = Array.isArray(resultRecord?.items)
      ? resultRecord.items
          .map((entry) => asRecord(entry))
          .filter((entry): entry is NonNullable<ReturnType<typeof asRecord>> => Boolean(entry))
      : []
    const count = typeof resultRecord?.count === 'number' ? resultRecord.count : items.length

    return (
      <>
        <DsToolSection title="Saved arXiv papers">
          <div className="space-y-2 text-[12px] leading-6 text-[var(--text-secondary)]">
            <div>
              Count: <span className="font-medium text-[var(--text-primary)]">{count}</span>
            </div>
            {items.length === 0 ? (
              <div>No saved arXiv papers yet.</div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div
                    key={`${asString(item.arxiv_id) || index}`}
                    className="rounded-[12px] border border-[var(--border-light)] bg-[rgba(255,255,255,0.76)] px-3 py-3"
                  >
                    <div className="text-[12px] font-medium text-[var(--text-primary)]">
                      {asString(item.title) || asString(item.arxiv_id) || `Paper ${index + 1}`}
                    </div>
                    {asString(item.arxiv_id) ? (
                      <div className="mt-1 text-[11px] font-mono text-[var(--text-tertiary)]">
                        {asString(item.arxiv_id)}
                      </div>
                    ) : null}
                    {asString(item.abstract) ? (
                      <div className="mt-2 text-[12px] leading-6 text-[var(--text-secondary)]">
                        {truncateText(asString(item.abstract), 320)}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DsToolSection>
      </>
    )
  }

  const paperId = asString(resultRecord?.paper_id) || asString(args.paper_id)
  const title = asString(resultRecord?.title) || paperId || 'arXiv paper'
  const source = asString(resultRecord?.source)
  const contentMode = asString(resultRecord?.content_mode)
  const content = asString(resultRecord?.content)
  const sourceUrl = asString(resultRecord?.source_url)
  const authors = Array.isArray(resultRecord?.authors)
    ? resultRecord?.authors.map((item) => String(item)).filter(Boolean)
    : []
  const attempts = Array.isArray(resultRecord?.attempts)
    ? resultRecord?.attempts
        .map((entry) => asRecord(entry))
        .filter((entry): entry is NonNullable<ReturnType<typeof asRecord>> => Boolean(entry))
        .map((entry) => {
          const label = asString(entry.source)
          const status = asBoolean(entry.ok) === false ? 'failed' : asBoolean(entry.ok) === true ? 'ok' : undefined
          const error = asString(entry.error)
          return [label, status, error].filter(Boolean).join(' — ')
        })
    : []

  return (
    <>
      <DsToolSection title="Paper">
        <div className="space-y-2 text-[12px] leading-6 text-[var(--text-secondary)]">
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <Globe className="h-4 w-4 text-[#6382ad]" />
            <span className="font-medium">{title}</span>
          </div>
          {paperId ? <div>Paper id: <span className="font-mono text-[11px] text-[var(--text-primary)]">{paperId}</span></div> : null}
          {contentMode ? <div>Mode: <span className="font-medium text-[var(--text-primary)]">{contentMode}</span></div> : null}
          {source ? <div>Source: <span className="font-medium text-[var(--text-primary)]">{source}</span></div> : null}
          {sourceUrl ? <div className="break-all text-[11px] text-[var(--text-primary)]">{sourceUrl}</div> : null}
          {authors.length > 0 ? <div>{authors.join(', ')}</div> : null}
        </div>
      </DsToolSection>
      {content ? (
        <DsToolSection title="Preview">
          <div className="whitespace-pre-wrap text-[12px] leading-6 text-[var(--text-secondary)]">
            {truncateText(content, 1400)}
          </div>
        </DsToolSection>
      ) : null}
      {attempts.length > 0 ? <DsToolSection title="Fetch attempts">{renderBulletList(attempts)}</DsToolSection> : null}
    </>
  )
}

function renderRefreshSummary(resultRecord: Record<string, unknown> | null, args: Record<string, unknown>) {
  const summaryPath = asString(resultRecord?.summary_path)
  const reason = asString(args.reason)
  return (
    <>
      <DsToolSection title="Summary refresh">
        <div className="space-y-2 text-[12px] leading-6 text-[var(--text-secondary)]">
          {reason ? <div>Reason: {reason}</div> : null}
          {summaryPath ? <div className="break-all font-mono text-[11px] text-[var(--text-primary)]">{summaryPath}</div> : null}
        </div>
      </DsToolSection>
      {renderPathList(summaryPath ? [{ label: 'summary_md', path: summaryPath }] : [])}
    </>
  )
}

function renderGitGraph(resultRecord: Record<string, unknown> | null) {
  const graph = asRecord(resultRecord?.graph)
  if (!graph) return null
  const branch = asString(graph.branch)
  const head = asString(graph.head)
  const commitCount = asArrayLikeCount(graph.lines)
  const paths = extractPathEntries({
    paths: {
      json: asString(graph.json_path),
      svg: asString(graph.svg_path),
      png: asString(graph.png_path),
    },
  })
  return (
    <>
      <DsToolSection title="Graph export">
        <div className="space-y-2 text-[12px] leading-6 text-[var(--text-secondary)]">
          {branch ? <div>Branch: <span className="font-medium text-[var(--text-primary)]">{branch}</span></div> : null}
          {head ? <div>Head: <span className="font-mono text-[11px] text-[var(--text-primary)]">{head}</span></div> : null}
          {commitCount != null ? <div>Commits rendered: <span className="font-medium text-[var(--text-primary)]">{commitCount}</span></div> : null}
        </div>
      </DsToolSection>
      {renderPathList(paths)}
    </>
  )
}

function asArrayLikeCount(value: unknown) {
  return Array.isArray(value) ? value.length : undefined
}

function renderConnectorDelivery(resultRecord: Record<string, unknown> | null) {
  const deliveryTargets = asStringArray(resultRecord?.delivery_targets)
  const deliveryPolicy = asString(resultRecord?.delivery_policy)
  const preferredConnector = asString(resultRecord?.preferred_connector)
  const delivered = asBoolean(resultRecord?.delivered)
  const openRequestCount = asNumber(resultRecord?.open_request_count)
  const attachmentKinds = Array.isArray(resultRecord?.normalized_attachments)
    ? resultRecord.normalized_attachments
        .map((entry) => asRecord(entry))
        .filter((entry): entry is NonNullable<ReturnType<typeof asRecord>> => Boolean(entry))
        .map((entry) => asString(entry.kind))
        .filter(Boolean)
    : []

  if (
    deliveryTargets.length === 0 &&
    !deliveryPolicy &&
    !preferredConnector &&
    delivered == null &&
    openRequestCount == null &&
    attachmentKinds.length === 0
  ) {
    return null
  }

  return (
    <DsToolSection title="Connector delivery">
      <div className="space-y-2 text-[12px] leading-6 text-[var(--text-secondary)]">
        <div className="flex flex-wrap gap-1.5">
          {delivered != null ? (
            <DsToolPill tone={delivered ? 'success' : 'warning'}>
              {delivered ? 'delivered' : 'not delivered'}
            </DsToolPill>
          ) : null}
          {deliveryPolicy ? <DsToolPill tone="muted">{deliveryPolicy}</DsToolPill> : null}
          {preferredConnector ? <DsToolPill tone="muted">{preferredConnector}</DsToolPill> : null}
          {openRequestCount != null ? <DsToolPill tone="muted">{openRequestCount} open requests</DsToolPill> : null}
        </div>
        {deliveryTargets.length > 0 ? <div>Delivered to: {deliveryTargets.join(', ')}</div> : null}
        {attachmentKinds.length > 0 ? <div>Attachments: {attachmentKinds.join(', ')}</div> : null}
      </div>
    </DsToolSection>
  )
}

function renderInteract(resultRecord: Record<string, unknown> | null, args: Record<string, unknown>) {
  const message = asString(resultRecord?.agent_instruction) || asString(args.message)
  const replyMode = asString(resultRecord?.reply_mode) || asString(args.reply_mode)
  const expectsReply = asBoolean(resultRecord?.expects_reply)
  const deliveryTargets = asStringArray(resultRecord?.delivery_targets)
  const recentInbound = Array.isArray(resultRecord?.recent_inbound_messages)
    ? resultRecord?.recent_inbound_messages
        .map((entry) => asRecord(entry))
        .filter((entry): entry is NonNullable<ReturnType<typeof asRecord>> => Boolean(entry))
    : []
  const options = Array.isArray(args.options)
    ? args.options
        .map((entry) => asRecord(entry))
        .filter((entry): entry is NonNullable<ReturnType<typeof asRecord>> => Boolean(entry))
    : []
  return (
    <>
      <DsToolSection title="Interaction">
        <div className="space-y-2 text-[12px] leading-6 text-[var(--text-secondary)]">
          {message ? (
            <div className="flex items-start gap-2">
              <Bot className="mt-0.5 h-4 w-4 text-[#7a7297]" />
              <span>{message}</span>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {replyMode ? <DsToolPill>{replyMode}</DsToolPill> : null}
            {expectsReply != null ? <DsToolPill tone={expectsReply ? 'warning' : 'success'}>{expectsReply ? 'expects reply' : 'no reply needed'}</DsToolPill> : null}
            {typeof resultRecord?.open_request_count === 'number' ? (
              <DsToolPill tone="muted">{resultRecord.open_request_count} open requests</DsToolPill>
            ) : null}
          </div>
          {deliveryTargets.length > 0 ? <div>Delivered to: {deliveryTargets.join(', ')}</div> : null}
        </div>
      </DsToolSection>
      {options.length > 0 ? (
        <DsToolSection title="Options">
          {renderBulletList(
            options.map((entry) => {
              const label = asString(entry.label) || asString(entry.id)
              const description = asString(entry.description)
              return [label, description].filter(Boolean).join(' — ')
            })
          )}
        </DsToolSection>
      ) : null}
      {recentInbound.length > 0 ? (
        <DsToolSection title="Recent inbound">
          <div className="space-y-2.5">
            {recentInbound.map((entry, index) => (
              <div
                key={`${asString(entry.message_id) ?? index}`}
                className="rounded-[12px] border border-[var(--border-light)] bg-[rgba(255,255,255,0.76)] px-3 py-3"
              >
                <div className="flex items-center justify-between gap-3 text-[10px] text-[var(--text-tertiary)]">
                  <span>{asString(entry.conversation_id) || 'conversation'}</span>
                  {asString(entry.created_at) ? <span>{formatDate(asString(entry.created_at))}</span> : null}
                </div>
                <div className="mt-2 text-[12px] leading-6 text-[var(--text-primary)]">
                  {asString(entry.text) || asString(entry.content) || 'No text provided.'}
                </div>
              </div>
            ))}
          </div>
        </DsToolSection>
      ) : null}
    </>
  )
}

export function McpArtifactToolView({ toolContent }: ToolViewProps) {
  const { tool } = resolveMcpIdentity(toolContent)
  const args = getToolArgsRecord(toolContent)
  const resultRecord = getToolResultRecord(toolContent)
  const resultValue = getToolResultValue(toolContent)
  const error =
    asString((toolContent.content as Record<string, unknown> | undefined)?.error) || asString(resultRecord?.error)
  const active = toolContent.status === 'calling'
  const arxivMode = asString(resultRecord?.mode) || asString(args.mode) || 'read'

  const titleMap: Record<string, string> = {
    record: active ? 'DeepScientist is recording artifact...' : 'DeepScientist recorded artifact.',
    checkpoint: active ? 'DeepScientist is creating checkpoint...' : 'DeepScientist created checkpoint.',
    prepare_branch: active ? 'DeepScientist is preparing branch...' : 'DeepScientist prepared branch.',
    activate_branch: active ? 'DeepScientist is activating branch...' : 'DeepScientist activated branch.',
    publish_baseline: active ? 'DeepScientist is publishing baseline...' : 'DeepScientist published baseline.',
    attach_baseline: active ? 'DeepScientist is attaching baseline...' : 'DeepScientist attached baseline.',
    confirm_baseline: active ? 'DeepScientist is confirming baseline...' : 'DeepScientist confirmed baseline.',
    waive_baseline: active ? 'DeepScientist is waiving baseline...' : 'DeepScientist waived baseline.',
    submit_idea: active ? 'DeepScientist is submitting idea...' : 'DeepScientist submitted idea.',
    record_main_experiment: active ? 'DeepScientist is recording main experiment...' : 'DeepScientist recorded main experiment.',
    create_analysis_campaign: active ? 'DeepScientist is creating analysis campaign...' : 'DeepScientist created analysis campaign.',
    record_analysis_slice: active ? 'DeepScientist is recording analysis slice...' : 'DeepScientist recorded analysis slice.',
    arxiv: active ? 'DeepScientist is reading arXiv paper...' : 'DeepScientist read arXiv paper.',
    refresh_summary: active ? 'DeepScientist is refreshing summary...' : 'DeepScientist refreshed summary.',
    render_git_graph: active ? 'DeepScientist is rendering git graph...' : 'DeepScientist rendered git graph.',
    interact: active ? 'DeepScientist is sending interaction...' : 'DeepScientist sent interaction.',
  }

  const accent =
    tool === 'arxiv'
      ? 'blue'
      : tool === 'publish_baseline' || tool === 'attach_baseline'
        ? 'amber'
        : tool === 'interact'
          ? 'sage'
          : 'violet'

  const subtitleMap: Record<string, string> = {
    checkpoint: 'Git-backed checkpoints keep quest state durable and reviewable.',
    prepare_branch: 'Branches and worktrees isolate experiment routes without losing context.',
    activate_branch: 'Returning to a durable research branch should also sync the active workspace and connector context.',
    render_git_graph: 'Graph exports make quest lineage visible across branches and runs.',
  }

  const toolLabel = tool || 'artifact'
  const embeddedArtifact = asRecord(asRecord(resultRecord?.artifact)?.record) ?? asRecord(resultRecord?.artifact)
  const recordSummary =
    asString(resultRecord?.guidance) ||
    asString((asRecord(resultRecord?.record) ?? embeddedArtifact ?? resultRecord)?.summary)
  const nestedInteraction = toolLabel === 'interact' ? null : asRecord(resultRecord?.interaction)

  return (
    <div className="flex flex-col gap-3">
      <DsToolFrame
        title={
          toolLabel === 'arxiv' && arxivMode === 'list'
            ? active
              ? 'DeepScientist is listing saved arXiv papers...'
              : 'DeepScientist listed the saved arXiv papers.'
            : titleMap[toolLabel] || (active ? 'DeepScientist is updating artifact...' : 'DeepScientist updated artifact.')
        }
        subtitle={recordSummary || subtitleMap[toolLabel] || 'Artifact tools persist branch, report, baseline, and interaction state.'}
        accent={accent}
        meta={
          <>
            <DsToolPill>{toolLabel}</DsToolPill>
            {asString(resultRecord?.status) ? <DsToolPill tone="muted">{asString(resultRecord?.status)}</DsToolPill> : null}
            {asString((asRecord(resultRecord?.record) ?? resultRecord)?.kind) ? (
              <DsToolPill tone="muted">{asString((asRecord(resultRecord?.record) ?? resultRecord)?.kind)}</DsToolPill>
            ) : null}
          </>
        }
      >
        {error ? (
          <div className="ds-tool-error-banner" role="status">
            <AlertTriangle className="ds-tool-error-icon" />
            <span>{error}</span>
          </div>
        ) : null}

        {tool === 'record' || tool === 'publish_baseline' ? renderArtifactRecord(tool, resultRecord, args) : null}
        {tool === 'checkpoint' ? renderCheckpoint(resultRecord, args) : null}
        {tool === 'prepare_branch' ? renderPrepareBranch(resultRecord) : null}
        {tool === 'activate_branch' ? renderActivateBranch(resultRecord) : null}
        {tool === 'attach_baseline' ? renderAttachBaseline(resultRecord) : null}
        {tool === 'arxiv' ? renderArxiv(resultRecord, args) : null}
        {tool === 'refresh_summary' ? renderRefreshSummary(resultRecord, args) : null}
        {tool === 'render_git_graph' ? renderGitGraph(resultRecord) : null}
        {tool === 'interact' ? renderInteract(resultRecord, args) : null}

        {tool &&
        ['submit_idea', 'record_main_experiment', 'create_analysis_campaign', 'confirm_baseline', 'waive_baseline', 'record_analysis_slice'].includes(
          tool
        ) &&
        asRecord(resultRecord?.artifact)
          ? renderArtifactRecord('record', asRecord(resultRecord?.artifact), args)
          : null}

        {tool === 'attach_baseline' && resultRecord?.artifact ? (
          <DsToolSection title="Follow-up artifact">
            <div className="flex items-start gap-2 text-[12px] leading-6 text-[var(--text-secondary)]">
              <ArrowRightLeft className="mt-0.5 h-4 w-4 text-[#977a42]" />
              <span>{asString(asRecord(asRecord(resultRecord.artifact)?.record)?.summary) || 'Baseline attachment created a durable report artifact.'}</span>
            </div>
          </DsToolSection>
        ) : null}

        {nestedInteraction ? renderConnectorDelivery(nestedInteraction) : null}

        {tool === 'render_git_graph' && resultRecord?.guidance ? (
          <DsToolSection title="Why this helps" compact>
            <div className="flex items-start gap-2 text-[12px] leading-6 text-[var(--text-secondary)]">
              <Milestone className="mt-0.5 h-4 w-4 text-[#7a7297]" />
              <span>{asString(resultRecord?.guidance)}</span>
            </div>
          </DsToolSection>
        ) : null}

        {tool === 'checkpoint' && asString(resultRecord?.guidance) ? (
          <DsToolSection title="Next step" compact>
            <div className="flex items-start gap-2 text-[12px] leading-6 text-[var(--text-secondary)]">
              <Sparkles className="mt-0.5 h-4 w-4 text-[#7a7297]" />
              <span>{asString(resultRecord?.guidance)}</span>
            </div>
          </DsToolSection>
        ) : null}

        {tool === 'prepare_branch' && resultRecord?.artifact ? (
          <DsToolSection title="Decision artifact" compact>
            <div className="flex items-start gap-2 text-[12px] leading-6 text-[var(--text-secondary)]">
              <FileText className="mt-0.5 h-4 w-4 text-[#7a7297]" />
              <span>{asString(asRecord(asRecord(resultRecord.artifact)?.record)?.reason) || 'The branch preparation is also persisted as a decision artifact.'}</span>
            </div>
          </DsToolSection>
        ) : null}

        {renderRawDetails(resultValue)}
      </DsToolFrame>
    </div>
  )
}

export default McpArtifactToolView
