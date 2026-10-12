'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import '../lab.css'
import { useActiveTab } from '@/lib/stores/tabs'
import { useCliStore } from '@/lib/plugins/cli/stores/cli-store'
import { getProject } from '@/lib/api/projects'
import {
  getLabOverview,
  listLabAgents,
  listLabQuests,
  listLabTemplates,
  type LabQuestSelectionContext,
  type LabOverview,
} from '@/lib/api/lab'
import { useLabCopilotStore } from '@/lib/stores/lab-copilot'
import { BUILTIN_PLUGINS } from '@/lib/types/plugin'
import LabCanvasStudio from './LabCanvasStudio'
import useLabProjectStream from './useLabProjectStream'
import { resolveLabListPollingInterval } from './lab-polling'
import { cn } from '@/lib/utils'

type LabSurfaceProps = {
  projectId: string
  readOnly?: boolean
  lockedQuestId?: string | null
  immersiveLockedQuest?: boolean
  onRefresh?: () => Promise<void> | void
  onOpenStageSelection?: (selection: LabQuestSelectionContext & { label?: string | null; summary?: string | null }) => void
}

export default function LabSurface({
  projectId,
  readOnly,
  lockedQuestId = null,
  immersiveLockedQuest = false,
  onRefresh,
  onOpenStageSelection,
}: LabSurfaceProps) {
  const queryClient = useQueryClient()
  const setActiveQuest = useLabCopilotStore((state) => state.setActiveQuest)
  const activeQuestId = useLabCopilotStore((state) => state.activeQuestId)
  const clearSelections = useLabCopilotStore((state) => state.clearSelections)
  const cliServers = useCliStore((state) => state.servers)
  const loadCliServers = useCliStore((state) => state.loadServers)
  const cliProjectId = useCliStore((state) => state.projectId)
  const activeTab = useActiveTab()
  const isLabTabActive = React.useMemo(() => {
    const customData = activeTab?.context?.customData as { projectId?: unknown } | undefined
    const tabProjectId = typeof customData?.projectId === 'string' ? customData.projectId : null
    const matchesProject = !tabProjectId || tabProjectId === projectId
    return activeTab?.pluginId === BUILTIN_PLUGINS.LAB && matchesProject
  }, [activeTab, projectId])

  React.useEffect(() => {
    if (!projectId) return
    if (cliProjectId === projectId) return
    void loadCliServers(projectId)
  }, [cliProjectId, loadCliServers, projectId])

  const onlineCliServers = React.useMemo(
    () => cliServers.filter((server) => server.status !== 'offline' && server.status !== 'error'),
    [cliServers]
  )

  const cliStatus: 'online' | 'offline' | 'unbound' =
    cliServers.length === 0 ? 'unbound' : onlineCliServers.length > 0 ? 'online' : 'offline'
  const labReadOnly = true
  const [isPageActive, setIsPageActive] = React.useState(true)

  React.useEffect(() => {
    const handleVisibility = () => {
      setIsPageActive(typeof document !== 'undefined' && document.visibilityState === 'visible')
    }
    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const labStaleTime = 30000
  const liveRefetchEnabled = Boolean(projectId && isLabTabActive && isPageActive)
  // Keep the Lab stream connected while the workspace is visible so global notifications
  // (agent waiting/completed) work even when the Lab tab is not focused.
  const labStreamEnabled = Boolean(projectId && isPageActive)
  // "Real-time" UX without SSE: keep lab pages feeling alive while the Lab tab is focused.
  const LIVE_AGENTS_INTERVAL_MS = 5000
  const LIVE_QUESTS_INTERVAL_MS = 10000
  const LIVE_OVERVIEW_INTERVAL_MS = 10000

  const labStream = useLabProjectStream({ projectId, enabled: labStreamEnabled })
  const labStreamStatus = labStream?.status ?? 'idle'
  const agentsRefetchInterval = resolveLabListPollingInterval({
    liveEnabled: liveRefetchEnabled,
    streamStatus: labStreamStatus,
    fastMs: LIVE_AGENTS_INTERVAL_MS,
    // Agent statuses are derived from chat session state; until we publish per-agent status events,
    // keep polling relatively frequent even when the project stream is healthy.
    slowMs: LIVE_AGENTS_INTERVAL_MS,
  })
  const questsRefetchInterval = resolveLabListPollingInterval({
    liveEnabled: liveRefetchEnabled,
    streamStatus: labStreamStatus,
    fastMs: LIVE_QUESTS_INTERVAL_MS,
    slowMs: 30000,
  })
  const overviewRefetchInterval = resolveLabListPollingInterval({
    liveEnabled: liveRefetchEnabled,
    streamStatus: labStreamStatus,
    fastMs: LIVE_OVERVIEW_INTERVAL_MS,
    slowMs: 30000,
  })

  const wasLiveRefetchEnabledRef = React.useRef(liveRefetchEnabled)
  React.useEffect(() => {
    const wasEnabled = wasLiveRefetchEnabledRef.current
    wasLiveRefetchEnabledRef.current = liveRefetchEnabled
    if (!projectId || !liveRefetchEnabled || wasEnabled) return
    // When the user focuses the Lab tab again, refresh immediately instead of waiting for the next poll tick.
    queryClient.invalidateQueries({ queryKey: ['lab-agents', projectId] })
    queryClient.invalidateQueries({ queryKey: ['lab-quests', projectId] })
    queryClient.invalidateQueries({ queryKey: ['lab-overview', projectId] })
  }, [liveRefetchEnabled, projectId, queryClient])

  const templatesQuery = useQuery({
    queryKey: ['lab-templates', projectId],
    queryFn: () => listLabTemplates(projectId),
    enabled: Boolean(projectId),
    staleTime: labStaleTime,
  })
  const agentsQuery = useQuery({
    queryKey: ['lab-agents', projectId],
    queryFn: () => listLabAgents(projectId, { silent: true }),
    enabled: Boolean(projectId),
    staleTime: labStaleTime,
    refetchInterval: agentsRefetchInterval,
  })
  const questsQuery = useQuery({
    queryKey: ['lab-quests', projectId],
    queryFn: () => listLabQuests(projectId, { silent: true }),
    enabled: Boolean(projectId),
    staleTime: labStaleTime,
    refetchInterval: questsRefetchInterval,
  })
  const overviewQuery = useQuery({
    queryKey: ['lab-overview', projectId],
    queryFn: () => getLabOverview(projectId, { silent: true }),
    staleTime: labStaleTime,
    refetchInterval: overviewRefetchInterval,
  })
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId),
    staleTime: labStaleTime,
  })

  const templates = templatesQuery.data?.items ?? []
  const agents = agentsQuery.data?.items ?? []
  const quests = questsQuery.data?.items ?? []
  const overview = (overviewQuery.data ?? {}) as LabOverview
  const latestQuestId = React.useMemo(() => {
    if (quests.length === 0) return null
    const latest = quests.reduce((current, candidate) => {
      const currentTime = current?.created_at ? new Date(current.created_at).getTime() : 0
      const candidateTime = candidate?.created_at ? new Date(candidate.created_at).getTime() : 0
      return candidateTime > currentTime ? candidate : current
    }, quests[0])
    return latest?.quest_id ?? null
  }, [quests])
  const projectName = projectQuery.data?.name ?? null

  React.useEffect(() => {
    if (lockedQuestId) {
      setActiveQuest(lockedQuestId)
      return
    }
    if (activeQuestId || !latestQuestId) return
    setActiveQuest(latestQuestId)
  }, [activeQuestId, latestQuestId, lockedQuestId, setActiveQuest])

  React.useEffect(() => {
    clearSelections()
  }, [clearSelections, projectId])

  return (
    <div
      className="lab-root flex h-full min-h-0 flex-col"
      data-activity={isPageActive ? 'active' : 'inactive'}
    >
      <div className={cn('lab-panel h-full min-h-0 flex-1 overflow-hidden')}>
        <LabCanvasStudio
          projectId={projectId}
          readOnly={labReadOnly}
          onRefresh={onRefresh}
          onOpenStageSelection={onOpenStageSelection}
          cliStatus={cliStatus}
          labStream={labStream}
          projectName={projectName}
          templates={templates}
          agents={agents}
          quests={quests}
          overview={overview}
          isLoading={{
            agents: agentsQuery.isLoading,
            quests: questsQuery.isLoading,
            overview: overviewQuery.isLoading,
          }}
          lockedQuestId={lockedQuestId}
          immersiveLockedQuest={immersiveLockedQuest}
        />
      </div>
    </div>
  )
}
