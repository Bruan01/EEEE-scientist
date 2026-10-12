export type PremiumTargetScope = 'projects_list' | 'project_workspace'

export type PremiumMessageUserState = {
  dont_remind: boolean
  dismissed_at?: string | null
  read_at?: string | null
}

export type PremiumMessage = {
  id: string
  message: string
  title?: string | null
  image_url?: string | null
  level: 'info' | 'warning' | 'error'
  created_at: string
  expires_at?: string | null
  target_scope: PremiumTargetScope
  target_project_id?: string | null
  content_markdown?: string | null
  content_file_id?: string | null
  starts_at?: string | null
  state: PremiumMessageUserState
}

export type PremiumMessageListResponse = {
  items: PremiumMessage[]
}

