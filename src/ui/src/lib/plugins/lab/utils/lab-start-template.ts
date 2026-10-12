import type {
  LabAutoPushPolicy,
  LabBaselineMode,
  LabGitStrategy,
  LabPaperBranchPolicy,
  LabResearchScope,
  LabResourcePolicy,
  LabStartTemplate,
  LabStartTemplateInput,
  LabTimeoutPolicy,
} from '@/lib/plugins/lab/types/lab-board'

const STORAGE_PREFIX = 'ds:lab:start-template:v1'
const DEFAULT_MAX_VERSIONS = 10

function nowIso() {
  return new Date().toISOString()
}

function sanitizeText(value?: string | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function sanitizeUrls(values?: string[]) {
  if (!Array.isArray(values)) return []
  const dedup = new Set<string>()
  for (const raw of values) {
    const trimmed = sanitizeText(raw)
    if (!trimmed) continue
    dedup.add(trimmed)
  }
  return Array.from(dedup)
}

function sanitizePositiveInt(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const normalized = Math.max(1, Math.floor(value))
  return normalized
}

function sanitizeOptionalText(value?: string | null) {
  const text = sanitizeText(value)
  return text || undefined
}

function sanitizeOptionalBool(value?: boolean | null) {
  return typeof value === 'boolean' ? value : undefined
}

function sanitizeScope(value?: string | null): LabResearchScope {
  if (value === 'baseline_only' || value === 'baseline_plus_direction' || value === 'full_research') {
    return value
  }
  return 'full_research'
}

function sanitizeBaselineMode(
  value: string | null | undefined,
  baselineSource: LabStartTemplateInput['baseline_source']
): LabBaselineMode {
  if (
    value === 'existing' ||
    value === 'restore_from_url' ||
    value === 'allow_degraded_minimal_reproduction' ||
    value === 'stop_if_insufficient'
  ) {
    return value
  }
  if (baselineSource === 'existing') return 'existing'
  if (baselineSource === 'url') return 'restore_from_url'
  return 'stop_if_insufficient'
}

function sanitizeResourcePolicy(value?: string | null): LabResourcePolicy {
  if (value === 'conservative' || value === 'balanced' || value === 'aggressive') {
    return value
  }
  return 'conservative'
}

function sanitizeTimeoutPolicy(value?: string | null): LabTimeoutPolicy {
  if (
    value === 'retry_once_then_pause' ||
    value === 'ask_pi_before_retry' ||
    value === 'stop_on_timeout'
  ) {
    return value
  }
  return 'retry_once_then_pause'
}

function sanitizeGitStrategy(value?: string | null): LabGitStrategy {
  if (
    value === 'branch_per_analysis_then_paper' ||
    value === 'semantic_head_plus_controlled_integration' ||
    value === 'manual_integration_only'
  ) {
    return value
  }
  return 'branch_per_analysis_then_paper'
}

function sanitizeAutoPushPolicy(value?: string | null): LabAutoPushPolicy {
  if (value === 'disabled' || value === 'event_driven' || value === 'protected_only') {
    return value
  }
  return 'disabled'
}

function sanitizePaperBranchPolicy(value?: string | null): LabPaperBranchPolicy {
  if (
    value === 'paper_branch_required' ||
    value === 'paper_branch_when_ready' ||
    value === 'reuse_current_branch'
  ) {
    return value
  }
  return 'paper_branch_required'
}

function labelScope(value: LabResearchScope) {
  switch (value) {
    case 'baseline_only':
      return 'Baseline only'
    case 'baseline_plus_direction':
      return 'Baseline + direction'
    default:
      return 'Full research'
  }
}

function labelBaselineMode(value: LabBaselineMode) {
  switch (value) {
    case 'existing':
      return 'Use existing baseline'
    case 'restore_from_url':
      return 'Restore from URL'
    case 'allow_degraded_minimal_reproduction':
      return 'Allow degraded minimal reproduction'
    default:
      return 'Stop if insufficient'
  }
}

function labelResourcePolicy(value: LabResourcePolicy) {
  switch (value) {
    case 'balanced':
      return 'Balanced'
    case 'aggressive':
      return 'Aggressive'
    default:
      return 'Conservative'
  }
}

function labelTimeoutPolicy(value: LabTimeoutPolicy) {
  switch (value) {
    case 'ask_pi_before_retry':
      return 'Ask PI before retry'
    case 'stop_on_timeout':
      return 'Stop on timeout'
    default:
      return 'Retry once, then pause'
  }
}

function labelGitStrategy(value: LabGitStrategy) {
  switch (value) {
    case 'semantic_head_plus_controlled_integration':
      return 'Semantic head + controlled integration'
    case 'manual_integration_only':
      return 'Manual integration only'
    default:
      return 'Branch-per-analysis then paper'
  }
}

function labelAutoPushPolicy(value: LabAutoPushPolicy) {
  switch (value) {
    case 'event_driven':
      return 'Event driven'
    case 'protected_only':
      return 'Protected branches only'
    default:
      return 'Disabled'
  }
}

function labelPaperBranchPolicy(value: LabPaperBranchPolicy) {
  switch (value) {
    case 'paper_branch_when_ready':
      return 'Create paper branch when ready'
    case 'reuse_current_branch':
      return 'Reuse current branch'
    default:
      return 'Paper branch required'
  }
}

function stableHash(input: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function storageKey(projectId: string) {
  return `${STORAGE_PREFIX}:${projectId}`
}

function safeParseTemplates(raw: string | null) {
  if (!raw) return [] as LabStartTemplate[]
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is LabStartTemplate => {
      return Boolean(item && typeof item === 'object' && typeof item.content_hash === 'string')
    })
  } catch {
    return []
  }
}

