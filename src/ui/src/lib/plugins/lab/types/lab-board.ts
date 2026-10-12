export type LabResearchScope =
  | 'baseline_only'
  | 'baseline_plus_direction'
  | 'full_research'

export type LabBaselineMode =
  | 'existing'
  | 'restore_from_url'
  | 'allow_degraded_minimal_reproduction'
  | 'stop_if_insufficient'

export type LabResourcePolicy = 'conservative' | 'balanced' | 'aggressive'

export type LabTimeoutPolicy =
  | 'retry_once_then_pause'
  | 'ask_pi_before_retry'
  | 'stop_on_timeout'

export type LabGitStrategy =
  | 'branch_per_analysis_then_paper'
  | 'semantic_head_plus_controlled_integration'
  | 'manual_integration_only'

export type LabAutoPushPolicy = 'disabled' | 'event_driven' | 'protected_only'

export type LabPaperBranchPolicy =
  | 'paper_branch_required'
  | 'paper_branch_when_ready'
  | 'reuse_current_branch'

export interface LabStartTemplate {
  id: string
  project_id: string
  mode: 'template' | 'custom'
  baseline_source: 'existing' | 'url' | 'none'
  baseline_root_id?: string
  baseline_urls: string[]
  paper_urls: string[]
  goal: string
  runtime_constraints?: string
  deliverables?: string
  scope?: LabResearchScope
  baseline_mode?: LabBaselineMode
  resource_policy?: LabResourcePolicy
  gpu_whitelist?: string[]
  max_parallel_experiments?: number
  max_gpus_per_experiment?: number
  time_budget_hours?: number
  timeout_policy?: LabTimeoutPolicy
  dataset_constraints?: string
  runtime_model?: string
  runtime_base_url?: string
  runtime_async_generation?: boolean
  runtime_batch_size?: number
  user_language?: string
  git_strategy?: LabGitStrategy
  auto_push_policy?: LabAutoPushPolicy
  paper_branch_policy?: LabPaperBranchPolicy
  compiled_prompt: string
  content_hash: string
  updated_at: string
}

export interface LabStartTemplateInput {
  mode: LabStartTemplate['mode']
  baseline_source: LabStartTemplate['baseline_source']
  baseline_root_id?: string
  baseline_urls?: string[]
  paper_urls?: string[]
  goal: string
  runtime_constraints?: string
  deliverables?: string
  scope?: LabResearchScope
  baseline_mode?: LabBaselineMode
  resource_policy?: LabResourcePolicy
  gpu_whitelist?: string[]
  max_parallel_experiments?: number
  max_gpus_per_experiment?: number
  time_budget_hours?: number
  timeout_policy?: LabTimeoutPolicy
  dataset_constraints?: string
  runtime_model?: string
  runtime_base_url?: string
  runtime_async_generation?: boolean
  runtime_batch_size?: number
  user_language?: string
  git_strategy?: LabGitStrategy
  auto_push_policy?: LabAutoPushPolicy
  paper_branch_policy?: LabPaperBranchPolicy
}
