import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import LabOverviewCanvas from '@/lib/plugins/lab/components/LabOverviewCanvas'

jest.mock('@xyflow/react', () => {
  const ReactRuntime = require('react') as typeof React
  return {
    MarkerType: { ArrowClosed: 'arrowclosed' },
    Position: { Left: 'left', Right: 'right' },
    Handle: () => null,
    ReactFlow: ({
      nodes = [],
      nodeTypes = {},
      onNodeClick,
      children,
    }: {
      nodes?: Array<any>
      nodeTypes?: Record<string, React.ComponentType<any>>
      onNodeClick?: (event: unknown, node: any) => void
      children?: React.ReactNode
    }) => (
      <div data-testid="reactflow">
        {Array.isArray(nodes)
          ? nodes.map((node) => {
              const NodeComponent = nodeTypes?.[node.type]
              if (!NodeComponent) return null
              return (
                <div
                  key={node.id}
                  data-testid={`node-${node.id}`}
                  onClick={() => {
                    onNodeClick?.({}, node)
                  }}
                >
                  <NodeComponent
                    id={node.id}
                    data={node.data}
                    type={node.type}
                    selected={false}
                    dragging={false}
                    isConnectable={false}
                    xPos={node.position?.x ?? 0}
                    yPos={node.position?.y ?? 0}
                    positionAbsoluteX={node.position?.x ?? 0}
                    positionAbsoluteY={node.position?.y ?? 0}
                  />
                </div>
              )
            })
          : null}
        {children}
      </div>
    ),
    ReactFlowProvider: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="reactflow-provider">{children}</div>
    ),
    Background: () => null,
    Controls: () => null,
    MiniMap: () => null,
    useReactFlow: () => ({ fitView: jest.fn() }),
    useNodesState: (initial: unknown) => {
      const [nodes, setNodes] = ReactRuntime.useState(initial)
      return [nodes, setNodes, jest.fn()]
    },
    useEdgesState: (initial: unknown) => {
      const [edges, setEdges] = ReactRuntime.useState(initial)
      return [edges, setEdges, jest.fn()]
    },
  }
})

jest.mock('@xyflow/react/dist/style.css', () => ({}))