export function normalizeStartTemplateInput(input: LabStartTemplateInput): LabStartTemplateInput {
  return {
    mode: input.mode,
    baseline_source: input.baseline_source,
    baseline_root_id: sanitizeText(input.baseline_root_id) || undefined,
    baseline_urls: sanitizeUrls(input.baseline_urls),
    paper_urls: sanitizeUrls(input.paper_urls),
    goal: sanitizeText(input.goal),
    runtime_constraints: sanitizeText(input.runtime_constraints) || undefined,
    deliverables: sanitizeText(input.deliverables) || undefined,
    scope: sanitizeScope(input.scope),
    baseline_mode: sanitizeBaselineMode(input.baseline_mode, input.baseline_source),
    resource_policy: sanitizeResourcePolicy(input.resource_policy),
    gpu_whitelist: sanitizeUrls(input.gpu_whitelist),
    max_parallel_experiments: sanitizePositiveInt(input.max_parallel_experiments) ?? 1,
    max_gpus_per_experiment: sanitizePositiveInt(input.max_gpus_per_experiment) ?? 1,
    time_budget_hours: sanitizePositiveInt(input.time_budget_hours),
    timeout_policy: sanitizeTimeoutPolicy(input.timeout_policy),
    dataset_constraints: sanitizeOptionalText(input.dataset_constraints),
    runtime_model: sanitizeOptionalText(input.runtime_model),
    runtime_base_url: sanitizeOptionalText(input.runtime_base_url),
    runtime_async_generation: sanitizeOptionalBool(input.runtime_async_generation),
    runtime_batch_size: sanitizePositiveInt(input.runtime_batch_size),
    user_language: sanitizeOptionalText(input.user_language),
    git_strategy: sanitizeGitStrategy(input.git_strategy),
    auto_push_policy: sanitizeAutoPushPolicy(input.auto_push_policy),
    paper_branch_policy: sanitizePaperBranchPolicy(input.paper_branch_policy),
  }
}

