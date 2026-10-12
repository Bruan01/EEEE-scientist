export type QuestSummary = {
  quest_id: string
  title: string
  status: string
  active_anchor: string
  branch?: string
  head?: string
  updated_at?: string
  quest_root?: string
  artifact_count?: number
  history_count?: number
  summary?: {
    status_line?: string
    latest_metric?: {
      key?: string
      value?: string | number
      delta_vs_baseline?: string | number
    }
  }
  pending_decisions?: string[]
  waiting_interaction_id?: string | null
  latest_thread_interaction_id?: string | null
  default_reply_interaction_id?: string | null
  runtime_status?: string
  display_status?: string
  pending_user_message_count?: number
  stop_reason?: string | null
  active_interaction_id?: string | null
  last_artifact_interact_at?: string | null
  last_delivered_batch_id?: string | null
  last_delivered_at?: string | null
  bound_conversations?: string[]
}

export type ConnectorBindingSnapshot = {
  conversation_id: string
  quest_id?: string | null
  quest_title?: string | null
  updated_at?: string | null
  profile_id?: string | null
  profile_label?: string | null
}

export type ConnectorRecentConversation = {
  conversation_id: string
  connector?: string
  chat_type: string
  chat_id: string
  chat_id_raw?: string | null
  profile_id?: string | null
  profile_label?: string | null
  label?: string | null
  source?: string | null
  sender_id?: string | null
  sender_name?: string | null
  quest_id?: string | null
  message_id?: string | null
  updated_at?: string | null
}

export type ConnectorRecentEvent = {
  event_type: 'inbound' | 'outbound' | 'ignored'
  created_at?: string | null
  conversation_id?: string | null
  chat_type?: string | null
  chat_id?: string | null
  profile_id?: string | null
  profile_label?: string | null
  label?: string | null
  kind?: string | null
  message?: string | null
  reason?: string | null
  ok?: boolean | null
  queued?: boolean | null
  transport?: string | null
}

export type ConnectorTargetSnapshot = {
  conversation_id: string
  connector?: string
  chat_type: string
  chat_id: string
  chat_id_raw?: string | null
  profile_id?: string | null
  profile_label?: string | null
  label?: string | null
  source?: string | null
  sources?: string[]
  quest_id?: string | null
  updated_at?: string | null
  is_default?: boolean
  selectable?: boolean
  is_bound?: boolean
  bound_quest_id?: string | null
  bound_quest_title?: string | null
  warning?: string | null
  first_seen_at?: string | null
}

export type ConnectorProfileSnapshot = {
  profile_id: string
  label?: string | null
  bot_name?: string | null
  app_id?: string | null
  transport?: string | null
  main_chat_id?: string | null
  default_conversation_id?: string | null
  last_conversation_id?: string | null
  connection_state?: string | null
  auth_state?: string | null
  last_error?: string | null
  inbox_count?: number
  outbox_count?: number
  ignored_count?: number
  discovered_targets?: ConnectorTargetSnapshot[]
  recent_conversations?: ConnectorRecentConversation[]
  bindings?: ConnectorBindingSnapshot[]
  target_count?: number
  binding_count?: number
}

export type ConnectorSnapshot = {
  name: string
  display_mode?: string
  mode?: string
  transport?: string
  relay_url?: string | null
  main_chat_id?: string | null
  last_conversation_id?: string | null
  enabled?: boolean
  connection_state?: string
  auth_state?: string
  last_error?: string | null
  inbox_count?: number
  outbox_count?: number
  ignored_count?: number
  binding_count?: number
  target_count?: number
  bindings?: ConnectorBindingSnapshot[]
  known_targets?: ConnectorTargetSnapshot[]
  recent_conversations?: ConnectorRecentConversation[]
  recent_events?: ConnectorRecentEvent[]
  default_target?: ConnectorTargetSnapshot | null
  discovered_targets?: ConnectorTargetSnapshot[]
  profiles?: ConnectorProfileSnapshot[]
  details?: Record<string, unknown>
}

export type ConnectorAvailabilitySnapshot = {
  has_enabled_external_connector: boolean
  has_bound_external_connector: boolean
  should_recommend_binding: boolean
  preferred_connector_name?: string | null
  preferred_conversation_id?: string | null
  available_connectors: Array<{
    name: string
    enabled: boolean
    connection_state?: string | null
    binding_count?: number
    target_count?: number
    has_delivery_target?: boolean
  }>
}

