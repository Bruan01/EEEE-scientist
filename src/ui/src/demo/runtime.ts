import * as React from 'react'

import type { TutorialDemoScenario } from '@/demo/types'
import { useOnboardingStore } from '@/lib/stores/onboarding'

const DEMO_RUNTIME_STORAGE_KEY = 'ds:demo-runtime:v1'
const DEMO_STAGE_DURATION_MS = 2500
const DEMO_FEED_REVEAL_MS = 850
const DEMO_RUNTIME_EVENT = 'ds:demo-runtime-reset'
const CANVAS_TUTORIAL_STAGE_INDEX = 18

type DemoRuntimeRecord = {
  startedAt: number
}

const runtimeCache = new Map<string, DemoRuntimeRecord>()

function readRuntimeMap(): Record<string, DemoRuntimeRecord> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(DEMO_RUNTIME_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, DemoRuntimeRecord>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeRuntimeMap(payload: Record<string, DemoRuntimeRecord>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DEMO_RUNTIME_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore persistence failures so demo mode never blocks the UI.
  }
}

function getCachedRuntime(projectId: string): DemoRuntimeRecord | null {
  const normalized = String(projectId || '').trim()
  if (!normalized) return null
  const cached = runtimeCache.get(normalized)
  if (cached) return cached
  const stored = readRuntimeMap()[normalized]
  if (stored && typeof stored.startedAt === 'number' && Number.isFinite(stored.startedAt)) {
    runtimeCache.set(normalized, stored)
    return stored
  }
  return null
}

function setCachedRuntime(projectId: string, record: DemoRuntimeRecord) {
  const normalized = String(projectId || '').trim()
  if (!normalized) return
  runtimeCache.set(normalized, record)
  const next = readRuntimeMap()
  next[normalized] = record
  writeRuntimeMap(next)
}

export function ensureDemoRuntime(projectId: string) {
  const normalized = String(projectId || '').trim()
  if (!normalized) {
    return { startedAt: Date.now() }
  }
  const existing = getCachedRuntime(normalized)
  if (existing) return existing
  const created = { startedAt: Date.now() }
  setCachedRuntime(normalized, created)
  return created
}

export function resetDemoRuntime(projectId: string) {
  const normalized = String(projectId || '').trim()
  if (!normalized) return
  const next = { startedAt: Date.now() }
  setCachedRuntime(normalized, next)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(DEMO_RUNTIME_EVENT, {
        detail: {
          projectId: normalized,
          startedAt: next.startedAt,
        },
      })
    )
  }
}

export function getDemoTimelineState(projectId: string, scenario: TutorialDemoScenario, now = Date.now()) {
  const runtime = ensureDemoRuntime(projectId)
  const fallbackStage =
    scenario.stages[0] ??
    ({
      id: 'idle',
      label: { en: 'Idle', zh: '空闲' },
      description: { en: 'No demo scenario is active.', zh: '当前没有激活的 demo 场景。' },
      guideMarkdown: { en: '', zh: '' },
      statusLine: { en: 'No guided workspace is active.', zh: '当前没有激活的引导工作区。' },
      recommendedActions: { en: [], zh: [] },
      visibleNodeIds: [],
      anchor: 'baseline',
      latestMetricValue: 0,
      latestMetricDelta: 0,
      activeToolCount: 0,
      currentNodeId: '',
      graphNodes: [],
      bashExec: {
        cwd: '.',
        command: 'echo no-demo',
        outputLines: ['no demo scenario'],
        status: 'completed',
      },
      feed: [],
      metricCards: [],
      detailFacts: [],
      bestTaskDeltas: [],
      riskTaskDeltas: [],
      connectorSummary: {
        bindingLabel: '',
        targetLabel: '',
        latestStatus: 'idle',
        latestMessage: '',
      },
      chatSuggestions: [],
    } as TutorialDemoScenario['stages'][number])
  const elapsedMs = Math.max(0, now - runtime.startedAt)
  const totalStages = Math.max(1, scenario.stages.length || 1)
  const elapsedStageIndex = Math.min(totalStages - 1, Math.floor(elapsedMs / DEMO_STAGE_DURATION_MS))
  const tutorialStageFloor = resolveTutorialStageFloor(projectId, totalStages)
  const stageIndex = tutorialStageFloor == null ? elapsedStageIndex : Math.max(elapsedStageIndex, tutorialStageFloor)
  const stageElapsedMs = stageIndex >= totalStages - 1 ? elapsedMs : elapsedMs % DEMO_STAGE_DURATION_MS
  const currentStage = scenario.stages[stageIndex] ?? fallbackStage
  const revealedCurrentStageFeedCount = currentStage.feed.length
    ? Math.min(currentStage.feed.length, 1 + Math.floor(stageElapsedMs / DEMO_FEED_REVEAL_MS))
    : 0
  return {
    startedAt: runtime.startedAt,
    elapsedMs,
    stageIndex,
    totalStages,
    currentStage,
    revealedCurrentStageFeedCount,
  }
}

function resolveTutorialStageFloor(projectId: string, totalStages: number): number | null {
  if (typeof window === 'undefined') return null
  if (!/^demo-/.test(String(projectId || '').trim())) return null
  if (!/(?:^|\/)projects\/demo-/.test(window.location.pathname)) return null
  const state = useOnboardingStore.getState()
  if (state.status !== 'running') return null
  if (state.stepIndex < CANVAS_TUTORIAL_STAGE_INDEX) return null
  return totalStages - 1
}

export function useDemoRuntimeTick(projectId: string) {
  const [tick, setTick] = React.useState(() => {
    ensureDemoRuntime(projectId)
    return Date.now()
  })

  React.useEffect(() => {
    ensureDemoRuntime(projectId)
    const interval = window.setInterval(() => {
      setTick(Date.now())
    }, 500)
    const handleReset = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail
      if (!detail?.projectId || detail.projectId === projectId) {
        setTick(Date.now())
      }
    }
    window.addEventListener(DEMO_RUNTIME_EVENT, handleReset as EventListener)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener(DEMO_RUNTIME_EVENT, handleReset as EventListener)
    }
  }, [projectId])

  return tick
}
