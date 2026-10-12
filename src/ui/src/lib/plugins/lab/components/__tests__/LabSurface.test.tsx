import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BUILTIN_PLUGINS } from '@/lib/types/plugin'

let activeTab: any = null

jest.mock('@/lib/stores/tabs', () => ({
  useActiveTab: () => activeTab,
}))

const cliStoreState = {
  servers: [],
  projectId: null,
  loadServers: jest.fn(),
  setActiveServer: jest.fn(),
  activeServerId: null,
}

jest.mock('@/lib/plugins/cli/stores/cli-store', () => ({
  useCliStore: (selector: any) => selector(cliStoreState),
}))

const chatSessionStoreState = {
  setExecutionTarget: jest.fn(),
  executionTargetsByProject: {},
  cliServerIdsByProject: {},
}

jest.mock('@/lib/stores/session', () => ({
  useChatSessionStore: (selector: any) => selector(chatSessionStoreState),
}))

const labCopilotStoreState = {
  setActiveQuest: jest.fn(),
  activeQuestId: null,
  clearSelections: jest.fn(),
}

jest.mock('@/lib/stores/lab-copilot', () => ({
  useLabCopilotStore: (selector: any) => selector(labCopilotStoreState),
}))

const useLabProjectStreamMock = jest.fn((_args?: any) => ({ status: 'idle', lastEventAt: null }))

jest.mock('../useLabProjectStream', () => ({
  __esModule: true,
  default: (args: any) => useLabProjectStreamMock(args),
}))

jest.mock('../LabCanvasStudio', () => ({
  __esModule: true,
  default: () => <div data-testid="lab-canvas-studio" />,
}))

jest.mock('@/lib/api/lab', () => ({
  listLabTemplates: jest.fn().mockResolvedValue({ items: [] }),
  listLabPromptPools: jest.fn().mockResolvedValue({ items: [] }),
  listLabAgents: jest.fn().mockResolvedValue({ items: [] }),
  listLabQuests: jest.fn().mockResolvedValue({ items: [] }),
  listLabBaselines: jest.fn().mockResolvedValue({ items: [] }),
  listLabPapers: jest.fn().mockResolvedValue({ items: [] }),
  getLabOverview: jest.fn().mockResolvedValue({}),
  listLabAchievements: jest.fn().mockResolvedValue({ items: [] }),
  listLabAchievementDefinitions: jest.fn().mockResolvedValue({ items: [] }),
}))

jest.mock('@/lib/api/projects', () => ({
  getProject: jest.fn().mockResolvedValue({ name: 'Project' }),
  listProjectMembers: jest.fn().mockResolvedValue([]),
}))

import LabSurface from '@/lib/plugins/lab/components/LabSurface'

describe('LabSurface', () => {
  afterEach(() => {
    activeTab = null
    jest.clearAllMocks()
  })

  it('keeps the project stream enabled while the page is visible (even when Lab tab is inactive)', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    activeTab = { pluginId: 'other', context: { customData: {} } }
    render(
      <QueryClientProvider client={queryClient}>
        <LabSurface projectId="project-1" />
      </QueryClientProvider>
    )

    expect(useLabProjectStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'project-1', enabled: true })
    )
  })

  it('refreshes core lab queries immediately when the Lab tab becomes active', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

    activeTab = { pluginId: 'other', context: { customData: {} } }
    const result = render(
      <QueryClientProvider client={queryClient}>
        <LabSurface projectId="project-1" />
      </QueryClientProvider>
    )

    // Activate the Lab tab for this project.
    activeTab = { pluginId: BUILTIN_PLUGINS.LAB, context: { customData: { projectId: 'project-1' } } }
    result.rerender(
      <QueryClientProvider client={queryClient}>
        <LabSurface projectId="project-1" />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['lab-agents', 'project-1'] })
      )
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['lab-quests', 'project-1'] })
      )
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['lab-overview', 'project-1'] })
      )
    })
  })
})
