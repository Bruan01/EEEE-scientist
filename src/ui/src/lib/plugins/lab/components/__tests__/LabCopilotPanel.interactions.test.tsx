import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LabCopilotPanel from '@/lib/plugins/lab/components/LabCopilotPanel'
import { ToastProvider } from '@/components/ui/toast'
import { useLabCopilotStore } from '@/lib/stores/lab-copilot'
import { useLabGraphSelectionStore } from '@/lib/stores/lab-graph-selection'
import { useChatSessionStore } from '@/lib/stores/session'
import { getLabFriendsSession, getLabGroupSession } from '@/lib/api/lab'
import { getSession } from '@/lib/api/sessions'

jest.mock('@/lib/plugins/ai-manus/AiManusChatView', () => ({
  AiManusChatView: () => <div data-testid="ai-manus-chat-view" />,
}))

jest.mock('@/lib/api/client', () => ({
  getApiBaseUrl: () => '',
}))

jest.mock('@/lib/api/lab', () => ({
  getLabAgentDirectSession: jest.fn(),
  getLabGroupSession: jest.fn(),
  getLabFriendsSession: jest.fn(),
}))

jest.mock('@/lib/api/sessions', () => ({
  getSession: jest.fn(),
}))

const mockGetLabGroupSession = getLabGroupSession as jest.MockedFunction<typeof getLabGroupSession>
const mockGetLabFriendsSession = getLabFriendsSession as jest.MockedFunction<typeof getLabFriendsSession>
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>

type LabCopilotPanelProps = ComponentProps<typeof LabCopilotPanel>

const baseProps: LabCopilotPanelProps = {
  projectId: 'project-1',
  readOnly: false,
  shareReadOnly: false,
  cliStatus: 'online',
  templates: [],
  agents: [],
  quests: [
    {
      quest_id: 'quest-1',
      title: 'Quest One',
    },
  ],
}

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

const createSseReader = (payload: string) => {
  const encoder = new TextEncoder()
  let readCount = 0
  return {
    read: jest.fn().mockImplementation(() => {
      readCount += 1
      if (readCount === 1) {
        return Promise.resolve({ value: encoder.encode(payload), done: false })
      }
      return Promise.resolve({ value: undefined, done: true })
    }),
  }
}

describe('LabCopilotPanel interactions', () => {
  const originalFetch = global.fetch

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
    mockGetLabGroupSession.mockResolvedValue({ session_id: 'session-group', surface: 'group' })
    mockGetLabFriendsSession.mockResolvedValue({ session_id: 'session-friends', surface: 'friends' })
    mockGetSession.mockResolvedValue({ session_id: 'session-group', events: [] })

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
    useChatSessionStore.setState({
      cliServerIdsByProject: { 'project-1': 'server-1' },
      executionTargetsByProject: {},
      sessionIdsByProject: {},
      sessionIdsByProjectSurface: {},
      lastEventIdBySession: {},
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
    jest.clearAllMocks()
  })

  it('renders group session history in the chat view', async () => {
    useLabCopilotStore.setState({
      mode: 'group',
      activeQuestId: 'quest-1',
    })

    mockGetLabGroupSession.mockResolvedValueOnce({ session_id: 'session-group', surface: 'group' })
    mockGetSession.mockResolvedValueOnce({
      session_id: 'session-group',
      events: [
        {
          event: 'message',
          data: {
            event_id: 'event-1',
            timestamp: 1735689600,
            role: 'user',
            content: 'Hello group',
          },
        },
      ],
    })
    const reader = createSseReader('')

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
      headers: { get: () => '' },
    } as any)

    renderWithProviders()

    expect(await screen.findByText('Hello group')).toBeInTheDocument()
  })

  it('renders selection and proposal chips in group mode', async () => {
    useLabCopilotStore.setState({
      mode: 'group',
      activeQuestId: 'quest-1',
    })
    useLabGraphSelectionStore.setState({
      selection: {
        selection_type: 'branch_node',
        selection_ref: 'analysis/ablate',
        quest_id: 'quest-1',
        branch_name: 'analysis/ablate',
        label: 'analysis/ablate',
      },
      activeProposal: {
        proposal_id: 'proposal-1',
        action_type: 'request_analysis',
        status: 'submitted',
        quest_id: 'quest-1',
        selection_ref: 'analysis/ablate',
        payload: {},
      },
      replayCursorEventId: null,
      compareTargets: {},
    })

    renderWithProviders()

    expect(await screen.findByText('analysis/ablate')).toBeInTheDocument()
    expect(screen.getByText('request_analysis')).toBeInTheDocument()
  })

  it('renders friends session history in the feed', async () => {
    useLabCopilotStore.setState({
      mode: 'friends',
      activeQuestId: 'quest-1',
    })

    mockGetLabFriendsSession.mockResolvedValueOnce({ session_id: 'session-friends', surface: 'friends' })
    mockGetSession.mockResolvedValueOnce({
      session_id: 'session-friends',
      events: [
        {
          event: 'message',
          data: {
            event_id: 'event-2',
            timestamp: 1735776000,
            role: 'assistant',
            content: 'Friend update',
            metadata: {
              agent_instance_id: 'agent-1',
              agent_display_name: 'Writer-Fugue',
            },
          },
        },
      ],
    })

    const reader = createSseReader('')
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
      headers: { get: () => '' },
    } as any)

    renderWithProviders({
      agents: [
        {
          instance_id: 'agent-1',
          agent_id: 'writer-fugue',
          display_name: 'Writer-Fugue',
          active_quest_id: 'quest-1',
        },
      ],
    })

    expect(await screen.findByText('Friend update')).toBeInTheDocument()
  })

  it('updates group reply badge from receipt events', async () => {
    useLabCopilotStore.setState({
      mode: 'group',
      activeQuestId: 'quest-1',
    })

    mockGetLabGroupSession.mockResolvedValueOnce({ session_id: 'session-group', surface: 'group' })
    mockGetSession.mockResolvedValueOnce({
      session_id: 'session-group',
      events: [
        {
          event: 'message',
          data: {
            event_id: 'group-msg-1',
            timestamp: 1735689600,
            role: 'user',
            content: 'Please inspect this branch.',
            metadata: {
              group_message_id: 'group-msg-1',
              reply_state: 'queued',
            },
          },
        },
      ],
    })

    const reader = createSseReader(
      'event: receipt\n' +
        'data: {"message_ref":"group-msg-1","delivery_state":"delivered","reply_state":"acked"}\n\n'
    )
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
      headers: { get: () => '' },
    } as any)

    renderWithProviders()

    expect(await screen.findByText('Please inspect this branch.')).toBeInTheDocument()
    expect(await screen.findByText('Acknowledged')).toBeInTheDocument()
  })
})
