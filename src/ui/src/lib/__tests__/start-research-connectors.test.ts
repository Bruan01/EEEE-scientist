import { describe, expect, it } from 'vitest'

import {
  compileStartResearchPrompt,
  defaultStartResearchTemplate,
  formatLaunchFormMarkdown,
  resolveStartResearchConnectorBindings,
  saveStartResearchTemplate,
  shouldRecommendStartResearchConnectorBinding,
} from '../startResearch'

describe('shouldRecommendStartResearchConnectorBinding', () => {
  it('does not recommend before the first connector fetch completes', () => {
    expect(
      shouldRecommendStartResearchConnectorBinding({
        open: true,
        availabilityResolved: false,
        availabilityLoading: false,
        availabilityError: null,
        connectorRecommendationHandled: false,
        availability: null,
      })
    ).toBe(false)
  })

  it('does not recommend when an enabled connector already has a delivery target', () => {
    expect(
      shouldRecommendStartResearchConnectorBinding({
        open: true,
        availabilityResolved: true,
        availabilityLoading: false,
        availabilityError: null,
        connectorRecommendationHandled: false,
        availability: {
          has_enabled_external_connector: true,
          has_bound_external_connector: true,
          should_recommend_binding: false,
          preferred_connector_name: 'qq',
          preferred_conversation_id: 'qq:direct:user-1',
          available_connectors: [
            {
              name: 'qq',
              enabled: true,
              connection_state: 'connected',
              binding_count: 1,
              target_count: 1,
              has_delivery_target: true,
            },
          ],
        },
      })
    ).toBe(false)
  })

  it('recommends only after the connector fetch completes and no enabled connector exists', () => {
    expect(
      shouldRecommendStartResearchConnectorBinding({
        open: true,
        availabilityResolved: true,
        availabilityLoading: false,
        availabilityError: null,
        connectorRecommendationHandled: false,
        availability: {
          has_enabled_external_connector: false,
          has_bound_external_connector: false,
          should_recommend_binding: true,
          preferred_connector_name: null,
          preferred_conversation_id: null,
          available_connectors: [],
        },
      })
    ).toBe(true)
  })
})

describe('launch form markdown', () => {
  it('renders a recorded launch form from the startup contract', () => {
    const form = {
      ...defaultStartResearchTemplate('en'),
      title: 'Autonomous paper quest',
      goal: 'Improve the baseline and write a paper-ready summary.',
      objectives: 'Reproduce baseline\nRun one improvement',
      runtime_constraints: 'Use one local GPU only.',
      decision_policy: 'autonomous' as const,
      baseline_urls: 'https://github.com/example/baseline',
    }

    const markdown = formatLaunchFormMarkdown({
      questId: '101',
      title: 'Autonomous paper quest',
      startupContract: {
        workspace_mode: 'autonomous',
        decision_policy: 'autonomous',
        launch_form_source: 'setup_agent',
        launch_form: form,
      },
      workspaceMode: 'autonomous',
      locale: 'en',
    })

    expect(markdown).toContain('# Launch Form')
    expect(markdown).toContain('Source: SetupAgent')
    expect(markdown).toContain('Decision policy: Autonomous')
    expect(markdown).toContain('Improve the baseline')
    expect(markdown).toContain('https://github.com/example/baseline')
  })

  it('falls back to manual launch markdown when no structured form exists', () => {
    const markdown = formatLaunchFormMarkdown({
      questId: 'manual-1',
      title: 'Manual Quest',
      startupContract: {
        workspace_mode: 'copilot',
        decision_policy: 'user_gated',
        launch_form_source: 'manual_markdown',
        launch_markdown: 'Please help inspect this existing repo.',
      },
      locale: 'en',
    })

    expect(markdown).toContain('Manual Launch Markdown')
    expect(markdown).toContain('Please help inspect this existing repo.')
    expect(markdown).toContain('User-gated')
  })

  it('treats missing startup decision policy as user-gated in structured launch markdown', () => {
    const markdown = formatLaunchFormMarkdown({
      questId: 'legacy-1',
      title: 'Legacy Quest',
      startupContract: {
        workspace_mode: 'autonomous',
        launch_form_source: 'manual_form',
        launch_form: {
          title: 'Legacy Quest',
          goal: 'Continue from an older saved form.',
        },
      },
      locale: 'en',
    })

    expect(markdown).toContain('- Decision policy: User-gated')
    expect(markdown).toContain('- Decision policy: Ask the user before major choices')
  })
})

