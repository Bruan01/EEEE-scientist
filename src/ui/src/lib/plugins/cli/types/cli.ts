export type CliServerStatus = 'online' | 'offline' | 'standalone' | 'error' | 'idle' | 'busy'

export type CliPermissionLevel = 'none' | 'view' | 'edit' | 'admin' | 'owner'

export interface CliServer {
  id: string
  project_id: string
  name?: string | null
  hostname: string
  ip_address?: string | null
  os_info?: string | null
  device_fingerprint?: string | null
  server_root?: string | null
  allowed_roots?: string[] | Record<string, string>
  gpu_count: number
  gpu_info?: Array<{
    index: number
    name: string
    memory_total_mb?: number
    memory_free_mb?: number
    memory_total?: string
    memory_free?: string
    uuid: string
  }>
  memory_gb: number
  disk_gb: number
  status: CliServerStatus
  last_seen_at?: string | null
  registered_at: string
}

export interface CliTelemetryGpu {
  index: number
  name?: string | null
  uuid?: string | null
  utilization_gpu?: number | null
  utilization_memory?: number | null
  memory_total_mb?: number | null
  memory_used_mb?: number | null
  memory_free_mb?: number | null
}

export interface CliTelemetryPoint {
  timestamp: string
  cpu_percent?: number | null
  mem_used_mb?: number | null
  mem_total_mb?: number | null
  mem_percent?: number | null
  disk_used_gb?: number | null
  disk_total_gb?: number | null
  disk_percent?: number | null
  rtt_ms?: number | null
  gpu?: CliTelemetryGpu[] | null
}

export interface CliTelemetryResponse {
  points: CliTelemetryPoint[]
}

export interface CliFileItem {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number | null
  modified_at?: string | null
  is_readable: boolean
  mime_type?: string | null
  is_symlink?: boolean | null
  hardlink_count?: number | null
}

export interface CliFileListResponse {
  path: string
  items: CliFileItem[]
}

export interface CliFileContentResponse {
  path: string
  content: string
  encoding: string
  size: number
  modified_at?: string | null
}

export interface CliMethodConfig {
  method_id: string
  method_slug?: string | null
  method_name?: string | null
  created_at?: string | null
  created_by_session?: string | null
  paper?: {
    source?: string | null
    md_path?: string | null
    pdf_path?: string | null
  }
  code?: {
    source?: string | null
    baseline_path?: string | null
  }
  topic?: string | null
  status?: string | null
  paths?: Record<string, string | null> | null
}

export interface CliMethodListResponse {
  methods: CliMethodConfig[]
}

export interface CliMethodGetResponse {
  method?: CliMethodConfig | null
}

export interface CliMethodCreateResponse {
  request_id: string
  status: string
}

export interface CliLogObject {
  id: string
  server_id: string
  project_id: string
  object_key: string
  format: string
  time_start: string
  time_end: string
  entry_count: number
  sha256: string
}

export interface CliLogManifestResponse {
  items: CliLogObject[]
  total: number
  limit: number
  offset: number
}

export interface CliSessionSnapshot {
  id: string
  server_id: string
  session_type: string
  name?: string | null
  state?: 'active' | 'detached' | 'closed' | string
  connected_at: string
  last_active_at?: string | null
  cols?: number | null
  rows?: number | null
  scrollback?: string[] | null
  cwd?: string | null
  cwd_rel?: string | null
  shell?: string | null
  conda_env?: string | null
}

export type CliTerminalSessionState = 'active' | 'detached' | 'closed'

export interface CliTerminalSession {
  id: string
  serverId: string
  name: string
  createdAt: number
  state: CliTerminalSessionState
  scrollback: string[]
  lastActiveAt: number
  cols: number
  rows: number
  mode?: 'terminal' | 'ui'
  lineBuffer?: string
  cwd?: string
  cwdRel?: string
  shell?: string
  condaEnv?: string
  env?: Record<string, string>
  serialized?: string
}

export interface CliSessionTranscriptEntry {
  ts: string
  direction: 'input' | 'output' | string
  data: string
  seq?: number | null
  ack?: number | null
  operation_id?: string | null
}

export interface CliSessionTranscriptResponse {
  entries: CliSessionTranscriptEntry[]
  cursor?: string | null
  has_more?: boolean
}
