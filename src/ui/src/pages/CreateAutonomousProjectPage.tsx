import * as React from 'react'
import { useNavigate } from 'react-router-dom'

import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog'
import { client } from '@/lib/api'
import type { QuestMessageAttachmentDraft } from '@/lib/hooks/useQuestMessageAttachments'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error || new Error('Failed to read file.'))
    reader.onload = () => {
      const result = String(reader.result || '')
      const base64 = result.includes(',') ? result.split(',', 2)[1] : result
      resolve(base64)
    }
    reader.readAsDataURL(file)
  })
}

export function CreateAutonomousProjectPage() {
  const navigate = useNavigate()
  const [creating, setCreating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleCreate = React.useCallback(
    async (payload: {
      title: string
      goal: string
      quest_id?: string
      requested_connector_bindings?: Array<{ connector: string; conversation_id?: string | null }>
      requested_baseline_ref?: { baseline_id: string; variant_id?: string | null } | null
      startup_contract?: Record<string, unknown> | null
      launch_materials?: {
        setup_quest_id?: string | null
        setup_attachments?: Array<Record<string, unknown>>
        local_attachments?: QuestMessageAttachmentDraft[]
      } | null
    }) => {
      if (!payload.goal.trim()) return
      setCreating(true)
      setError(null)
      try {
        const result = await client.createQuestWithOptions({
          goal: payload.goal.trim(),
          title: payload.title.trim() || undefined,
          quest_id: payload.quest_id?.trim() || undefined,
          source: 'web-react',
          auto_start: false,
          auto_bind_latest_connectors: false,
          requested_connector_bindings: payload.requested_connector_bindings,
          requested_baseline_ref: payload.requested_baseline_ref ?? undefined,
          startup_contract: payload.startup_contract ?? undefined,
        })
        const importedPayload =
          payload.launch_materials?.setup_quest_id && (payload.launch_materials?.setup_attachments || []).length > 0
            ? await client.importQuestChatAttachments(result.snapshot.quest_id, {
                source_quest_id: payload.launch_materials.setup_quest_id,
                attachments: (payload.launch_materials.setup_attachments || []).map((item) => ({
                  name: item.label || item.name || item.file_name,
                  file_name: item.label || item.file_name || item.name,
                  content_type: item.contentType || item.content_type || item.mime_type || null,
                  quest_relative_path: item.questRelativePath || item.quest_relative_path || null,
                  path: item.path || null,
                })),
              })
            : null
        if (importedPayload && !importedPayload.ok) {
          throw new Error(importedPayload.message || 'Failed to import setup attachments.')
        }
        const requestedSetupAttachmentCount = payload.launch_materials?.setup_attachments?.length || 0
        const importedSetupAttachmentCount = importedPayload?.attachments?.length || 0
        if (requestedSetupAttachmentCount > 0 && importedSetupAttachmentCount < requestedSetupAttachmentCount) {
          throw new Error(
            `Only imported ${importedSetupAttachmentCount} of ${requestedSetupAttachmentCount} SetupAgent attachment(s). Please reopen the setup conversation or remove the missing attachment before launch.`
          )
        }
        const importedDraftIdsNormalized = (importedPayload?.attachments || [])
          .map((item) => String(item.draft_id || '').trim())
          .filter(Boolean)
        const localDraftIds: string[] = []
        for (const attachment of payload.launch_materials?.local_attachments || []) {
          if (attachment.status !== 'success' || !attachment.file) continue
          const contentBase64 = await fileToBase64(attachment.file)
          const upload = await client.uploadChatAttachment(result.snapshot.quest_id, {
            draft_id: attachment.draftId,
            file_name: attachment.name,
            mime_type: attachment.contentType || undefined,
            content_base64: contentBase64,
          })
          if (upload.ok && upload.draft_id) {
            localDraftIds.push(String(upload.draft_id))
          }
        }
        await client.sendChat(
          result.snapshot.quest_id,
          payload.goal.trim(),
          undefined,
          undefined,
          [...importedDraftIdsNormalized, ...localDraftIds]
        )
        navigate(`/projects/${result.snapshot.quest_id}`)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Failed to create quest.')
      } finally {
        setCreating(false)
      }
    },
    [navigate]
  )

  return (
    <div
      className="min-h-screen bg-[#F5F2EC] font-project"
      style={{
        backgroundImage:
          'radial-gradient(880px circle at 12% 12%, rgba(181, 194, 204, 0.2), transparent 58%), radial-gradient(740px circle at 88% 0%, rgba(214, 200, 180, 0.22), transparent 52%), linear-gradient(180deg, #F6F1EA 0%, #EFE7DD 100%)',
      }}
    >
      <CreateProjectDialog
        open
        loading={creating}
        error={error}
        onBack={() => navigate('/')}
        onClose={() => navigate('/')}
        onOpenBenchStore={() => navigate('/', { state: { landingDialog: 'benchstore' } })}
        onCreate={handleCreate}
      />
    </div>
  )
}

export default CreateAutonomousProjectPage