export function compileLabStartPrompt(input: LabStartTemplateInput) {
  const normalized = normalizeStartTemplateInput(input)

  const baselineContext =
    normalized.baseline_source === 'existing'
      ? normalized.baseline_root_id
        ? `Selected reusable baseline: ${normalized.baseline_root_id}. Runtime should attach and confirm this baseline before the quest starts. Reuse it by default and do not redo baseline discovery or reproduction unless you find a concrete incompatibility, corruption, or missing-evidence problem.`
        : 'Existing reusable baseline mode is selected, but the baseline id is missing. Ask the user to confirm the intended baseline before starting.'
      : normalized.baseline_source === 'url'
        ? normalized.baseline_urls && normalized.baseline_urls.length > 0
          ? normalized.baseline_urls.map((url) => `- ${url}`).join('\n')
          : 'Baseline URL mode selected but no URL provided.'
        : 'No baseline provided. PI should establish baseline first.'

  const paperReferences =
    normalized.paper_urls && normalized.paper_urls.length > 0
      ? normalized.paper_urls.map((url) => `- ${url}`).join('\n')
      : '- None provided'

  const runtimeConstraints = normalized.runtime_constraints || 'No explicit constraints.'
  const deliverables = normalized.deliverables || 'Report key findings, metrics, and artifacts.'
  const gpuWhitelist =
    normalized.gpu_whitelist && normalized.gpu_whitelist.length > 0
      ? normalized.gpu_whitelist.join(', ')
      : 'Auto / not specified'
  const timeBudget = normalized.time_budget_hours ? `${normalized.time_budget_hours}h` : 'Not specified'
  const runtimeModel = normalized.runtime_model || 'Not specified'
  const runtimeBaseUrl = normalized.runtime_base_url || 'Not specified'
  const runtimeAsyncGeneration =
    normalized.runtime_async_generation === undefined
      ? 'Not specified'
      : normalized.runtime_async_generation
        ? 'Enabled'
        : 'Disabled'
  const runtimeBatchSize = normalized.runtime_batch_size ? String(normalized.runtime_batch_size) : 'Not specified'
  const userLanguage = normalized.user_language || 'Not specified'

  return [
    'Goal',
    normalized.goal || 'No goal provided.',
    '',
    'Baseline Context',
    baselineContext,
    '',
    'Paper References',
    paperReferences,
    '',
    'Runtime & Constraints',
    runtimeConstraints,
    `- Runtime model: ${runtimeModel}`,
    `- Runtime base URL: ${runtimeBaseUrl}`,
    `- Async generation: ${runtimeAsyncGeneration}`,
    `- Batch size: ${runtimeBatchSize}`,
    `- User language: ${userLanguage}`,
    '- Runtime credentials are injected via DS_RUNTIME_* environment variables; never print or persist API keys.',
    '',
    'Research Contract',
    `- Scope: ${labelScope(normalized.scope || 'full_research')}`,
    `- Baseline mode: ${labelBaselineMode(
      sanitizeBaselineMode(normalized.baseline_mode, normalized.baseline_source)
    )}`,
    `- Resource policy: ${labelResourcePolicy(normalized.resource_policy || 'conservative')}`,
    `- Max parallel experiments: ${normalized.max_parallel_experiments || 1}`,
    `- Max GPUs per experiment: ${normalized.max_gpus_per_experiment || 1}`,
    `- GPU whitelist: ${gpuWhitelist}`,
    `- Time budget: ${timeBudget}`,
    `- Timeout policy: ${labelTimeoutPolicy(normalized.timeout_policy || 'retry_once_then_pause')}`,
    `- Dataset constraints: ${normalized.dataset_constraints || 'Not specified'}`,
    `- Git strategy: ${labelGitStrategy(normalized.git_strategy || 'branch_per_analysis_then_paper')}`,
    `- Auto-push policy: ${labelAutoPushPolicy(normalized.auto_push_policy || 'disabled')}`,
    `- Paper branch policy: ${labelPaperBranchPolicy(
      normalized.paper_branch_policy || 'paper_branch_required'
    )}`,
    '',
    'Expected Outputs',
    deliverables,
    '',
    'First Actions Required',
    '- Read and respect the research contract before deciding resources or Git route',
    '- Confirm objective and assumptions',
    '- Complete baseline gate before exploratory experiments',
    '- Emit stage events for decision/experiment/write milestones',
    '- Ask user questions whenever blocking uncertainty appears',
  ].join('\n')
}

