'use client'

import { BUILTIN_PLUGINS } from '@/lib/types/plugin'
import type { Tab } from '@/lib/types/tab'
import type { WorkspaceContentKind, WorkspaceTabViewState } from '@/lib/stores/workspace-surface'

export type WorkspaceMessageTranslator = (
  key: string,
  variables?: Record<string, string | number>,
  fallback?: string
) => string

export type WorkspaceTabBadgeToken =
  | 'pdf'
  | 'md'
  | 'mdx'
  | 'html'
  | 'tex'
  | 'nb'
  | 'lab'
  | 'cli'
  | 'rendered'
  | 'source'
  | 'snapshot'
  | 'diff'
  | 'quote'
  | 'readonly'
  | 'compiling'
  | 'error'
  | 'warning'

export type WorkspaceBadgeTone =
  | 'pdf'
  | 'latex'
  | 'markdown'
  | 'html'
  | 'neutral'
  | 'attention'

export function getWorkspaceResourceExtension(value?: string | null) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  const path = raw.split(/[?#]/, 1)[0]
  const dotIndex = path.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex === path.length - 1) return ''
  return path.slice(dotIndex + 1)
}

export function detectWorkspaceContentKindByExtension(extension: string): WorkspaceContentKind | null {
  if (!extension) return null
  if (extension === 'pdf') return 'pdf'
  if (extension === 'ipynb' || extension === 'dsnb' || extension === 'notebook' || extension === 'ds') {
    return 'notebook'
  }
  if (extension === 'mdx') return 'mdx'
  if (extension === 'md' || extension === 'markdown') return 'markdown'
  if (extension === 'html' || extension === 'htm') return 'html'
  if (extension === 'tex' || extension === 'bib') return 'latex'
  return 'code'
}

export function inferWorkspaceContentKindFromMetadata(input: {
  mimeType?: string | null
  resourceName?: string | null
  resourcePath?: string | null
}): WorkspaceContentKind | null {
  const mime = String(input.mimeType || '').toLowerCase()
  if (mime.includes('pdf')) return 'pdf'
  if (mime.includes('html')) return 'html'
  if (mime.includes('markdown')) return 'markdown'
  if (mime.includes('tex') || mime.includes('bibtex')) return 'latex'
  if (
    mime.includes('ipynb') ||
    mime.includes('blocksuite-notebook') ||
    mime.includes('jupyter') ||
    mime.includes('notebook')
  ) {
    return 'notebook'
  }

  const extension = getWorkspaceResourceExtension(input.resourceName || input.resourcePath || '')
  return detectWorkspaceContentKindByExtension(extension)
}

export function getWorkspaceContentKind(
  tab: Pick<Tab, 'pluginId' | 'context'>,
  viewState?: WorkspaceTabViewState | null
): WorkspaceContentKind {
  if (viewState?.contentKind) return viewState.contentKind

  if (tab.pluginId === BUILTIN_PLUGINS.PDF_VIEWER || tab.pluginId === BUILTIN_PLUGINS.PDF_MARKDOWN) {
    return 'pdf'
  }
  if (tab.pluginId === BUILTIN_PLUGINS.LATEX) return 'latex'
  if (tab.pluginId === BUILTIN_PLUGINS.NOTEBOOK) return 'notebook'
  if (tab.pluginId === BUILTIN_PLUGINS.LAB) return 'lab'
  if (tab.pluginId === BUILTIN_PLUGINS.CLI) return 'cli'

  return (
    inferWorkspaceContentKindFromMetadata({
      mimeType: tab.context.mimeType,
      resourceName: tab.context.resourceName,
      resourcePath: tab.context.resourcePath,
    }) || 'file'
  )
}

export function getWorkspaceBadgeTokens(
  tab: Pick<Tab, 'pluginId' | 'context'>,
  viewState?: WorkspaceTabViewState | null
): WorkspaceTabBadgeToken[] {
  const kind = getWorkspaceContentKind(tab, viewState)
  const tokens: WorkspaceTabBadgeToken[] = []

  if (kind === 'pdf') tokens.push('pdf')
  else if (kind === 'mdx') tokens.push('mdx')
  else if (kind === 'markdown') tokens.push('md')
  else if (kind === 'html') tokens.push('html')
  else if (kind === 'latex') tokens.push('tex')
  else if (kind === 'notebook') tokens.push('nb')
  else if (kind === 'lab') tokens.push('lab')
  else if (kind === 'cli') tokens.push('cli')

  if (viewState?.documentMode === 'rendered') tokens.push('rendered')
  if (viewState?.documentMode === 'source') tokens.push('source')
  if (viewState?.documentMode === 'snapshot') tokens.push('snapshot')
  if (viewState?.documentMode === 'diff') tokens.push('diff')
  if ((viewState?.selectionCount || 0) > 0) tokens.push('quote')
  if (viewState?.isReadOnly) tokens.push('readonly')
  if (viewState?.compileState === 'compiling') tokens.push('compiling')
  if ((viewState?.diagnostics?.errors || 0) > 0) tokens.push('error')
  else if ((viewState?.diagnostics?.warnings || 0) > 0) tokens.push('warning')

  return tokens
}