export type ConfigFileEntry = {
  name: string
  path: string
  required: boolean
  exists: boolean
}

export type ConfigValidationPayload = {
  ok: boolean
  parsed?: Record<string, unknown>
  warnings?: string[]
  errors?: string[]
  summary?: string
}

export type ConfigTestPayload = {
  ok: boolean
  summary?: string
  warnings?: string[]
  errors?: string[]
  items?: Array<{
    name?: string
    ok?: boolean
    summary?: string
    warnings?: string[]
    errors?: string[]
    details?: Record<string, unknown>
  }>
  details?: Record<string, unknown>
  preview?: string
}

export type AdminTask = {
  task_id: string
  kind: string
  status: string
  progress_current?: number | null
  progress_total?: number | null
  progress_percent?: number | null
  current_step?: string | null
  message?: string | null
  created_at?: string | null
  started_at?: string | null
  finished_at?: string | null
  result_path?: string | null
  error?: string | null
  metadata?: Record<string, unknown> | null
  last_event_seq?: number | null
}

export type AdminTaskEvent = {
  seq?: number
  event: string
  message?: string | null
  created_at?: string | null
  data?: Record<string, unknown> | null
}

export type BenchStoreEntry = {
  id: string
  name?: string
  one_line?: string
  task_description?: string
  snapshot_status?: string | null
  support_level?: string | null
  cost_band?: string | null
  time_band?: string | null
  difficulty?: string | null
  data_access?: string | null
  risk_flags?: string[]
  risk_notes?: string[]
  install_state?: Record<string, unknown> | null
  compatibility?: Record<string, unknown> | null
  recommendation?: Record<string, unknown> | null
  setup_prompt_preview?: string | null
  [key: string]: unknown
}

export type BenchStoreCatalogPayload = {
  ok: boolean
  items: BenchStoreEntry[]
  total?: number
  device_summary?: string | null
  invalid_entries?: Array<{ source_file?: string; message?: string }>
  shelves?: Record<string, string[]>
}

export type BenchStoreEntryDetailPayload = {
  ok: boolean
  entry: BenchStoreEntry
  device_summary?: string | null
}

export type BenchStoreSetupPacket = {
  entry_id: string
  assistant_label?: string | null
  project_title?: string | null
  benchmark_local_path?: string | null
  local_dataset_paths?: string[]
  device_summary?: string | null
  device_fit?: string | null
  requires_paper?: boolean | null
  benchmark_goal?: string | null
  constraints?: string[]
  suggested_form?: Record<string, unknown> | null
  startup_instruction?: string | null
  launch_payload?: {
    title?: string | null
    goal?: string | null
    initial_message?: string | null
    startup_contract?: Record<string, unknown> | null
  } | null
}

export type BenchStoreSetupPacketPayload = {
  ok: boolean
  entry_id: string
  setup_packet: BenchStoreSetupPacket
}

export type BaselineRegistryEntry = {
  baseline_id: string
  summary?: string | null
  variant_id?: string | null
  variants?: Array<Record<string, unknown>>
  created_at?: string | null
  updated_at?: string | null
  path?: string | null
  [key: string]: unknown
}

export type OpenDocumentPayload = {
  document_id: string
  title: string
  path: string
  writable: boolean
  content: string
  revision?: string
  updated_at?: string
  meta?: {
    help_markdown?: string
    system_testable?: boolean
    structured_config?: Record<string, unknown>
    [key: string]: unknown
  }
}

export type WeixinQrLoginStartPayload = {
  ok: boolean
  session_key?: string | null
  qrcode_content?: string | null
  qrcode_url?: string | null
  message?: string | null
}

export type WeixinQrLoginWaitPayload = {
  ok: boolean
  connected: boolean
  status?: string | null
  session_key?: string | null
  qrcode_content?: string | null
  qrcode_url?: string | null
  account_id?: string | null
  login_user_id?: string | null
  base_url?: string | null
  snapshot?: ConnectorSnapshot | null
  message?: string | null
}

