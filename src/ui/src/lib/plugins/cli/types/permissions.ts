export type CliPermissionLevel = 'none' | 'view' | 'edit' | 'admin' | 'owner'

export type CliCapability =
  | 'view_server_status'
  | 'view_terminal_output'
  | 'view_operation_logs'
  | 'view_files'
  | 'view_tasks'
  | 'view_findings'
  | 'terminal_input'
  | 'file_upload'
  | 'file_download'
  | 'file_edit'
  | 'file_delete'
  | 'manage_sessions'
  | 'manage_permissions'
  | 'disconnect_server'
  | 'view_all_user_logs'
  | 'delete_server'

export type CliEditGranularity = {
  allowTerminalInput?: boolean
  allowFileEdit?: boolean
}

const PERMISSION_ORDER: CliPermissionLevel[] = ['none', 'view', 'edit', 'admin', 'owner']

export function maxPermission(a: CliPermissionLevel, b: CliPermissionLevel): CliPermissionLevel {
  return PERMISSION_ORDER[Math.max(PERMISSION_ORDER.indexOf(a), PERMISSION_ORDER.indexOf(b))]
}

export function mapProjectRoleToPermission(role?: string | null): CliPermissionLevel {
  if (!role) return 'none'
  if (role === 'owner') return 'owner'
  if (role === 'admin') return 'admin'
  if (role === 'editor') return 'edit'
  if (role === 'viewer') return 'view'
  return 'none'
}

export function resolveCliCapabilities(
  level: CliPermissionLevel,
  granularity?: CliEditGranularity | null
): Record<CliCapability, boolean> {
  const allowTerminalInput = granularity?.allowTerminalInput ?? true
  const allowFileEdit = granularity?.allowFileEdit ?? true
  const isEdit = level === 'edit'
  const isAdmin = level === 'admin' || level === 'owner'

  const baseView = {
    view_server_status: level !== 'none',
    view_terminal_output: level !== 'none',
    view_operation_logs: level !== 'none',
    view_files: level !== 'none',
    view_tasks: level !== 'none',
    view_findings: level !== 'none',
  }

  const editCaps = {
    terminal_input: level !== 'none' && level !== 'view' && allowTerminalInput,
    file_upload: level !== 'none' && level !== 'view' && allowFileEdit,
    file_download: isAdmin || (isEdit && allowFileEdit),
    file_edit: level !== 'none' && level !== 'view' && allowFileEdit,
    file_delete: level !== 'none' && level !== 'view' && allowFileEdit,
  }

  const adminCaps = {
    manage_sessions: level === 'admin' || level === 'owner',
    manage_permissions: level === 'admin' || level === 'owner',
    disconnect_server: level === 'admin' || level === 'owner',
    view_all_user_logs: level === 'admin' || level === 'owner',
    delete_server: level === 'owner',
  }

  return {
    ...baseView,
    ...editCaps,
    ...adminCaps,
  }
}

export function hasCliCapability(
  capabilities: Record<CliCapability, boolean>,
  capability: CliCapability
): boolean {
  return Boolean(capabilities[capability])
}
