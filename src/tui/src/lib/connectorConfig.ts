export type ManagedConnectorName =
  | 'qq'
  | 'weixin'
  | 'lingzhu'
  | 'telegram'
  | 'discord'
  | 'slack'
  | 'feishu'
  | 'whatsapp'

export const CONNECTOR_ORDER: ManagedConnectorName[] = [
  'qq',
  'weixin',
  'lingzhu',
  'telegram',
  'discord',
  'slack',
  'feishu',
  'whatsapp',
]

const CONNECTOR_LABELS: Record<ManagedConnectorName, string> = {
  qq: 'QQ',
  weixin: 'Weixin',
  lingzhu: 'Lingzhu',
  telegram: 'Telegram',
  discord: 'Discord',
  slack: 'Slack',
  feishu: 'Feishu',
  whatsapp: 'WhatsApp',
}

const CONNECTOR_SUBTITLES: Record<ManagedConnectorName, string> = {
  qq: 'Save App ID and App Secret, then wait for the first private QQ message to discover the target.',
  weixin: 'Start QR login, scan with WeChat, and let DeepScientist save the connector automatically.',
  lingzhu: 'Generate the Rokid binding values here, then copy them into the Lingzhu platform and save once.',
  telegram: 'Guided setup not added in TUI yet. Use raw connectors config if needed.',
  discord: 'Guided setup not added in TUI yet. Use raw connectors config if needed.',
  slack: 'Guided setup not added in TUI yet. Use raw connectors config if needed.',
  feishu: 'Guided setup not added in TUI yet. Use raw connectors config if needed.',
  whatsapp: 'Guided setup not added in TUI yet. Use raw connectors config if needed.',
}

const GUIDED_CONNECTORS = new Set<ManagedConnectorName>(['qq', 'weixin', 'lingzhu'])
const LINGZHU_EXAMPLE_AUTH_AKS = new Set(['abcd1234-abcd-abcd-abcd-abcdefghijkl'])

export function connectorLabel(name: string): string {
  const normalized = String(name || '').trim().toLowerCase() as ManagedConnectorName
  return CONNECTOR_LABELS[normalized] || (normalized ? normalized[0].toUpperCase() + normalized.slice(1) : 'Connector')
}

export function connectorSubtitle(name: string): string {
  const normalized = String(name || '').trim().toLowerCase() as ManagedConnectorName
  return CONNECTOR_SUBTITLES[normalized] || 'Connector settings.'
}

export function supportsGuidedConnector(name: string): boolean {
  const normalized = String(name || '').trim().toLowerCase() as ManagedConnectorName
  return GUIDED_CONNECTORS.has(normalized)
}

export function maskSecret(value: string): string {
  const text = String(value || '').trim()
  if (!text) {
    return ''
  }
  if (text.startsWith('$')) {
    return text
  }
  if (text.length <= 8) {
    return '*'.repeat(text.length)
  }
  return `${text.slice(0, 4)}${'*'.repeat(Math.max(0, text.length - 8))}${text.slice(-4)}`
}

export function createLingzhuAk(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const segments = [8, 4, 4, 4, 12]
  const totalLength = segments.reduce((sum, size) => sum + size, 0)
  const bytes =
    typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
      ? crypto.getRandomValues(new Uint8Array(totalLength))
      : Uint8Array.from({ length: totalLength }, () => Math.floor(Math.random() * 256))
  let index = 0
  return segments
    .map((size) => {
      let segment = ''
      for (let offset = 0; offset < size; offset += 1) {
        segment += chars[bytes[index] % chars.length]
        index += 1
      }
      return segment
    })
    .join('-')
}

export function resolveLingzhuAuthAk(value: unknown): string {
  const normalized = String(value || '').trim()
  return LINGZHU_EXAMPLE_AUTH_AKS.has(normalized) ? '' : normalized
}

export function looksLikeWeixinQrImageUrl(value: string): boolean {
  const text = String(value || '').trim()
  if (!text) {
    return false
  }
  if (text.startsWith('data:image/') || text.startsWith('blob:')) {
    return true
  }
  return /^https?:\/\/.+\.(png|jpg|jpeg|gif|webp|svg)(?:$|[?#])/i.test(text)
}
