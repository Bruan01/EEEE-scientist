import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LabCopilotPanel from '@/lib/plugins/lab/components/LabCopilotPanel'
import { ToastProvider } from '@/components/ui/toast'
import { useLabCopilotStore } from '@/lib/stores/lab-copilot'
import { useLabGraphSelectionStore } from '@/lib/stores/lab-graph-selection'

jest.mock('@/lib/plugins/ai-manus/AiManusChatView', () => ({
  AiManusChatView: (props: { messageMetadata?: Record<string, unknown> }) => (
    <div
      data-testid="ai-manus-chat-view"
      data-message-metadata={JSON.stringify(props.messageMetadata ?? {})}
    />
  ),
}))

type LabCopilotPanelProps = ComponentProps<typeof LabCopilotPanel>

const baseProps: LabCopilotPanelProps = {
  projectId: 'project-1',
  readOnly: false,
  shareReadOnly: false,
  cliStatus: 'online',
  templates: [],
  agents: [],
  quests: [],
}

describe('LabCopilotPanel', () => {
  const renderWithProviders = (props: Partial<LabCopilotPanelProps> = {}) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <LabCopilotPanel {...baseProps} {...props} />
        </ToastProvider>
      </QueryClientProvider>
    )
  }

  beforeAll(() => {
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }),
      })
    }
  })

  beforeEach(() => {
    useLabCopilotStore.setState({
      mode: 'direct',
      activeQuestId: null,
      activeAgentId: null,
      directPrefill: null,
      groupPrefill: null,
    })
    useLabGraphSelectionStore.setState({
      selection: null,
      activeProposal: null,
      replayCursorEventId: null,
      compareTargets: {},
    })
  })

  it('shows share read-only message', () => {
    renderWithProviders({ shareReadOnly: true, cliStatus: 'online' })
    expect(screen.getByText('Copilot is disabled in shared view.')).toBeInTheDocument()
  })

  it('renders agent chooser when no agent is selected (offline)', () => {
    renderWithProviders({ cliStatus: 'offline' })
    expect(screen.getByText('Choose an agent')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-manus-chat-view')).not.toBeInTheDocument()
  })

  it('renders agent chooser when no agent is selected (unbound)', () => {
    renderWithProviders({ cliStatus: 'unbound' })
    expect(screen.getByText('Choose an agent')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-manus-chat-view')).not.toBeInTheDocument()
  })

  it('injects selection and proposal metadata into direct chat', () => {
    useLabCopilotStore.setState({
      mode: 'direct',
      activeQuestId: 'quest-1',
      activeAgentId: 'pi-1',
      directPrefill: null,
      groupPrefill: null,
    })
    useLabGraphSelectionStore.setState({
      selection: {
        selection_type: 'branch_node',
        selection_ref: 'analysis/ablate',
        quest_id: 'quest-1',
        branch_name: 'analysis/ablate',
        worktree_rel_path: 'Quest/quest-1/worktrees/ablate',
        label: 'analysis/ablate',
      },
      activeProposal: {
        proposal_id: 'proposal-1',
        action_type: 'retire_branch',
        status: 'submitted',
        quest_id: 'quest-1',
        selection_ref: 'analysis/ablate',
        payload: {},
      },
      replayCursorEventId: null,
      compareTargets: {},
    })

    renderWithProviders({
      quests: [{ quest_id: 'quest-1', title: 'Quest One' }],
      agents: [
        {
          instance_id: 'pi-1',
          agent_id: 'pi',
          active_quest_id: 'quest-1',
          display_name: 'PI Atlas',
          status: 'working',
        } as any,
      ],
    })

    const metadata = JSON.parse(screen.getByTestId('ai-manus-chat-view').getAttribute('data-message-metadata') || '{}')
    expect(metadata.selection_context.branch_name).toBe('analysis/ablate')
    expect(metadata.proposal_id).toBe('proposal-1')
  })
})
