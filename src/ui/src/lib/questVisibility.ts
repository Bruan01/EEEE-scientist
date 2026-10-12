import type { QuestSummary } from '@/types'

type QuestClass = 'research' | 'settings'

function startupContractOf(summary: QuestSummary): Record<string, unknown> | null {
  return summary.startup_contract && typeof summary.startup_contract === 'object'
    ? (summary.startup_contract as Record<string, unknown>)
    : null
}

export function classifyQuest(summary: QuestSummary): QuestClass {
  const declared = String(summary.quest_class || '').trim().toLowerCase()
  if (declared === 'settings' || declared === 'research') {
    return declared
  }
  const questId = String(summary.quest_id || '').trim()
  if (/^S-\d+$/i.test(questId)) return 'settings'
  if (/^B-\d+$/i.test(questId)) return 'research'

  const startupContract = startupContractOf(summary)
  const customProfile = String(startupContract?.custom_profile || '').trim().toLowerCase()
  if (customProfile === 'admin_ops' || customProfile === 'settings_issue') {
    return 'settings'
  }
  return 'research'
}

export function isProjectsVisibleQuest(summary: QuestSummary): boolean {
  if (typeof summary.listed_in_projects === 'boolean') {
    return summary.listed_in_projects
  }
  const startupContract = startupContractOf(summary)
  const workspaceMode = String(summary.workspace_mode || startupContract?.workspace_mode || '')
    .trim()
    .toLowerCase()
  return classifyQuest(summary) === 'research' && (workspaceMode === 'copilot' || workspaceMode === 'autonomous')
}

export function filterProjectsVisibleQuests(items: QuestSummary[]): QuestSummary[] {
  return items.filter(isProjectsVisibleQuest)
}
