import type { AgentDescriptor } from '@/lib/api/projects'

export const DEFAULT_AGENT_ID = 'chat-worker'

const MENTION_PATTERN = /^@([^\s]+)(?:\s+|$)/

const buildDefaultAgent = (): AgentDescriptor => ({
  id: DEFAULT_AGENT_ID,
  label: '@chat-worker',
  description: 'Default chat agent',
  role: 'chat-worker',
  source: 'backend',
  execution_target: 'sandbox',
})

const normalizeLabel = (agent: AgentDescriptor) => {
  const label = typeof agent.label === 'string' ? agent.label.trim() : ''
  if (!label) return `@${agent.id}`
  return label.startsWith('@') ? label : `@${label}`
}

const findAgent = (agents: AgentDescriptor[], mentionId: string) => {
  const normalized = mentionId.trim().toLowerCase()
  if (!normalized) return null
  const byId = agents.find((agent) => agent.id.toLowerCase() === normalized)
  if (byId) return byId
  return agents.find((agent) => normalizeLabel(agent).slice(1).toLowerCase() === normalized) ?? null
}

const buildMentionCatalog = (agents: AgentDescriptor[]) => {
  const seen = new Set<string>()
  const entries: Array<{ agent: AgentDescriptor; label: string }> = []
  agents.forEach((agent) => {
    const primary = normalizeLabel(agent)
    const idLabel = `@${agent.id}`
    const candidates = [primary, idLabel]
    candidates.forEach((label) => {
      const key = label.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      entries.push({ agent, label })
    })
  })
  return entries
}

export const ensureDefaultAgent = (agents: AgentDescriptor[]): AgentDescriptor[] => {
  const list = Array.isArray(agents) ? agents : []
  const hasDefault = list.some((agent) => agent.id === DEFAULT_AGENT_ID)
  if (hasDefault) return list
  return [buildDefaultAgent(), ...list]
}

export type MentionResolution = {
  agent: AgentDescriptor
  displayMessage: string
  agentMessage: string
  matched: boolean
}

export const resolveAgentMention = (
  message: string,
  agents: AgentDescriptor[],
  options?: { enabled?: boolean; defaultAgent?: AgentDescriptor }
): MentionResolution => {
  const raw = message || ''
  const trimmed = raw.trim()
  const baseCatalog = ensureDefaultAgent(agents)
  const defaultAgent = options?.defaultAgent
  const catalog =
    defaultAgent && !baseCatalog.some((agent) => agent.id === defaultAgent.id)
      ? [defaultAgent, ...baseCatalog]
      : baseCatalog
  const fallback = defaultAgent ?? catalog.find((agent) => agent.id === DEFAULT_AGENT_ID) ?? buildDefaultAgent()
  const mentionsEnabled = options?.enabled ?? true

  if (!trimmed) {
    return { agent: fallback, displayMessage: '', agentMessage: '', matched: false }
  }

  if (!mentionsEnabled || !raw.startsWith('@')) {
    return { agent: fallback, displayMessage: trimmed, agentMessage: trimmed, matched: false }
  }

  const mentionCatalog = buildMentionCatalog(catalog)
  const trimmedLower = trimmed.toLowerCase()
  const boundaryMatches = mentionCatalog
    .filter((entry) => {
      if (!trimmedLower.startsWith(entry.label.toLowerCase())) return false
      const nextChar = trimmed[entry.label.length]
      return nextChar == null || /\s/.test(nextChar)
    })
    .sort((a, b) => b.label.length - a.label.length)
  const prefixMatches =
    boundaryMatches.length > 0
      ? boundaryMatches
      : mentionCatalog
          .filter((entry) => trimmedLower.startsWith(entry.label.toLowerCase()))
          .sort((a, b) => b.label.length - a.label.length)

  const chosen = prefixMatches[0] ?? null
  if (!chosen) {
    const match = trimmed.match(MENTION_PATTERN)
    if (!match) {
      return { agent: fallback, displayMessage: trimmed, agentMessage: trimmed, matched: false }
    }
    const mentionId = match[1] ?? ''
    const resolved = findAgent(catalog, mentionId) ?? fallback
    const remainder = trimmed.slice(match[0].length).trim()
    if (!resolved || (resolved.id === fallback.id && mentionId.toLowerCase() !== fallback.id)) {
      return { agent: fallback, displayMessage: trimmed, agentMessage: trimmed, matched: false }
    }
    return {
      agent: resolved,
      displayMessage: trimmed,
      agentMessage: remainder,
      matched: true,
    }
  }

  const resolved = chosen.agent
  const remainder = trimmed.slice(chosen.label.length).trimStart()
  if (!resolved || resolved.id === fallback.id) {
    return { agent: fallback, displayMessage: trimmed, agentMessage: trimmed, matched: false }
  }

  return {
    agent: resolved,
    displayMessage: trimmed,
    agentMessage: remainder,
    matched: true,
  }
}