export function createLabStartTemplate(projectId: string, input: LabStartTemplateInput): LabStartTemplate {
  const normalized = normalizeStartTemplateInput(input)
  const compiledPrompt = compileLabStartPrompt(normalized)
  const normalizedPayload = {
    mode: normalized.mode,
    baseline_source: normalized.baseline_source,
    baseline_root_id: normalized.baseline_root_id || null,
    baseline_urls: normalized.baseline_urls || [],
    paper_urls: normalized.paper_urls || [],
    goal: normalized.goal,
    runtime_constraints: normalized.runtime_constraints || null,
    deliverables: normalized.deliverables || null,
    scope: normalized.scope || 'full_research',
    baseline_mode: normalized.baseline_mode,
    resource_policy: normalized.resource_policy || 'conservative',
    gpu_whitelist: normalized.gpu_whitelist || [],
    max_parallel_experiments: normalized.max_parallel_experiments || 1,
    max_gpus_per_experiment: normalized.max_gpus_per_experiment || 1,
    time_budget_hours: normalized.time_budget_hours || null,
    timeout_policy: normalized.timeout_policy || 'retry_once_then_pause',
    dataset_constraints: normalized.dataset_constraints || null,
    runtime_model: normalized.runtime_model || null,
    runtime_base_url: normalized.runtime_base_url || null,
    runtime_async_generation: normalized.runtime_async_generation ?? null,
    runtime_batch_size: normalized.runtime_batch_size || null,
    user_language: normalized.user_language || null,
    git_strategy: normalized.git_strategy || 'branch_per_analysis_then_paper',
    auto_push_policy: normalized.auto_push_policy || 'disabled',
    paper_branch_policy: normalized.paper_branch_policy || 'paper_branch_required',
  }
  const contentHash = stableHash(JSON.stringify(normalizedPayload))
  const timestamp = nowIso()
  return {
    id: `tmpl_${contentHash}_${Date.now().toString(36)}`,
    project_id: projectId,
    mode: normalized.mode,
    baseline_source: normalized.baseline_source,
    baseline_root_id: normalized.baseline_root_id,
    baseline_urls: normalized.baseline_urls || [],
    paper_urls: normalized.paper_urls || [],
    goal: normalized.goal,
    runtime_constraints: normalized.runtime_constraints,
    deliverables: normalized.deliverables,
    scope: normalized.scope,
    baseline_mode: normalized.baseline_mode,
    resource_policy: normalized.resource_policy,
    gpu_whitelist: normalized.gpu_whitelist || [],
    max_parallel_experiments: normalized.max_parallel_experiments,
    max_gpus_per_experiment: normalized.max_gpus_per_experiment,
    time_budget_hours: normalized.time_budget_hours,
    timeout_policy: normalized.timeout_policy,
    dataset_constraints: normalized.dataset_constraints,
    runtime_model: normalized.runtime_model,
    runtime_base_url: normalized.runtime_base_url,
    runtime_async_generation: normalized.runtime_async_generation,
    runtime_batch_size: normalized.runtime_batch_size,
    user_language: normalized.user_language,
    git_strategy: normalized.git_strategy,
    auto_push_policy: normalized.auto_push_policy,
    paper_branch_policy: normalized.paper_branch_policy,
    compiled_prompt: compiledPrompt,
    content_hash: contentHash,
    updated_at: timestamp,
  }
}

export function loadLabStartTemplates(projectId: string): LabStartTemplate[] {
  if (typeof window === 'undefined') return []
  return safeParseTemplates(window.localStorage.getItem(storageKey(projectId)))
}

export function saveLabStartTemplate(
  projectId: string,
  input: LabStartTemplateInput,
  options?: { maxVersions?: number }
): LabStartTemplate {
  const nextTemplate = createLabStartTemplate(projectId, input)
  if (typeof window === 'undefined') return nextTemplate

  const maxVersions = options?.maxVersions ?? DEFAULT_MAX_VERSIONS
  const existing = loadLabStartTemplates(projectId)
  const sameHashIndex = existing.findIndex((item) => item.content_hash === nextTemplate.content_hash)

  if (sameHashIndex >= 0) {
    const updated = {
      ...existing[sameHashIndex],
      ...nextTemplate,
      id: existing[sameHashIndex].id,
      updated_at: nowIso(),
    }
    const merged = [updated, ...existing.filter((_, index) => index !== sameHashIndex)]
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(merged.slice(0, maxVersions)))
    return updated
  }

  const merged = [nextTemplate, ...existing].slice(0, maxVersions)
  window.localStorage.setItem(storageKey(projectId), JSON.stringify(merged))
  return nextTemplate
}

export function getLatestLabStartTemplate(projectId: string): LabStartTemplate | null {
  const templates = loadLabStartTemplates(projectId)
  return templates[0] ?? null
}

export function removeLabStartTemplate(projectId: string, templateId: string) {
  if (typeof window === 'undefined') return
  const templates = loadLabStartTemplates(projectId)
  const next = templates.filter((item) => item.id !== templateId)
  window.localStorage.setItem(storageKey(projectId), JSON.stringify(next))
}

export function clearLabStartTemplates(projectId: string) {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(storageKey(projectId))
}