export function getWorkspaceContentTone(kind?: WorkspaceContentKind): WorkspaceBadgeTone {
  if (kind === 'pdf') return 'pdf'
  if (kind === 'latex') return 'latex'
  if (kind === 'markdown' || kind === 'mdx') return 'markdown'
  if (kind === 'html') return 'html'
  return 'neutral'
}

export function getWorkspaceBadgeTone(token: WorkspaceTabBadgeToken): WorkspaceBadgeTone {
  switch (token) {
    case 'pdf':
      return 'pdf'
    case 'md':
    case 'mdx':
      return 'markdown'
    case 'html':
      return 'html'
    case 'tex':
      return 'latex'
    default:
      return 'neutral'
  }
}

export function getWorkspaceBadgeLabel(
  token: WorkspaceTabBadgeToken,
  t: WorkspaceMessageTranslator
) {
  switch (token) {
    case 'pdf':
      return 'PDF'
    case 'md':
      return 'MD'
    case 'mdx':
      return 'MDX'
    case 'html':
      return 'HTML'
    case 'tex':
      return 'TeX'
    case 'nb':
      return 'NB'
    case 'lab':
      return 'Lab'
    case 'cli':
      return 'CLI'
    case 'rendered':
      return t('tab_badge_rendered')
    case 'source':
      return t('tab_badge_source')
    case 'snapshot':
      return t('tab_badge_snapshot', undefined, 'Snapshot')
    case 'diff':
      return t('tab_badge_diff', undefined, 'Diff')
    case 'quote':
      return t('tab_badge_quote')
    case 'readonly':
      return t('tab_badge_read_only')
    case 'compiling':
      return t('tab_badge_compiling')
    case 'error':
      return t('tab_badge_error')
    case 'warning':
      return t('tab_badge_warning')
    default:
      return token
  }
}

export function getWorkspaceBadgeClassName(token: WorkspaceTabBadgeToken) {
  switch (getWorkspaceBadgeTone(token)) {
    case 'pdf':
      return 'border-[#8FA3B8]/35 bg-[#8FA3B8]/12 text-[#4E6176]'
    case 'markdown':
      return 'border-[#9CB0A7]/35 bg-[#9CB0A7]/12 text-[#4F625B]'
    case 'html':
      return 'border-[#B49B88]/35 bg-[#B49B88]/12 text-[#715B4D]'
    case 'latex':
      return 'border-[#A99EBE]/35 bg-[#A99EBE]/12 text-[#5D5474]'
    case 'attention':
      return 'border-[#C1A2A0]/35 bg-[#C1A2A0]/12 text-[#7A5A58]'
    default:
      if (token === 'nb') {
        return 'border-[#AAB7C7]/35 bg-[#AAB7C7]/12 text-[#556476]'
      }
      if (token === 'lab') {
        return 'border-[#B4A299]/35 bg-[#B4A299]/12 text-[#6E5C54]'
      }
      if (token === 'cli') {
        return 'border-[#95A69A]/35 bg-[#95A69A]/12 text-[#4E5E53]'
      }
      return 'border-black/10 bg-black/[0.04] text-muted-foreground dark:border-white/10 dark:bg-white/[0.05]'
  }
}

export function getWorkspaceContentKindBadge(
  kind: WorkspaceContentKind | undefined,
  t: WorkspaceMessageTranslator
) {
  switch (kind) {
    case 'pdf':
      return { label: t('copilot_badge_pdf'), tone: getWorkspaceContentTone(kind) }
    case 'markdown':
      return { label: t('copilot_badge_markdown'), tone: getWorkspaceContentTone(kind) }
    case 'mdx':
      return { label: t('copilot_badge_mdx'), tone: getWorkspaceContentTone(kind) }
    case 'html':
      return { label: t('copilot_badge_html'), tone: getWorkspaceContentTone(kind) }
    case 'latex':
      return { label: t('copilot_badge_latex'), tone: getWorkspaceContentTone(kind) }
    case 'notebook':
      return { label: t('copilot_badge_notebook'), tone: getWorkspaceContentTone(kind) }
    case 'lab':
      return { label: t('copilot_badge_lab'), tone: getWorkspaceContentTone(kind) }
    case 'cli':
      return { label: t('copilot_badge_cli'), tone: getWorkspaceContentTone(kind) }
    default:
      return null
  }
}

export function isHtmlWorkspaceTab(tab: Pick<Tab, 'pluginId' | 'context'>) {
  return getWorkspaceContentKind(tab) === 'html'
}
