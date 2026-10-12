'use client'

import * as React from 'react'
import { CornerDownLeft, Map as MapIcon, Search, User, X } from 'lucide-react'
import type { PluginComponentProps } from '@/lib/types/plugin'
import { BUILTIN_PLUGINS } from '@/lib/types/plugin'
import type { FileNode, FileSearchItem } from '@/lib/types/file'
import { useFileTreeStore } from '@/lib/stores/file-tree'
import { useLabCopilotStore } from '@/lib/stores/lab-copilot'
import { useTabsStore } from '@/lib/stores/tabs'
import { useOpenFile } from '@/hooks/useOpenFile'
import { FileIcon } from '@/components/file-tree'
import { cn } from '@/lib/utils'
import { searchFiles } from '@/lib/api/files'
import {
  listLabAgents,
  listLabQuests,
  searchLabQuest,
  type LabAgentInstance,
  type LabQuest,
  type LabQuestEventItem,
  type LabQuestGraphNode,
  type LabQuestSearchItem,
} from '@/lib/api/lab'
import {
  resolveAgentDisplayName,
  resolveAgentMentionLabel,
  formatRelativeTime,
  resolveQuestLabel,
} from '@/lib/plugins/lab/components/lab-helpers'
import { useI18n } from '@/lib/i18n/useI18n'
import './search.css'

type SearchScope = 'all' | 'files' | 'lab'

type LabSearchResult = {
  kind: 'agent' | 'quest'
  id: string
  title: string
  subtitle: string
  meta?: string
  accent?: string
  agent?: LabAgentInstance
  quest?: LabQuest
}

type QuestSearchView = {
  id: string
  kind: 'quest-event' | 'quest-branch'
  questId: string
  title: string
  subtitle: string
  meta?: string
  event?: LabQuestEventItem | null
  branch?: LabQuestGraphNode | null
}

type LabFocusPayload = {
  projectId: string
  focusType: 'agent' | 'quest' | 'quest-branch' | 'quest-event'
  focusId: string
  branch?: string | null
  eventId?: string | null
}

type FileResultView = {
  item: FileSearchItem
  node: FileNode | undefined
  name: string
  type: FileNode['type']
  mimeType?: string
  path: string
}

const LAB_FOCUS_EVENT = 'ds:lab:focus'

function getProjectIdFromContext(context: PluginComponentProps['context']): string | null {
  const projectId = context.customData?.projectId
  return typeof projectId === 'string' ? projectId : null
}

function getReadOnlyFromContext(context: PluginComponentProps['context']): boolean {
  return Boolean(context.customData?.readOnly)
}