describe('resolveStartResearchConnectorBindings', () => {
  it('defaults to the first available connector target only', () => {
    expect(
      resolveStartResearchConnectorBindings([
        {
          name: 'qq',
          targets: [
            { conversationId: 'qq:direct:qq-a::user-a' },
            { conversationId: 'qq:direct:qq-b::user-b' },
          ],
        },
        {
          name: 'telegram',
          targets: [{ conversationId: 'telegram:direct:tg-1' }],
        },
      ])
    ).toEqual({
      qq: 'qq:direct:qq-a::user-a',
      telegram: null,
    })
  })

  it('preserves one valid existing selection and clears the rest', () => {
    expect(
      resolveStartResearchConnectorBindings(
        [
          {
            name: 'qq',
            targets: [
              { conversationId: 'qq:direct:qq-a::user-a' },
              { conversationId: 'qq:direct:qq-b::user-b' },
            ],
          },
          {
            name: 'telegram',
            targets: [{ conversationId: 'telegram:direct:tg-2' }],
          },
        ],
        {
          qq: 'qq:direct:qq-b::user-b',
          telegram: 'telegram:direct:tg-2',
        }
      )
    ).toEqual({
      qq: 'qq:direct:qq-b::user-b',
      telegram: null,
    })
  })

  it('falls back to the next available connector when the current one becomes invalid', () => {
    expect(
      resolveStartResearchConnectorBindings(
        [
          {
            name: 'qq',
            targets: [],
          },
          {
            name: 'telegram',
            targets: [{ conversationId: 'telegram:direct:tg-2' }],
          },
        ],
        {
          qq: 'qq:direct:qq-b::user-b',
        }
      )
    ).toEqual({
      qq: null,
      telegram: 'telegram:direct:tg-2',
    })
  })

  it('preserves an explicit local-only choice', () => {
    expect(
      resolveStartResearchConnectorBindings(
        [
          {
            name: 'qq',
            targets: [{ conversationId: 'qq:direct:qq-a::user-a' }],
          },
          {
            name: 'telegram',
            targets: [{ conversationId: 'telegram:direct:tg-2' }],
          },
        ],
        {
          qq: null,
          telegram: null,
        }
      )
    ).toEqual({
      qq: null,
      telegram: null,
    })
  })
})

describe('start research standard profiles', () => {
  it('defaults standard mode to the canonical research graph', () => {
    expect(defaultStartResearchTemplate('en').standard_profile).toBe('canonical_research_graph')
  })

  it('persists and recompiles the optimization task profile', () => {
    const saved = saveStartResearchTemplate({
      ...defaultStartResearchTemplate('en'),
      launch_mode: 'standard',
      standard_profile: 'optimization_task',
      need_research_paper: false,
      goal: 'Optimize the system rather than writing a paper.',
    })

    expect(saved.standard_profile).toBe('optimization_task')
    expect(saved.compiled_prompt).toContain('Optimization task:')
    expect(saved.compiled_prompt).toContain('Do not schedule analysis-campaign work by default')
  })

  it('describes the optimization task as non-paper in the compiled prompt', () => {
    const prompt = compileStartResearchPrompt({
      ...defaultStartResearchTemplate('en'),
      launch_mode: 'standard',
      standard_profile: 'optimization_task',
      need_research_paper: false,
      goal: 'Search for the strongest result only.',
    })

    expect(prompt).toContain('Standard profile: optimization task.')
    expect(prompt).toContain('do not plan around paper writing')
    expect(prompt).toContain('do not drift into paper writing or default analysis-campaign work')
  })

  it('can compile a local-existing baseline route with plan-first execution', () => {
    const prompt = compileStartResearchPrompt({
      ...defaultStartResearchTemplate('en'),
      goal: 'Use the already running local system as the baseline comparator first.',
      baseline_source_mode: 'verify_local_existing',
      execution_start_mode: 'plan_then_execute',
      baseline_acceptance_target: 'comparison_ready',
    })

    expect(prompt).toContain('Baseline Source Preference')
    expect(prompt).toContain('Verify local existing')
    expect(prompt).toContain('Execution Start Mode')
    expect(prompt).toContain('Plan first')
    expect(prompt).toContain('Baseline Acceptance Target')
    expect(prompt).toContain('Comparison ready')
  })

  it('includes uploaded launch materials in the compiled prompt', () => {
    const prompt = compileStartResearchPrompt(
      {
        ...defaultStartResearchTemplate('en'),
        goal: 'Use the uploaded dataset and paper as launch context.',
      },
      {
        attachments: [
          {
            label: 'dataset.csv',
            location: 'userfiles/web/batch-001/dataset.csv',
            contentType: 'text/csv',
            source: 'setup',
          },
          {
            label: 'paper.pdf',
            location: 'userfiles/web/batch-002/paper.pdf',
            contentType: 'application/pdf',
            source: 'manual',
          },
        ],
      }
    )

    expect(prompt).toContain('User-Provided Materials')
    expect(prompt).toContain('dataset.csv')
    expect(prompt).toContain('quest_local_location=userfiles/web/batch-001/dataset.csv')
    expect(prompt).toContain('inherited from the SetupAgent setup conversation')
    expect(prompt).toContain('paper.pdf')
    expect(prompt).toContain('added directly on the launch form')
    expect(prompt).toContain('inspect the quest-local file or readable sidecar')
  })
})
