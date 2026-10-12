'use client'

import {
  BookOpen,
  FileText,
  Globe,
  GraduationCap,
  MessageSquare,
  Plug,
  Search,
  Terminal,
} from 'lucide-react'
import type { ToolEventData } from '@/lib/types/chat-events'
import type { ComponentType } from 'react'
import type { ToolViewProps } from '@/components/chat/toolViews/types'
import { BrowserToolView } from '@/components/chat/toolViews/BrowserToolView'
import { FileToolView } from '@/components/chat/toolViews/FileToolView'
import { McpToolView } from '@/components/chat/toolViews/McpToolView'
import {
  LabBaselineToolView,
  LabPiSleepToolView,
  LabQuestToolView,
} from '@/components/chat/toolViews/LabToolViews'
import { PaperSearchToolView } from '@/components/chat/toolViews/PaperSearchToolView'
import { ReadPaperToolView } from '@/components/chat/toolViews/ReadPaperToolView'
import { SearchToolView } from '@/components/chat/toolViews/SearchToolView'
import { ShellToolView } from '@/components/chat/toolViews/ShellToolView'
import { BashToolView } from '@/components/chat/toolViews/BashToolView'
import { getMcpToolKind } from './mcp-tools'

export type ToolCategory =
  | 'shell'
  | 'bash'
  | 'file'
  | 'browser'
  | 'search'
  | 'paper_search'
  | 'read_paper'
  | 'mcp'
  | 'message'

export interface ToolInfo {
  category: ToolCategory
  name: string
  icon: ComponentType<{ className?: string }>
  function: string
  functionArg: string
  view?: ComponentType<ToolViewProps>
}

export const TOOL_FUNCTION_MAP: Record<string, string> = {
  shell_exec: 'Executing command',
  shell_view: 'Viewing command output',
  shell_wait: 'Waiting for command completion',
  shell_write_to_process: 'Writing data to process',
  shell_kill_process: 'Terminating process',
  bash_exec: 'Executing bash command',
  read: 'Reading file',
  write: 'Writing file',
  edit: 'Editing file',
  grep: 'Searching file content',
  glob: 'Finding file',
  file_read: 'Reading file',
  file_read_lines: 'Reading file lines',
  file_list: 'Listing files',
  file_write: 'Writing file',
  file_str_replace: 'Replacing file content',
  file_find_in_content: 'Searching file content',
  file_find_by_name: 'Finding file',
  browser_view: 'Viewing webpage',
  browser_navigate: 'Navigating to webpage',
  browser_restart: 'Restarting browser',
  browser_click: 'Clicking element',
  browser_input: 'Entering text',
  browser_move_mouse: 'Moving mouse',
  browser_press_key: 'Pressing key',
  browser_select_option: 'Selecting option',
  browser_scroll_up: 'Scrolling up',
  browser_scroll_down: 'Scrolling down',
  browser_console_exec: 'Executing JS code',
  browser_console_view: 'Viewing console output',
  info_search_web: 'Searching web',
  web_search: 'Searching web',
  websearch: 'Searching web',
  webfetch: 'Fetching URL',
  web_news: 'Searching news',
  paper_search: 'Searching papers',
  read_paper: 'Reading papers',
  message_notify_user: 'Sending notification',
  message_ask_user: 'Asking question',
  pdf_search: 'Searching PDF',
  pdf_read_lines: 'Reading PDF lines',
  pdf_annotate: 'Annotating PDF',
  pdf_jump: 'Jumping in PDF',
  rebuttal_pdf_search: 'Searching PDF',
  rebuttal_pdf_read_lines: 'Reading PDF lines',
  rebuttal_pdf_annotate: 'Annotating PDF',
  rebuttal_pdf_jump: 'Jumping in PDF',
  review_final_markdown_write: 'Writing final report',
  rebuttal_final_markdown_write: 'Writing final report',
  context_read: 'Reading context',
  ds_system_read_file: 'Reading file',
  ds_system_pull_file: 'Reading file',
  ds_system_list_file: 'Listing files',
  ds_system_list_dir: 'Listing directory',
  ds_system_write_file: 'Writing file',
  ds_system_append_file: 'Writing file',
  ds_system_push_file: 'Writing file',
  ds_system_grep_text: 'Searching file content',
  ds_system_grep_files: 'Finding files',
  ds_system_glob_files: 'Finding file',
  ds_system_request_patch: 'Applying patch',
  ds_system_log_event: 'Logging event',
}

