const ZH_UI_PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Prompt 预览/g, '启动提示预览'],
  [/Prompt 预览不能为空。/g, '启动提示预览不能为空。'],
  [/Connector 设置/g, '连接器设置'],
  [/QQ Connector/g, 'QQ 连接器'],
  [/QQ bot/g, 'QQ 机器人'],
  [/QQ Bot/g, 'QQ 机器人'],
  [/Bot 名称/g, '机器人名称'],
  [/本地 daemon/g, '本地后台服务'],
  [/Codex \/ 本地 daemon/g, 'Codex / 本地后台服务'],
  [/Profile ID/g, '配置 ID'],
]

const ZH_UI_TERM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bStart Research\b/g, '开始研究'],
  [/\bQuick Start\b/g, '快速开始'],
  [/\bConnector\b/g, '连接器'],
  [/\bconnector\b/g, '连接器'],
  [/\bconnectors\b/g, '连接器'],
  [/\bPrompt\b/g, '启动提示'],
  [/\bprompt\b/g, '启动提示'],
  [/\bReview\b/g, '审阅'],
  [/\breview\b/g, '审阅'],
  [/\bRebuttal\b/g, '回复审稿'],
  [/\brebuttal\b/g, '回复审稿'],
  [/\bRevision\b/g, '修订'],
  [/\brevision\b/g, '修订'],
  [/\bBaseline\b/g, '基线'],
  [/\bbaseline\b/g, '基线'],
  [/\bQuest\b/g, '项目'],
  [/\bquest\b/g, '项目'],
  [/\bBot\b/g, '机器人'],
  [/\bbot\b/g, '机器人'],
  [/\bDaemon\b/g, '后台服务'],
  [/\bdaemon\b/g, '后台服务'],
  [/\bStandard\b/g, '标准'],
  [/\bCustom\b/g, '自定义'],
  [/\bfreeform\b/g, '自由模式'],
  [/\bFreeform\b/g, '自由模式'],
  [/\bDemo\b/g, '演示'],
  [/\bEnglish\b/g, '英文'],
  [/\bChinese\b/g, '中文'],
  [/\bProfile ID\b/g, '配置 ID'],
  [/\bProfile\b/g, '配置档案'],
]

function normalizeZhUiText(text: string): string {
  let normalized = text
  for (const [pattern, replacement] of ZH_UI_PHRASE_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement)
  }
  for (const [pattern, replacement] of ZH_UI_TERM_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement)
  }
  normalized = normalized
    .replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/g, '$1$2')
    .replace(/([\u4e00-\u9fff])\s+([，。！？；：])/g, '$1$2')
    .replace(/([（【“‘])\s+/g, '$1')
    .replace(/\s+([）】”’])/g, '$1')
  return normalized
}

export function normalizeZhUiCopy<T>(value: T): T {
  if (typeof value === 'string') {
    return normalizeZhUiText(value) as T
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeZhUiCopy(item)) as T
  }
  if (!value || typeof value !== 'object') {
    return value
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeZhUiCopy(item)])
  ) as T
}
