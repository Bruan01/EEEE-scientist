import { compileLabStartPrompt, normalizeStartTemplateInput } from '@/lib/plugins/lab/utils/lab-start-template'

describe('lab-start-template', () => {
  it('normalizes structured contract defaults', () => {
    const normalized = normalizeStartTemplateInput({
      mode: 'custom',
      baseline_source: 'none',
      goal: 'Test goal',
    })

    expect(normalized.scope).toBe('full_research')
    expect(normalized.resource_policy).toBe('conservative')
    expect(normalized.max_parallel_experiments).toBe(1)
    expect(normalized.max_gpus_per_experiment).toBe(1)
    expect(normalized.git_strategy).toBe('branch_per_analysis_then_paper')
  })

  it('renders research contract section into prompt preview', () => {
    const prompt = compileLabStartPrompt({
      mode: 'custom',
      baseline_source: 'existing',
      baseline_root_id: 'baseline-1',
      goal: 'Improve the baseline safely',
      scope: 'baseline_plus_direction',
      baseline_mode: 'allow_degraded_minimal_reproduction',
      resource_policy: 'balanced',
      max_parallel_experiments: 2,
      max_gpus_per_experiment: 1,
      git_strategy: 'semantic_head_plus_controlled_integration',
      auto_push_policy: 'event_driven',
      paper_branch_policy: 'paper_branch_required',
      timeout_policy: 'ask_pi_before_retry',
      gpu_whitelist: ['GPU-0', 'GPU-1'],
    })

    expect(prompt).toContain('Research Contract')
    expect(prompt).toContain('Runtime should attach and confirm this baseline before the quest starts.')
    expect(prompt).toContain('Scope: Baseline + direction')
    expect(prompt).toContain('Resource policy: Balanced')
    expect(prompt).toContain('Git strategy: Semantic head + controlled integration')
    expect(prompt).toContain('Auto-push policy: Event driven')
  })
})