export default function SearchPlugin({ context, setTitle }: PluginComponentProps) {
  const { t } = useI18n('search')
  React.useEffect(() => setTitle(t('title')), [setTitle, t])

  const projectId = getProjectIdFromContext(context)
  const readOnly = getReadOnlyFromContext(context)
  const initialQuery =
    typeof context.customData?.query === 'string' ? context.customData.query : ''

  const nodes = useFileTreeStore((s) => s.nodes)
  const findNode = useFileTreeStore((s) => s.findNode)
  const findNodeByPath = useFileTreeStore((s) => s.findNodeByPath)
  const storeProjectId = useFileTreeStore((s) => s.projectId)
  const isTreeLoading = useFileTreeStore((s) => s.isLoading)
  const loadFiles = useFileTreeStore((s) => s.loadFiles)

  const openTab = useTabsStore((s) => s.openTab)
  const setActiveTab = useTabsStore((s) => s.setActiveTab)
  const tabs = useTabsStore((s) => s.tabs)
  const activeQuestId = useLabCopilotStore((s) => s.activeQuestId)

  const { openFileInTab } = useOpenFile()

  const inputRef = React.useRef<HTMLInputElement>(null)
  const [query, setQuery] = React.useState(initialQuery)
  const [fileResults, setFileResults] = React.useState<FileSearchItem[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const [fileError, setFileError] = React.useState<string | null>(null)
  const [truncated, setTruncated] = React.useState(false)
  const [scope, setScope] = React.useState<SearchScope>('all')
  const requestSeq = React.useRef(0)

  const [labAgents, setLabAgents] = React.useState<LabAgentInstance[]>([])
  const [labQuests, setLabQuests] = React.useState<LabQuest[]>([])
  const [labLoading, setLabLoading] = React.useState(false)
  const [labError, setLabError] = React.useState<string | null>(null)
  const [questSearchItems, setQuestSearchItems] = React.useState<LabQuestSearchItem[]>([])
  const [questSearchCursor, setQuestSearchCursor] = React.useState<string | null>(null)
  const [questSearchHasMore, setQuestSearchHasMore] = React.useState(false)
  const [questSearchLoading, setQuestSearchLoading] = React.useState(false)
  const [questSearchError, setQuestSearchError] = React.useState<string | null>(null)
  const questSearchSeq = React.useRef(0)
  const questSearchIds = React.useRef<Set<string>>(new Set())

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  React.useEffect(() => {
    if (!projectId) return
    if (storeProjectId === projectId) return
    void loadFiles(projectId)
  }, [projectId, storeProjectId, loadFiles])

  React.useEffect(() => {
    if (!projectId) {
      setLabAgents([])
      setLabQuests([])
      setLabError(null)
      return
    }
    let isActive = true
    setLabLoading(true)
    setLabError(null)
    Promise.all([listLabAgents(projectId), listLabQuests(projectId)])
      .then(([agentResponse, questResponse]) => {
        if (!isActive) return
        setLabAgents(agentResponse.items ?? [])
        setLabQuests(questResponse.items ?? [])
      })
      .catch(() => {
        if (!isActive) return
        setLabError('Lab search is unavailable right now.')
        setLabAgents([])
        setLabQuests([])
      })
      .finally(() => {
        if (!isActive) return
        setLabLoading(false)
      })
    return () => {
      isActive = false
    }
  }, [projectId])

  const buildSearchPattern = React.useCallback((raw: string) => {
    const trimmed = raw.trim()
    const normalized = trimmed.replace(/^\/+/, '')
    if (!normalized) return ''
    return normalized
  }, [])

  const questSearchConfig = React.useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      return { questId: null as string | null, queryText: '', types: undefined as string | undefined }
    }
    const tokenRegex = /(\w+):(".*?"|\S+)/g
    let questId: string | null = null
    const types = new Set<string>()
    const terms: string[] = []
    let cleaned = trimmed.replace(tokenRegex, (_full, key, value) => {
      const normalizedKey = String(key).toLowerCase()
      const rawValue = String(value || '').replace(/^"|"$/g, '')
      if (normalizedKey === 'quest') {
        questId = rawValue || questId
        return ''
      }
      if (normalizedKey === 'event') {
        types.add('event')
        if (rawValue) terms.push(rawValue)
        return ''
      }
      if (normalizedKey === 'branch') {
        types.add('branch')
        if (rawValue) terms.push(rawValue)
        return ''
      }
      if (rawValue) terms.push(rawValue)
      return ''
    })
    cleaned = cleaned.replace(tokenRegex, '').trim()
    if (cleaned) terms.push(cleaned)
    const queryText = terms.join(' ').trim()
    const contextQuestId =
      typeof context.customData?.questId === 'string' ? context.customData.questId : null
    const resolvedQuestId = questId || contextQuestId || activeQuestId || null
    return {
      questId: resolvedQuestId,
      queryText,
      types: types.size ? Array.from(types).join(',') : undefined,
    }
  }, [activeQuestId, context.customData?.questId, query])

  React.useEffect(() => {
    const trimmed = query.trim()
    if (!projectId || trimmed.length === 0) {
      setFileResults([])
      setTruncated(false)
      setFileError(null)
      setIsSearching(false)
      return
    }

    const currentSeq = requestSeq.current + 1
    requestSeq.current = currentSeq
    setIsSearching(true)
    setFileError(null)

    const timer = setTimeout(() => {
      const pattern = buildSearchPattern(trimmed)
      if (!pattern) {
        setFileResults([])
        setTruncated(false)
        setIsSearching(false)
        return
      }

      void (async () => {
        try {
          const response = await searchFiles(projectId, {
            pattern,
            include_folders: false,
            limit: 50,
            sort_by: 'updated_at',
            sort_order: 'desc',
          })
          if (requestSeq.current !== currentSeq) return
          setFileResults(response.items ?? [])
          setTruncated(Boolean(response.truncated))
        } catch (err) {
          if (requestSeq.current !== currentSeq) return
          setFileError('Search failed. Please try again.')
          setFileResults([])
          setTruncated(false)
        } finally {
          if (requestSeq.current === currentSeq) {
            setIsSearching(false)
          }
        }
      })()
    }, 200)

    return () => {
      clearTimeout(timer)
    }
  }, [buildSearchPattern, projectId, query])

  const fetchQuestSearch = React.useCallback(
    async (cursor: string | null, append: boolean) => {
      if (!projectId) return
      if (!questSearchConfig.questId) return
      if (!questSearchConfig.queryText.trim()) return
      setQuestSearchLoading(true)
      setQuestSearchError(null)
      try {
        const response = await searchLabQuest(projectId, questSearchConfig.questId, {
          query: questSearchConfig.queryText,
          types: questSearchConfig.types,
          limit: 20,
          cursor: cursor ?? undefined,
        })
        const items = response.items ?? []
        const nextCursor = response.next_cursor ?? null
        const hasMore = Boolean(response.has_more || nextCursor)
        if (!append) {
          questSearchIds.current = new Set()
        }
        setQuestSearchItems((prev) => {
          const next: LabQuestSearchItem[] = append ? [...prev] : []
          items.forEach((item) => {
            const id =
              item.item_type === 'event'
                ? `event:${item.event?.event_id ?? ''}`
                : `branch:${item.branch?.node_id ?? ''}`
            if (!id || questSearchIds.current.has(id)) return
            questSearchIds.current.add(id)
            next.push(item)
          })
          return next
        })
        setQuestSearchCursor(nextCursor)
        setQuestSearchHasMore(hasMore)
      } catch {
        setQuestSearchError('Quest search is unavailable right now.')
        setQuestSearchItems([])
        setQuestSearchCursor(null)
        setQuestSearchHasMore(false)
      } finally {
        setQuestSearchLoading(false)
      }
    },
    [projectId, questSearchConfig]
  )

  React.useEffect(() => {
    if (!projectId || scope === 'files') {
      setQuestSearchItems([])
      setQuestSearchCursor(null)
      setQuestSearchHasMore(false)
      setQuestSearchError(null)
      return
    }
    const trimmed = query.trim()
    if (!trimmed) {
      setQuestSearchItems([])
      setQuestSearchCursor(null)
      setQuestSearchHasMore(false)
      setQuestSearchError(null)
      return
    }
    if (!questSearchConfig.questId) {
      setQuestSearchItems([])
      setQuestSearchCursor(null)
      setQuestSearchHasMore(false)
      setQuestSearchError('Add quest:<id> to search quest graph.')
      return
    }
    if (!questSearchConfig.queryText.trim()) {
      setQuestSearchItems([])
      setQuestSearchCursor(null)
      setQuestSearchHasMore(false)
      setQuestSearchError('Add search terms after quest:<id>.')
      return
    }
    const currentSeq = questSearchSeq.current + 1
    questSearchSeq.current = currentSeq
    const timer = setTimeout(() => {
      if (questSearchSeq.current !== currentSeq) return
      fetchQuestSearch(null, false).catch(() => undefined)
    }, 200)
    return () => clearTimeout(timer)
  }, [fetchQuestSearch, projectId, query, questSearchConfig, scope])

  const openResult = React.useCallback(
    async (item: FileSearchItem) => {
      if (!projectId) return
      let node = findNode(item.id) || findNodeByPath(item.path)
      if (!node) {
        await loadFiles(projectId, { force: true })
        node = findNode(item.id) || findNodeByPath(item.path)
      }
      if (!node) return
      if (node.type !== 'file' && node.type !== 'notebook') return
      const options = { customData: { projectId } }
      await openFileInTab(node, options)
    },
    [findNode, findNodeByPath, loadFiles, openFileInTab, projectId]
  )

  const openLabFocus = React.useCallback(
    (focusType: LabFocusPayload['focusType'], focusId: string, branch?: string | null, eventId?: string | null) => {
      if (!projectId) return
      const focusPayload: LabFocusPayload = {
        projectId,
        focusType,
        focusId,
        branch: branch ?? null,
        eventId: eventId ?? null,
      }
      const focusWindow = window as typeof window & {
        __dsLabPendingFocus?: LabFocusPayload | null
      }
      focusWindow.__dsLabPendingFocus = focusPayload
      const existing = tabs.find((tab) => {
        if (tab.pluginId !== BUILTIN_PLUGINS.LAB) return false
        if (tab.context.type !== 'custom') return false
        const data = tab.context.customData as { projectId?: string } | undefined
        return data?.projectId === projectId
      })
      if (existing) {
        setActiveTab(existing.id)
        window.dispatchEvent(new CustomEvent(LAB_FOCUS_EVENT, { detail: focusPayload }))
        return
      }
      openTab({
        pluginId: BUILTIN_PLUGINS.LAB,
        context: {
          type: 'custom',
          customData: {
            projectId,
            readOnly,
          },
        },
        title: 'Home',
      })
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent(LAB_FOCUS_EVENT, { detail: focusPayload }))
      })
    },
    [openTab, projectId, readOnly, setActiveTab, tabs]
  )

  const canSearch = Boolean(projectId)
  const trimmedQuery = query.trim()
  const normalizedQuery = trimmedQuery.toLowerCase()

  const fileResultsView = React.useMemo<FileResultView[]>(
    () =>
      fileResults.map((item) => {
        const node = findNode(item.id)
        return {
          item,
          node: node ?? undefined,
          name: node?.name ?? item.name,
          type: (node?.type ?? item.type) as FileNode['type'],
          mimeType: node?.mimeType ?? item.mime_type,
          path: node?.path ?? item.path ?? '—',
        }
      }),
    [fileResults, findNode, nodes]
  )

  const questById = React.useMemo(() => {
    return new Map(labQuests.map((quest) => [quest.quest_id, quest]))
  }, [labQuests])

  const matchesQuery = React.useCallback(
    (value?: string | null) => {
      if (!normalizedQuery) return false
      if (!value) return false
      return value.toLowerCase().includes(normalizedQuery)
    },
    [normalizedQuery]
  )

  const agentResults = React.useMemo<LabSearchResult[]>(() => {
    if (!normalizedQuery) return []
    return labAgents
      .filter((agent) => {
        const name = resolveAgentDisplayName(agent)
        const mention = resolveAgentMentionLabel(agent)
        return (
          matchesQuery(name) ||
          matchesQuery(mention) ||
          matchesQuery(agent.agent_id) ||
          matchesQuery(agent.template_id)
        )
      })
      .map((agent) => {
        const title = resolveAgentDisplayName(agent)
        const mention = resolveAgentMentionLabel(agent)
        const activeQuest = agent.active_quest_id
          ? questById.get(agent.active_quest_id)
          : null
        const status = agent.status?.trim()
          ? agent.status
          : activeQuest
            ? `Quest: ${resolveQuestLabel(activeQuest)}`
            : 'Idle'
        return {
          kind: 'agent' as const,
          id: agent.instance_id,
          title,
          subtitle: `${mention} · ${status}`,
          accent: agent.avatar_frame_color ?? undefined,
          agent,
        }
      })
      .slice(0, 20)
  }, [labAgents, matchesQuery, normalizedQuery, questById])

  const questResults = React.useMemo<LabSearchResult[]>(() => {
    if (!normalizedQuery) return []
    return labQuests
      .filter((quest) => {
        const tags = quest.tags ?? []
        return (
          matchesQuery(quest.title) ||
          matchesQuery(quest.description) ||
          matchesQuery(quest.quest_id) ||
          tags.some((tag) => matchesQuery(tag))
        )
      })
      .map((quest) => {
        const title = resolveQuestLabel(quest)
        const subtitle = quest.description?.trim() || 'Quest pipeline'
        return {
          kind: 'quest' as const,
          id: quest.quest_id,
          title,
          subtitle,
          meta: quest.tags?.join(', '),
          accent: '#4d7c84',
          quest,
        }
      })
      .slice(0, 20)
  }, [labQuests, matchesQuery, normalizedQuery])

  const questSearchView = React.useMemo<QuestSearchView[]>(() => {
    if (!questSearchItems.length || !questSearchConfig.questId) return []
    return questSearchItems.map((item) => {
      if (item.item_type === 'event') {
        const event = item.event ?? null
        const title = event?.event_type || 'Event'
        const subtitle = event?.reply_to_pi || event?.payload_summary || 'Quest event'
        const meta = `${event?.branch_name || 'main'} · ${formatRelativeTime(event?.created_at)}`
        return {
          id: event?.event_id || `${title}-${meta}`,
          kind: 'quest-event',
          questId: questSearchConfig.questId as string,
          title,
          subtitle,
          meta,
          event,
          branch: null,
        }
      }
      const branch = item.branch ?? null
      const title = branch?.branch_name || 'Branch'
      const subtitle = branch?.idea_id ? `Idea ${branch.idea_id}` : branch?.status || 'Quest branch'
      const meta = branch?.verdict ? `Verdict: ${branch.verdict}` : null
      return {
        id: branch?.node_id || `${title}-${subtitle}`,
        kind: 'quest-branch',
        questId: questSearchConfig.questId as string,
        title,
        subtitle,
        meta: meta || undefined,
        event: null,
        branch,
      }
    })
  }, [questSearchConfig.questId, questSearchItems])

  const showFiles = scope !== 'lab'
  const showLab = scope !== 'files'
  const agentCount = agentResults.length
  const questCount = questResults.length
  const questSearchCount = questSearchView.length
  const labCount = agentCount + questCount + questSearchCount
  const fileCount = fileResultsView.length
  const hasResults =
    (showLab && labCount > 0) || (showFiles && fileCount > 0)

  const topResult = React.useMemo<LabSearchResult | QuestSearchView | FileResultView | null>(() => {
    if (scope === 'lab') {
      return questSearchView[0] ?? agentResults[0] ?? questResults[0] ?? null
    }
    if (scope === 'files') {
      return fileResultsView[0] ?? null
    }
    return questSearchView[0] ?? agentResults[0] ?? questResults[0] ?? fileResultsView[0] ?? null
  }, [agentResults, fileResultsView, questResults, questSearchView, scope])

  const handleEnter = React.useCallback(() => {
    if (!topResult) return
    if ('item' in topResult) {
      void openResult(topResult.item)
      return
    }
    if ('kind' in topResult) {
      switch (topResult.kind) {
        case 'quest-event':
          openLabFocus(
            'quest-event',
            topResult.questId,
            topResult.event?.branch_name,
            topResult.event?.event_id
          )
          return
        case 'quest-branch':
          openLabFocus('quest-branch', topResult.questId, topResult.branch?.branch_name, null)
          return
        case 'agent':
          if (topResult.agent) {
            openLabFocus('agent', topResult.agent.instance_id)
          }
          return
        case 'quest':
          if (topResult.quest) {
            openLabFocus('quest', topResult.quest.quest_id)
          }
          return
        default:
          return
      }
    }
  }, [openLabFocus, openResult, topResult])

  return (
    <div className="ds-search-surface">
      <div className="ds-search-shell">
        <div className="ds-search-header">
          <div>
            <div className="ds-search-kicker">{t('kicker')}</div>
            <h1 className="ds-search-title">{t('title')}</h1>
            <p className="ds-search-subtitle">
              {t('subtitle')}
            </p>
          </div>
          <div className="ds-search-shortcut">
            <span>{t('shortcut')}</span>
            <kbd>⌘K</kbd>
          </div>
        </div>

        <div className={cn('ds-search-field', !canSearch && 'opacity-60')}>
          <Search className="h-4 w-4 text-[#6f5c46]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleEnter()
              }
            }}
            placeholder={
              !canSearch
                ? t('placeholder_disabled')
                : isTreeLoading
                  ? t('placeholder_indexing')
                  : t('placeholder_default')
            }
            className="ds-search-input"
            disabled={!canSearch}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="ds-search-clear"
              aria-label={t('clear_search')}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="ds-search-scope">
          {(
            [
              { id: 'all', label: t('scope_all'), count: fileCount + labCount },
              { id: 'files', label: t('scope_files'), count: fileCount },
              { id: 'lab', label: t('scope_lab'), count: labCount },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              className="ds-search-chip"
              data-active={scope === item.id}
              onClick={() => setScope(item.id)}
            >
              {item.label}
              <span>{item.count}</span>
            </button>
          ))}
        </div>

        <div className="ds-search-panel">
          {trimmedQuery.length === 0 ? (
            <div className="ds-search-empty">
              <h3>{t('try_title')}</h3>
              <ul className="space-y-1 list-disc pl-5">
                <li>{t('try_goals')}</li>
                <li>{t('try_agents')}</li>
                <li>{t('try_paths')}</li>
              </ul>
              <div className="ds-search-hint">
                <CornerDownLeft className="h-3.5 w-3.5" />
                {t('press_enter_hint')}
              </div>
            </div>
          ) : (
            <div>
              {showLab ? (
                <div>
                  <div className="ds-search-section" style={{ '--ds-delay': '0s' } as React.CSSProperties}>
                    <div className="ds-search-section-title">
                      <span>{t('section_agents')}</span>
                      <span className="ds-search-section-meta">{t('results_count', { count: agentCount })}</span>
                    </div>
                  </div>
                  {labLoading && agentCount === 0 ? (
                    <div className="ds-search-status">{t('loading_lab_agents')}</div>
                  ) : labError ? (
                    <div className="ds-search-status">{labError}</div>
                  ) : agentCount === 0 ? (
                    <div className="ds-search-status">{t('no_agents')}</div>
                  ) : (
                    <div className="ds-search-result-list">
                      {agentResults.map((agent, index) => (
                        <button
                          key={agent.id}
                          type="button"
                          className="ds-search-result"
                          style={
                            {
                              '--ds-search-accent': agent.accent ?? '#c2a15c',
                              '--ds-delay': `${index * 0.04}s`,
                            } as React.CSSProperties
                          }
                          onClick={() => {
                            if (!agent.agent) return
                            openLabFocus('agent', agent.agent.instance_id)
                          }}
                        >
                          <span className="ds-search-result-mark">
                            <User className="h-4 w-4" />
                          </span>
                          <div className="ds-search-result-body">
                            <div className="ds-search-result-title">{agent.title}</div>
                            <div className="ds-search-result-subtitle">{agent.subtitle}</div>
                          </div>
                          <span className="ds-search-badge">{t('badge_agent')}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="ds-search-section" style={{ '--ds-delay': '0.04s' } as React.CSSProperties}>
                    <div className="ds-search-section-title">
                      <span>{t('section_quest_graph')}</span>
                      <span className="ds-search-section-meta">{t('results_count', { count: questSearchCount })}</span>
                    </div>
                  </div>
                  {questSearchLoading && questSearchCount === 0 ? (
                    <div className="ds-search-status">{t('searching_quest_graph')}</div>
                  ) : questSearchError ? (
                    <div className="ds-search-status">{questSearchError}</div>
                  ) : questSearchCount === 0 ? (
                    <div className="ds-search-status">{t('no_quest_graph')}</div>
                  ) : (
                    <div className="ds-search-result-list">
                      {questSearchView.map((result, index) => (
                        <button
                          key={result.id}
                          type="button"
                          className="ds-search-result"
                          style={
                            {
                              '--ds-search-accent': '#a67c52',
                              '--ds-delay': `${index * 0.04}s`,
                            } as React.CSSProperties
                          }
                          onClick={() => {
                            if (result.kind === 'quest-event') {
                              openLabFocus(
                                'quest-event',
                                result.questId,
                                result.event?.branch_name,
                                result.event?.event_id
                              )
                              return
                            }
                            openLabFocus(
                              'quest-branch',
                              result.questId,
                              result.branch?.branch_name,
                              null
                            )
                          }}
                        >
                          <span className="ds-search-result-mark">
                            {result.kind === 'quest-event' ? (
                              <Search className="h-4 w-4" />
                            ) : (
                              <MapIcon className="h-4 w-4" />
                            )}
                          </span>
                          <div className="ds-search-result-body">
                            <div className="ds-search-result-title">{result.title}</div>
                            <div className="ds-search-result-subtitle">{result.subtitle}</div>
                            {result.meta ? (
                              <div className="ds-search-result-meta">{result.meta}</div>
                            ) : null}
                          </div>
                          <span className="ds-search-badge">
                            {result.kind === 'quest-event' ? t('badge_event') : t('badge_branch')}
                          </span>
                        </button>
                      ))}
                      {questSearchHasMore ? (
                        <button
                          type="button"
                          className="ds-search-load"
                          onClick={() => fetchQuestSearch(questSearchCursor, true)}
                          disabled={questSearchLoading}
                        >
                          {questSearchLoading ? t('loading_more') : t('load_more')}
                        </button>
                      ) : null}
                    </div>
                  )}

                  <div className="ds-search-section" style={{ '--ds-delay': '0.04s' } as React.CSSProperties}>
                    <div className="ds-search-section-title">
                      <span>{t('section_quests')}</span>
                      <span className="ds-search-section-meta">{t('results_count', { count: questCount })}</span>
                    </div>
                  </div>
                  {labLoading && questCount === 0 ? (
                    <div className="ds-search-status">{t('loading_quests')}</div>
                  ) : labError ? (
                    <div className="ds-search-status">{labError}</div>
                  ) : questCount === 0 ? (
                    <div className="ds-search-status">{t('no_quests')}</div>
                  ) : (
                    <div className="ds-search-result-list">
                      {questResults.map((quest, index) => (
                        <button
                          key={quest.id}
                          type="button"
                          className="ds-search-result"
                          style={
                            {
                              '--ds-search-accent': quest.accent ?? '#4d7c84',
                              '--ds-delay': `${index * 0.04}s`,
                            } as React.CSSProperties
                          }
                          onClick={() => {
                            if (!quest.quest) return
                            openLabFocus('quest', quest.quest.quest_id)
                          }}
                        >
                          <span className="ds-search-result-mark">
                            <MapIcon className="h-4 w-4" />
                          </span>
                          <div className="ds-search-result-body">
                            <div className="ds-search-result-title">{quest.title}</div>
                            <div className="ds-search-result-subtitle">{quest.subtitle}</div>
                            {quest.meta ? (
                              <div className="ds-search-result-meta">{quest.meta}</div>
                            ) : null}
                          </div>
                          <span className="ds-search-badge">{t('badge_quest')}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {showFiles ? (
                <div>
                  <div className="ds-search-section" style={{ '--ds-delay': '0.08s' } as React.CSSProperties}>
                    <div className="ds-search-section-title">
                      <span>{t('section_files')}</span>
                      <span className="ds-search-section-meta">{t('results_count', { count: fileCount })}</span>
                    </div>
                  </div>
                  {fileError ? (
                    <div className="ds-search-status">{fileError}</div>
                  ) : isSearching ? (
                    <div className="ds-search-status">{t('searching_files')}</div>
                  ) : fileCount === 0 ? (
                    <div className="ds-search-status">{t('no_files')}</div>
                  ) : (
                    <div className="ds-search-result-list">
                      {fileResultsView.map((file, index) => (
                        <button
                          key={file.item.id}
                          type="button"
                          className="ds-search-result"
                          style={{ '--ds-delay': `${index * 0.03}s` } as React.CSSProperties}
                          onClick={() => void openResult(file.item)}
                        >
                          <span className="ds-search-result-mark">
                            <FileIcon
                              type={file.type}
                              mimeType={file.mimeType}
                              name={file.name}
                              className="h-4 w-4"
                            />
                          </span>
                          <div className="ds-search-result-body">
                            <div className="ds-search-result-title">{file.name}</div>
                            <div className="ds-search-result-subtitle">{file.path}</div>
                          </div>
                          <span className="ds-search-badge">{t('badge_file')}</span>
                        </button>
                      ))}
                      {truncated ? (
                        <div className="ds-search-status">{t('truncated')}</div>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}

              {!hasResults && !isSearching && !labLoading && !fileError && !labError ? (
                <div className="ds-search-status">{t('no_results')}</div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