export const TOOL_FUNCTION_ARG_MAP: Record<string, string> = {
  shell_exec: 'command',
  shell_view: 'shell',
  shell_wait: 'shell',
  shell_write_to_process: 'input',
  shell_kill_process: 'shell',
  bash_exec: 'command',
  read: 'file',
  write: 'file',
  edit: 'file',
  grep: 'pattern',
  glob: 'pattern',
  file_read: 'file',
  file_read_lines: 'file',
  file_list: 'path',
  file_write: 'file',
  file_str_replace: 'file',
  file_find_in_content: 'file',
  file_find_by_name: 'path',
  browser_view: 'page',
  browser_navigate: 'url',
  browser_restart: 'url',
  browser_click: 'element',
  browser_input: 'text',
  browser_move_mouse: 'position',
  browser_press_key: 'key',
  browser_select_option: 'option',
  browser_scroll_up: 'page',
  browser_scroll_down: 'page',
  browser_console_exec: 'code',
  browser_console_view: 'console',
  info_search_web: 'query',
  web_search: 'query',
  websearch: 'query',
  webfetch: 'url',
  web_news: 'query',
  paper_search: 'query',
  read_paper: 'items',
  message_notify_user: 'message',
  message_ask_user: 'question',
  pdf_search: 'query',
  pdf_read_lines: 'line',
  pdf_annotate: 'comment',
  pdf_jump: 'page',
  rebuttal_pdf_search: 'query',
  rebuttal_pdf_read_lines: 'line',
  rebuttal_pdf_annotate: 'comment',
  rebuttal_pdf_jump: 'page',
  review_final_markdown_write: 'section_id',
  rebuttal_final_markdown_write: 'section_id',
  context_read: 'surface',
  ds_system_read_file: 'path',
  ds_system_pull_file: 'path',
  ds_system_list_file: 'path',
  ds_system_list_dir: 'path',
  ds_system_write_file: 'path',
  ds_system_append_file: 'path',
  ds_system_push_file: 'path',
  ds_system_grep_text: 'query',
  ds_system_grep_files: 'pattern',
  ds_system_glob_files: 'pattern',
  ds_system_request_patch: 'target_path',
  ds_system_log_event: 'event_type',
}

export const TOOL_NAME_MAP: Record<string, string> = {
  shell: 'Terminal',
  bash: 'Terminal',
  file: 'File',
  browser: 'Browser',
  search: 'Search',
  paper_search: 'Paper Search',
  read_paper: 'Read Paper',
  info: 'Search',
  message: 'Message',
  mcp: 'MCP Tool',
}

export const TOOL_ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  shell: Terminal,
  bash: Terminal,
  file: FileText,
  browser: Globe,
  search: Search,
  paper_search: BookOpen,
  read_paper: GraduationCap,
  info: Search,
  message: MessageSquare,
  mcp: Plug,
}

export const TOOL_VIEW_MAP: Partial<Record<ToolCategory, ComponentType<ToolViewProps>>> = {
  shell: ShellToolView,
  bash: BashToolView,
  file: FileToolView,
  browser: BrowserToolView,
  search: SearchToolView,
  paper_search: PaperSearchToolView,
  read_paper: ReadPaperToolView,
  mcp: McpToolView,
}

const MCP_TOOL_VIEW_MAP: Partial<Record<string, ComponentType<ToolViewProps>>> = {
  lab_quests: LabQuestToolView,
  lab_pi_sleep: LabPiSleepToolView,
  lab_baseline: LabBaselineToolView,
}

function normalizeValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function normalizeActorLabel(raw: unknown): string {
  const label = typeof raw === 'string' ? raw.trim() : ''
  if (!label) return ''
  return label.startsWith('@') ? label : `@${label}`
}

function normalizeToolFunctionName(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (!value) return ''
  if (!value.startsWith('mcp__')) return value
  const parts = value.split('__').filter(Boolean)
  return parts[parts.length - 1] || value
}

function extractMcpServerName(tool: ToolEventData): string {
  const metadata = tool.metadata ?? {}
  const fromMetadata =
    (typeof metadata.mcp_server === 'string' && metadata.mcp_server) ||
    (typeof metadata.server === 'string' && metadata.server) ||
    ''
  if (fromMetadata.trim()) return fromMetadata.trim().toLowerCase()

  const raw = (tool.function || tool.name || '').toLowerCase()
  const parts = raw.split('__').filter(Boolean)
  if (parts[0] === 'mcp' && parts[1]) return parts[1]
  return ''
}

