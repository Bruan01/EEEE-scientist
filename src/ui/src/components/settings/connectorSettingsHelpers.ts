import type { ConnectorName } from './connectorCatalog'
import type { ConnectorProfileSnapshot, ConnectorTargetSnapshot } from '@/types'

type QqProfileLike = {
  profile_id?: string
  bot_name?: string
  app_id?: string
}

const LINGZHU_EXAMPLE_AUTH_AKS = new Set(['abcd1234-abcd-abcd-abcd-abcdefghijkl'])
const GENERIC_CONNECTOR_REQUIRED_FIELDS: Record<string, string[]> = {
  telegram: ['bot_token'],
  discord: ['bot_token'],
  slack: ['bot_token', 'app_token'],
  feishu: ['app_id', 'app_secret'],
  whatsapp: ['session_dir'],
}

function textValue(value: unknown) {
  return String(value || '').trim()
}

function hasSecret(profile: Record<string, unknown>, key: string) {
  return Boolean(textValue(profile[key]) || textValue(profile[`${key}_env`]))
}

function isPublicHttpUrl(value: string) {
  if (!value) return false
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    const host = url.hostname.trim().toLowerCase()
    if (!host || host === 'localhost' || host === '0.0.0.0' || host === '127.0.0.1' || host === '::1') {
      return false
    }
    if (/^10\./.test(host)) return false
    if (/^192\.168\./.test(host)) return false
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false
    return true
  } catch {
    return false
  }
}

function qqProfiles(config: Record<string, unknown>) {
  const rawProfiles = Array.isArray(config.profiles) ? config.profiles.filter((item) => item && typeof item === 'object') : []
  if (rawProfiles.length > 0) {
    return rawProfiles as Array<Record<string, unknown>>
  }
  if (textValue(config.app_id) || hasSecret(config, 'app_secret')) {
    return [config]
  }
  return []
}

function genericProfiles(config: Record<string, unknown>, connectorName: string) {
  const rawProfiles = Array.isArray(config.profiles) ? config.profiles.filter((item) => item && typeof item === 'object') : []
  if (rawProfiles.length > 0) {
    return rawProfiles as Array<Record<string, unknown>>
  }
  if (connectorName === 'whatsapp') {
    const sessionDir = textValue(config.session_dir)
    if (sessionDir && sessionDir !== '~/.deepscientist/connectors/whatsapp') {
      return [config]
    }
    return []
  }
  const requiredFields = GENERIC_CONNECTOR_REQUIRED_FIELDS[connectorName] || []
  if (requiredFields.some((key) => (key.endsWith('_secret') || key.endsWith('_token') ? hasSecret(config, key) : textValue(config[key])))) {
    return [config]
  }
  return []
}

export function qqProfileDisplayLabel(
  profile: QqProfileLike,
  snapshot?: Pick<ConnectorProfileSnapshot, 'label'> | null
): string {
  const snapshotLabel = String(snapshot?.label || '').trim()
  if (snapshotLabel) {
    return snapshotLabel
  }
  const botName = String(profile.bot_name || '').trim()
  const appId = String(profile.app_id || '').trim()
  if (botName && appId) {
    return `${botName} · ${appId}`
  }
  return botName || appId || String(profile.profile_id || '').trim() || 'QQ'
}

export function selectQqProfileTarget(
  targets: ConnectorTargetSnapshot[],
  mainChatId?: string | null
): ConnectorTargetSnapshot | null {
  const normalizedMainChatId = String(mainChatId || '').trim()
  return (
    targets.find((item) => String(item.bound_quest_id || '').trim()) ||
    (normalizedMainChatId
      ? targets.find((item) => String(item.chat_id || '').trim() === normalizedMainChatId)
      : undefined) ||
    targets[0] ||
    null
  )
}

export function qqProfileStatus(
  profileSnapshot: Pick<ConnectorProfileSnapshot, 'binding_count' | 'last_conversation_id' | 'main_chat_id'> | null | undefined,
  targets: ConnectorTargetSnapshot[],
  mainChatId?: string | null
): 'waiting' | 'ready' | 'bound' {
  const hasBinding =
    Number(profileSnapshot?.binding_count || 0) > 0 ||
    targets.some((item) => Boolean(String(item.bound_quest_id || '').trim()))
  if (hasBinding) {
    return 'bound'
  }
  const hasDetectedTarget =
    Boolean(String(mainChatId || profileSnapshot?.main_chat_id || '').trim()) ||
    Boolean(String(profileSnapshot?.last_conversation_id || '').trim()) ||
    targets.length > 0
  return hasDetectedTarget ? 'ready' : 'waiting'
}

export function lingzhuAuthAkNeedsRotation(value?: string | null): boolean {
  return LINGZHU_EXAMPLE_AUTH_AKS.has(String(value || '').trim())
}

export function resolveLingzhuAuthAk(value?: string | null): string {
  const normalized = String(value || '').trim()
  return lingzhuAuthAkNeedsRotation(normalized) ? '' : normalized
}

export function connectorConfigAutoEnabled(
  connectorName: ConnectorName,
  config: Record<string, unknown> | null | undefined
): boolean {
  const payload = config && typeof config === 'object' ? config : {}
  if (typeof payload.enabled === 'boolean') {
    return payload.enabled
  }

  if (connectorName === 'qq') {
    return qqProfiles(payload).some((profile) => Boolean(textValue(profile.app_id) && hasSecret(profile, 'app_secret')))
  }

  if (connectorName === 'weixin') {
    return Boolean(hasSecret(payload, 'bot_token') && textValue(payload.account_id))
  }

  if (connectorName === 'lingzhu') {
    const authAk = resolveLingzhuAuthAk(textValue(payload.auth_ak) || textValue(payload.auth_ak_env))
    return Boolean(authAk && isPublicHttpUrl(textValue(payload.public_base_url)))
  }

  if (connectorName in GENERIC_CONNECTOR_REQUIRED_FIELDS) {
    const requiredFields = GENERIC_CONNECTOR_REQUIRED_FIELDS[connectorName] || []
    return genericProfiles(payload, connectorName).some((profile) =>
      requiredFields.every((key) => (key.endsWith('_secret') || key.endsWith('_token') ? hasSecret(profile, key) : Boolean(textValue(profile[key]))))
    )
  }

  return Boolean(payload.enabled)
}