describe('LabOverviewCanvas', () => {
  it('renders an infinite canvas shell even with no quests', () => {
    render(
      <LabOverviewCanvas
        projectId="project-1"
        quests={[]}
        activeQuestId={null}
        readOnly={false}
        shareReadOnly={false}
        waitingAnswerByAgentId={new Map([['agent-1', true]])}
        actionPanel={<div>Action content</div>}
        overviewPanel={<div>Overview content</div>}
      />
    )

    expect(screen.getByTestId('reactflow')).toBeInTheDocument()
    expect(screen.getAllByText('Action content').length).toBeGreaterThan(0)
    expect(screen.getByText('Overview content')).toBeInTheDocument()
  })

  it('forwards PI node click to open PI chat handler', () => {
    const onOpenPiChat = jest.fn()
    render(
      <LabOverviewCanvas
        projectId="project-1"
        quests={[
          {
            quest_id: 'quest-1',
            title: 'Quest One',
            status: 'running',
            created_at: '2026-01-01T00:00:00Z',
          },
        ]}
        agents={[
          {
            instance_id: 'pi-instance-1',
            agent_id: 'pi',
            template_id: 'template-pi',
            display_name: 'PI Atlas',
            status: 'working',
          },
        ] as any}
        templates={[
          {
            template_id: 'template-pi',
            template_key: 'pi',
            name: 'PI',
          },
        ]}
        activeQuestId={null}
        readOnly={false}
        shareReadOnly={false}
        hasPiAgent
        piAgent={{ name: 'PI Atlas' }}
        onOpenPiChat={onOpenPiChat}
        waitingAnswerByAgentId={new Map([['pi-instance-1', false]])}
        actionPanel={<div>Action content</div>}
        overviewPanel={<div>Overview content</div>}
      />
    )

    fireEvent.click(screen.getByTestId('node-pi:pi-instance-1'))
    expect(onOpenPiChat).toHaveBeenCalledTimes(1)
  })

  it('forwards agent node click to copilot selection handler', () => {
    const onSelectAgent = jest.fn()
    render(
      <LabOverviewCanvas
        projectId="project-1"
        quests={[
          {
            quest_id: 'quest-1',
            title: 'Quest One',
            status: 'running',
            created_at: '2026-01-01T00:00:00Z',
          },
        ]}
        agents={[
          {
            instance_id: 'agent-1',
            agent_id: 'researcher',
            template_id: 'template-researcher',
            display_name: 'Agent One',
            status: 'working',
            active_quest_id: 'quest-1',
          },
        ] as any}
        templates={[
          {
            template_id: 'template-researcher',
            template_key: 'researcher',
            name: 'Researcher',
          },
        ]}
        activeQuestId={null}
        readOnly={false}
        shareReadOnly={false}
        onSelectAgent={onSelectAgent}
        waitingAnswerByAgentId={new Map([['agent-1', false]])}
        actionPanel={<div>Action content</div>}
        overviewPanel={<div>Overview content</div>}
      />
    )

    fireEvent.click(screen.getByTestId('node-agent:quest-1:agent-1'))
    expect(onSelectAgent).toHaveBeenCalledWith('agent-1', 'quest-1')
  })

  it('shows quest decision count and last event chip when provided', () => {
    render(
      <LabOverviewCanvas
        projectId="project-1"
        quests={[
          {
            quest_id: 'quest-1',
            title: 'Quest One',
            status: 'running',
            pending_question_count: 2,
            last_event_at: '2026-01-01T00:00:00Z',
            created_at: '2026-01-01T00:00:00Z',
          },
        ]}
        activeQuestId={null}
        readOnly={false}
        shareReadOnly={false}
        waitingAnswerByAgentId={new Map()}
        actionPanel={<div>Action content</div>}
        overviewPanel={<div>Overview content</div>}
      />
    )

    expect(screen.getByText(/2 decisions/i)).toBeInTheDocument()
    expect(screen.getByText(/last event/i)).toBeInTheDocument()
  })

  it('falls back to graph runtime piState when quest pi_state is missing', () => {
    render(
      <LabOverviewCanvas
        projectId="project-1"
        quests={[
          {
            quest_id: 'quest-1',
            title: 'Quest One',
            status: 'running',
            pi_state: null,
            created_at: '2026-01-01T00:00:00Z',
          } as any,
        ]}
        graphVm={
          {
            quests: [
              {
                questId: 'quest-1',
                runtime: {
                  piState: 'working',
                  runningAgents: 1,
                },
                topology: {
                  headBranch: 'main',
                },
              },
            ],
          } as any
        }
        activeQuestId={null}
        readOnly={false}
        shareReadOnly={false}
        waitingAnswerByAgentId={new Map()}
        actionPanel={<div>Action content</div>}
        overviewPanel={<div>Overview content</div>}
      />
    )

    expect(screen.getByText(/PI working/i)).toBeInTheDocument()
  })

  it('renders governance summary chips from graph vm', () => {
    render(
      <LabOverviewCanvas
        projectId="project-1"
        quests={[
          {
            quest_id: 'quest-1',
            title: 'Quest One',
            status: 'running',
            created_at: '2026-01-01T00:00:00Z',
          },
        ]}
        graphVm={{
          project: {
            projectId: 'project-1',
            questCount: 1,
            pendingDecisionCount: 2,
            runningBranchCount: 3,
            pushFailedCount: 1,
            writerConflictCount: 0,
          },
          quests: [
            {
              questId: 'quest-1',
              title: 'Quest One',
              topology: { headBranch: 'analysis/ablate', branchCount: 4, edgeCount: 3 },
              runtime: { runningAgents: 2, runningPiAgents: 1 },
              governance: {},
              summary: {
                questAgeSeconds: 10,
                activeSpanSeconds: 10,
                branchCount: 4,
                ideaCount: 1,
                experimentCount: 2,
                writeCount: 0,
                completedCount: 1,
                progressingCount: 3,
                staleCount: 0,
                pushFailedCount: 1,
                writerConflictCount: 0,
              },
              branches: [],
            },
          ],
        }}
        activeQuestId={null}
        readOnly={false}
        shareReadOnly={false}
        waitingAnswerByAgentId={new Map()}
        actionPanel={<div>Action content</div>}
        overviewPanel={<div>Overview content</div>}
      />
    )

    expect(screen.getByText('3 progressing')).toBeInTheDocument()
    expect(screen.getByText('2 experiments')).toBeInTheDocument()
  })
})