function formatPaperProviderName(server: string): string {
  if (!server) return ''
  if (server.includes('deepxiv')) return 'DeepXiv'
  if (server === 'pasa' || server.includes('pasa')) return 'PASA'
  return server
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

function resolvePaperToolName(category: ToolCategory, tool: ToolEventData): string {
  if (category !== 'paper_search' && category !== 'read_paper') {
    return TOOL_NAME_MAP[category] ?? tool.name
  }
  const provider = formatPaperProviderName(extractMcpServerName(tool))
  const base = category === 'paper_search' ? 'Paper Search' : 'Read Paper'
  return provider ? `${provider} ${base}` : base
}

export function resolveToolActorLabel(tool: ToolEventData): string {
  const metadata = tool.metadata ?? {}
  const raw =
    (typeof metadata.agent_label === 'string' && metadata.agent_label) ||
    (typeof metadata.agent_id === 'string' && metadata.agent_id) ||
    (typeof metadata.agent_role === 'string' && metadata.agent_role) ||
    ''
  const normalized = normalizeActorLabel(raw)
  return normalized || '@assistant'
}

function extractArgValue(
  record: Record<string, unknown>,
  keys: string[]
): string {
  for (const key of keys) {
    const value = record[key]
    if (value == null) continue
    const normalized = normalizeValue(value)
    if (normalized) return normalized
  }
  return ''
}

export function resolveToolCategory(tool: ToolEventData): ToolCategory {
  const toolName = (tool.name || '').toLowerCase()
  const functionName = (tool.function || '').toLowerCase()
  const functionLeaf = normalizeToolFunctionName(tool.function)

  if (functionName === 'bash_exec' || toolName.includes('bash')) return 'bash'
  if (toolName.includes('message')) return 'message'
  // paper_search must be checked before generic search
  if (functionLeaf === 'paper_search' || toolName.includes('paper_search')) {
    return 'paper_search'
  }
  if (functionLeaf === 'read_paper' || toolName.includes('read_paper')) {
    return 'read_paper'
  }
  if (toolName.includes('mcp') || functionName.startsWith('mcp_')) return 'mcp'
  if (
    functionName === 'grep' ||
    functionName === 'glob' ||
    toolName.includes('grep') ||
    toolName.includes('glob')
  ) {
    return 'search'
  }
  if (
    toolName.includes('search') ||
    functionName.startsWith('info_') ||
    functionName.startsWith('web_') ||
    functionName === 'websearch' ||
    functionName === 'webfetch'
  ) {
    return 'search'
  }
  if (
    functionName.startsWith('ds_system_') ||
    functionName.startsWith('mcp_') ||
    functionName.startsWith('lab_') ||
    functionName.startsWith('mcp__') ||
    functionName.includes('__mcp_') ||
    functionName.includes('__lab_')
  ) {
    return 'mcp'
  }
  if (toolName.includes('browser') || functionName.startsWith('browser_')) return 'browser'
  if (
    functionName === 'read' ||
    functionName === 'write' ||
    functionName === 'edit' ||
    toolName === 'read' ||
    toolName === 'write' ||
    toolName === 'edit'
  ) {
    return 'file'
  }
  if (toolName.includes('file') || functionName.startsWith('file_')) return 'file'
  if (toolName.includes('shell') || functionName.startsWith('shell_')) return 'shell'

  return 'message'
}

export function getToolInfo(tool: ToolEventData): ToolInfo {
  const category = resolveToolCategory(tool)
  const rawFunctionKey = (tool.function || '').toLowerCase()
  const functionKey = normalizeToolFunctionName(tool.function)
  const functionLabel =
    TOOL_FUNCTION_MAP[tool.function] ??
    TOOL_FUNCTION_MAP[rawFunctionKey] ??
    TOOL_FUNCTION_MAP[functionKey] ??
    tool.function
  const args =
    tool.args && typeof tool.args === 'object' && !Array.isArray(tool.args)
      ? (tool.args as Record<string, unknown>)
      : {}
  const content =
    tool.content && typeof tool.content === 'object' && !Array.isArray(tool.content)
      ? (tool.content as Record<string, unknown>)
      : {}
  const functionName = rawFunctionKey
  let functionArg = ''
  if (functionName.startsWith('file_') || functionName.startsWith('ds_system_')) {
    functionArg = extractArgValue(args, ['file', 'file_path', 'path', 'filePath'])
    if (!functionArg) {
      functionArg = extractArgValue(content, ['file', 'file_path', 'filePath'])
    }
  }
  if (!functionArg) {
    const argKey =
      TOOL_FUNCTION_ARG_MAP[tool.function] ??
      TOOL_FUNCTION_ARG_MAP[rawFunctionKey] ??
      TOOL_FUNCTION_ARG_MAP[functionKey]
    functionArg = argKey ? normalizeValue(args[argKey]) : ''
  }
  const name = resolvePaperToolName(category, tool)
  const icon = TOOL_ICON_MAP[category] ?? MessageSquare
  let view = TOOL_VIEW_MAP[category]
  if (category === 'mcp') {
    const mcpKind = getMcpToolKind(tool.function || '')
    if (mcpKind && MCP_TOOL_VIEW_MAP[mcpKind]) {
      view = MCP_TOOL_VIEW_MAP[mcpKind]
    }
  }

  return {
    category,
    name,
    icon,
    function: functionLabel,
    functionArg,
    view,
  }
}