export type SessionPayload = {
  ok: boolean
  quest_id: string
  snapshot: QuestSummary & Record<string, unknown>
  acp_session: {
    session_id: string
    slash_commands?: Array<{ name: string; description: string }>
    meta?: {
      quest_root?: string
      current_workspace_root?: string
      current_workspace_branch?: string
      research_head_branch?: string
      latest_metric?: { key?: string; value?: string | number }
      pending_decisions?: string[]
      runtime_status?: string
      stop_reason?: string | null
      pending_user_message_count?: number
      default_reply_interaction_id?: string | null
      waiting_interaction_id?: string | null
      latest_thread_interaction_id?: string | null
      last_artifact_interact_at?: string | null
      last_delivered_batch_id?: string | null
    }
  }
}

export type FeedEnvelope = {
  cursor: number
  has_more?: boolean
  oldest_cursor?: number | null
  newest_cursor?: number | null
  direction?: 'after' | 'before' | 'tail' | string
  acp_updates: Array<{
    method: string
    params: {
      sessionId: string
      update: Record<string, unknown>
    }
  }>
}

export type TuiDebugRouteSnapshot = {
  kind: string
  target: string
  reason: string
  command?: string | null
  arg?: string | null
  parsed_command?: string | null
}

export type TuiDebugSnapshot = {
  surface: string
  web_analog: string
  route: TuiDebugRouteSnapshot
  input: {
    raw: string
    parsed: string
    preview: string
    redacted?: boolean
    redaction_reason?: string | null
    length?: number
  }
  screen: {
    main: string
    composer: string
    selected?: string | null
    input_visible: boolean
    input_redacted: boolean
    debug_strip_visible: boolean
  }
  status_line: string
  connection_state: string
  active_quest_id?: string | null
  browse_quest_id?: string | null
  config_view?: string | null
  config_mode?: string | null
  quest_panel_mode?: string | null
  utility_panel_kind?: string | null
  session_id?: string | null
  counts: {
    quests: number
    history: number
    pending: number
    config_items: number
    selected_index: number
    suggestions: number
    utility_lines: number
  }
  log_path?: string | null
  signature: string
}

export type BashSessionStatus = 'running' | 'terminating' | 'completed' | 'failed' | 'terminated'

export type BashProgress = {
  label?: string
  phase?: string
  status?: string
  detail?: string
  current?: number
  total?: number
  percent?: number
  eta?: number
  next_reply_in?: number
  next_check_in?: number
  next_reply_at?: string
  next_check_at?: string
  ts?: string
  [key: string]: unknown
}

export type BashSession = {
  bash_id: string
  project_id?: string
  quest_id?: string
  chat_session_id?: string | null
  session_id?: string | null
  agent_id?: string | null
  agent_instance_id?: string | null
  command: string
  workdir?: string
  log_path?: string
  status: BashSessionStatus
  exit_code?: number | null
  stop_reason?: string | null
  last_progress?: BashProgress | null
  started_at: string
  finished_at?: string | null
  updated_at?: string
}

export type BashLogEntry = {
  seq: number
  stream: string
  line: string
  timestamp: string
}

export type FeedItem =
  | {
      id: string
      type: 'message'
      role: 'user' | 'assistant'
      content: string
      source?: string
      createdAt?: string
      stream?: boolean
      runId?: string | null
      skillId?: string | null
    }
  | {
      id: string
      type: 'artifact'
      artifactId?: string
      kind: string
      content: string
      status?: string
      reason?: string
      guidance?: string
      createdAt?: string
      paths?: Record<string, string>
      artifactPath?: string
      workspaceRoot?: string
      branch?: string
      headCommit?: string
      flowType?: string
      protocolStep?: string
      ideaId?: string | null
      campaignId?: string | null
      sliceId?: string | null
      details?: Record<string, unknown>
      checkpoint?: Record<string, unknown> | null
      attachments?: Array<Record<string, unknown>>
    }
  | {
      id: string
      type: 'operation'
      label: 'tool_call' | 'tool_result'
      content: string
      toolName?: string
      toolCallId?: string
      status?: string
      subject?: string | null
      args?: string
      output?: string
      mcpServer?: string
      mcpTool?: string
      metadata?: Record<string, unknown>
      createdAt?: string
    }
  | {
      id: string
      type: 'event'
      label: string
      content: string
      createdAt?: string
    }
