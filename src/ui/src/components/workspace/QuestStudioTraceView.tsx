'use client'

import * as React from 'react'
import { X } from 'lucide-react'

import { useToast } from '@/components/ui/toast'
import { useQuestMessageAttachments, type QuestMessageAttachmentDraft } from '@/lib/hooks/useQuestMessageAttachments'
import { useI18n } from '@/lib/i18n/useI18n'
import type { CopilotPrefill } from '@/lib/plugins/ai-manus/view-types'
import type { FeedItem, QuestSummary } from '@/types'
import { QuestCopilotComposer } from './QuestCopilotComposer'
import { QuestCopilotPaneLayout } from './QuestCopilotPaneLayout'
import { QuestStudioDirectTimeline } from './QuestStudioDirectTimeline'

type ConnectorCommand = {
  name: string
  description?: string
}

type MessageQueueActionResult = {
  ok?: boolean
  status?: string
  message?: string
}

type QuestStudioTraceViewProps = {
  questId: string
  feed: FeedItem[]
  snapshot?: QuestSummary | null
  loading: boolean
  restoring: boolean
  streaming: boolean
  activeToolCount: number
  connectionState: 'connecting' | 'connected' | 'reconnecting' | 'error'
  error?: string | null
  stopping?: boolean
  showStopButton?: boolean
  slashCommands?: ConnectorCommand[]
  hasOlderHistory?: boolean
  loadingOlderHistory?: boolean
  onLoadOlderHistory?: () => Promise<void>
  onSubmit: (message: string, attachments?: QuestMessageAttachmentDraft[]) => Promise<void>
  onReadNow?: (messageId: string) => Promise<MessageQueueActionResult | void>
  onWithdraw?: (messageId: string) => Promise<MessageQueueActionResult | void>
  onStopRun: () => Promise<void>
  prefill?: CopilotPrefill | null
  beforeFeed?: React.ReactNode
}

export function QuestStudioTraceView({
  questId,
  feed,
  snapshot,
  loading,
  restoring,
  streaming,
  activeToolCount,
  connectionState,
  error,
  stopping = false,
  showStopButton = false,
  slashCommands = [],
  hasOlderHistory = false,
  loadingOlderHistory = false,
  onLoadOlderHistory,
  onSubmit,
  onReadNow,
  onWithdraw,
  onStopRun,
  prefill = null,
  beforeFeed = null,
}: QuestStudioTraceViewProps) {
  const { t } = useI18n('workspace')
  const { addToast } = useToast()
  const [input, setInput] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const attachmentState = useQuestMessageAttachments(questId)
  const [messageAction, setMessageAction] = React.useState<{
    messageId: string
    kind: 'read_now' | 'withdraw'
  } | null>(null)
  const statusLine = React.useMemo(() => {
    if (error) {
      return error
    }
    if (restoring || loading) {
      return t('copilot_trace_restoring', undefined, 'Restoring recent Studio trace…')
    }
    if (connectionState === 'connecting') {
      return t('copilot_trace_connecting', undefined, 'Connecting to Studio trace…')
    }
    if (connectionState === 'reconnecting') {
      return t('copilot_trace_reconnecting', undefined, 'Reconnecting to Studio trace…')
    }
    if (streaming) {
      return activeToolCount > 0
        ? t('copilot_trace_streaming_tools', { count: activeToolCount }, 'Streaming reply · {count} tools running')
        : t('copilot_trace_streaming', undefined, 'Streaming reply')
    }
    if (activeToolCount > 0) {
      return t('copilot_trace_tools_running', { count: activeToolCount }, '{count} tools running')
    }
    return t('copilot_trace_ready', undefined, 'Studio trace ready')
  }, [activeToolCount, connectionState, error, loading, restoring, streaming, t])

  const handleSubmit = React.useCallback(async () => {
    const trimmed = input.trim()
    if (submitting) return
    if (!trimmed && attachmentState.successfulAttachments.length === 0) return
    if (attachmentState.hasUploading || attachmentState.hasFailures) return
    setSubmitting(true)
    try {
      await onSubmit(trimmed, attachmentState.successfulAttachments)
      setInput('')
      await attachmentState.clearAll()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught)
      addToast({
        title: t('copilot_send_failed_title', undefined, 'Send failed'),
        message,
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }, [addToast, attachmentState, input, onSubmit, submitting, t])

  const handleStop = React.useCallback(async () => {
    if (stopping) return
    try {
      await onStopRun()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught)
      addToast({
        title: t('copilot_stop', undefined, 'Stop'),
        message,
        variant: 'error',
      })
    }
  }, [addToast, onStopRun, stopping, t])

  const handleReadNow = React.useCallback(
    async (messageId: string) => {
      if (!onReadNow || !messageId || messageAction) return
      setMessageAction({ messageId, kind: 'read_now' })
      try {
        const result = await onReadNow(messageId)
        if (result?.status === 'already_read') {
          addToast({
            type: 'success',
            title: t('copilot_message_read_now_already_sent', undefined, 'Already sent'),
            description: t('copilot_message_read_now_already_sent_desc', undefined, 'This message was already sent to the agent.'),
          })
        } else if (result?.ok === false) {
          addToast({
            type: 'error',
            title: t('copilot_message_read_now_failed', undefined, 'Read now failed'),
            description:
              result.message ||
              t('copilot_message_read_now_failed_desc', undefined, 'Unable to force immediate read for this message.'),
          })
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        addToast({
          title: t('copilot_message_read_now_failed', undefined, 'Read now failed'),
          description: message,
          type: 'error',
        })
      } finally {
        setMessageAction(null)
      }
    },
    [addToast, messageAction, onReadNow, t]
  )

  const handleWithdraw = React.useCallback(
    async (messageId: string) => {
      if (!onWithdraw || !messageId || messageAction) return
      setMessageAction({ messageId, kind: 'withdraw' })
      try {
        const result = await onWithdraw(messageId)
        if (result?.status === 'already_withdrawn') {
          addToast({
            type: 'info',
            title: t('copilot_message_withdrawn', undefined, 'Withdrawn'),
            description: t('copilot_message_withdraw_already_done', undefined, 'This message was already withdrawn.'),
          })
        } else if (result?.ok === false) {
          addToast({
            type: 'error',
            title: t('copilot_message_withdraw_failed', undefined, 'Withdraw failed'),
            description:
              result.status === 'already_read'
                ? t('copilot_message_withdraw_failed_already_read_desc', undefined, 'Withdrawal failed because this message was already sent to the agent.')
                : result.message || t('copilot_message_withdraw_failed_desc', undefined, 'Unable to withdraw this message.'),
          })
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        addToast({
          type: 'error',
          title: t('copilot_message_withdraw_failed', undefined, 'Withdraw failed'),
          description: message,
        })
      } finally {
        setMessageAction(null)
      }
    },
    [addToast, messageAction, onWithdraw, t]
  )

  React.useEffect(() => {
    if (!prefill?.text) return
    setInput((current) => {
      const trimmed = current.trim()
      if (!trimmed) return prefill.text
      if (trimmed.includes(prefill.text)) return current
      return `${current.replace(/\s*$/, '')}\n\n${prefill.text}`
    })
  }, [prefill])

  const waitingNotice = snapshot?.waiting_notice
  const waitingNoticeStatus = String(waitingNotice?.status || '').trim().toLowerCase()
  const waitingNoticeMessage = String(waitingNotice?.message || '').trim()
  const waitingNoticeLabel = String(waitingNotice?.label || '').trim()
  const waitingNoticeReason = String(waitingNotice?.reason || snapshot?.continuation_reason || '').trim()
  const waitingNoticeCreatedAt = String(waitingNotice?.created_at || '').trim()
  const waitingNoticeKey = React.useMemo(
    () =>
      [
        waitingNoticeStatus,
        waitingNoticeLabel,
        waitingNoticeMessage,
        waitingNoticeReason,
        waitingNoticeCreatedAt,
      ].join('|'),
    [
      waitingNoticeCreatedAt,
      waitingNoticeLabel,
      waitingNoticeMessage,
      waitingNoticeReason,
      waitingNoticeStatus,
    ]
  )
  const [dismissedWaitingNoticeKey, setDismissedWaitingNoticeKey] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (waitingNoticeStatus !== 'auto_resumed' || !waitingNoticeKey) return
    const timer = window.setTimeout(() => {
      setDismissedWaitingNoticeKey(waitingNoticeKey)
    }, 10_000)
    return () => window.clearTimeout(timer)
  }, [waitingNoticeKey, waitingNoticeStatus])
  const dismissWaitingNotice = React.useCallback(() => {
    if (!waitingNoticeKey) return
    setDismissedWaitingNoticeKey(waitingNoticeKey)
  }, [waitingNoticeKey])
  const waitingBanner = React.useMemo(() => {
    if (waitingNoticeStatus !== 'waiting' && waitingNoticeStatus !== 'auto_resumed') return null
    if (dismissedWaitingNoticeKey === waitingNoticeKey) return null
    const isWaiting = waitingNoticeStatus === 'waiting'
    const title = waitingNoticeLabel || (isWaiting
      ? t('copilot_waiting_feedback', undefined, 'Waiting for feedback')
      : t('copilot_auto_resumed', undefined, 'Auto-resumed'))
    const body = waitingNoticeMessage || (isWaiting
      ? t('copilot_waiting_feedback_body', undefined, 'DeepScientist paused automatic continuation and is waiting for your decision.')
      : t('copilot_auto_resumed_body', undefined, 'DeepScientist converted a waiting state back into automatic continuation for this autonomous quest.'))
    return (
      <div
        className={[
          'mx-4 mt-3 rounded-xl border px-4 py-3 text-sm shadow-[0_14px_38px_rgba(85,75,65,0.10)] backdrop-blur-md',
          isWaiting
            ? 'border-[#cab79f]/55 bg-[#f3eee7]/95 text-[#574b3f] dark:border-[#b8a58d]/35 dark:bg-[#302b26]/92 dark:text-[#eee4d6]'
            : 'border-[#a9b8ab]/55 bg-[#edf2ee]/95 text-[#405047] dark:border-[#9caf9f]/35 dark:bg-[#24302a]/92 dark:text-[#dfe9e1]',
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-75">{title}</div>
            <div className="mt-1 leading-5 text-[13px]">{body}</div>
            {waitingNoticeReason ? <div className="mt-1 text-xs opacity-65">{waitingNoticeReason}</div> : null}
          </div>
          <button
            type="button"
            onClick={dismissWaitingNotice}
            className={[
              'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors',
              isWaiting
                ? 'border-[#cdbda8]/55 bg-white/30 text-[#6a5b4c] hover:bg-white/55 dark:border-[#9d8a72]/35 dark:bg-white/[0.06] dark:text-[#e8d9c5] dark:hover:bg-white/[0.12]'
                : 'border-[#aebdaf]/55 bg-white/35 text-[#4c6355] hover:bg-white/60 dark:border-[#89a08d]/35 dark:bg-white/[0.06] dark:text-[#d5e5d8] dark:hover:bg-white/[0.12]',
            ].join(' ')}
            aria-label={t('copilot_notice_dismiss', undefined, 'Dismiss notice')}
            title={t('copilot_notice_dismiss', undefined, 'Dismiss notice')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }, [
    dismissWaitingNotice,
    dismissedWaitingNoticeKey,
    t,
    waitingNoticeKey,
    waitingNoticeLabel,
    waitingNoticeMessage,
    waitingNoticeReason,
    waitingNoticeStatus,
  ])

  return (
    <QuestCopilotPaneLayout
      statusLine={statusLine}
      footer={
        <QuestCopilotComposer
          value={input}
          onValueChange={setInput}
          onSubmit={handleSubmit}
          onStop={handleStop}
          submitting={submitting}
          stopping={stopping}
          showStopButton={showStopButton}
          slashCommands={slashCommands}
          placeholder={t('copilot_connector_placeholder')}
          enterHint={t('copilot_connector_enter_hint')}
          sendLabel={t('copilot_send')}
          stopLabel={t('copilot_stop')}
          focusToken={prefill?.focus ? prefill.token : null}
          attachments={attachmentState.attachments}
          onQueueFiles={attachmentState.queueFiles}
          onRemoveAttachment={attachmentState.removeAttachment}
        />
      }
    >
      {({ bottomInset }) => (
        <div className="flex min-h-0 flex-1 flex-col">
          {waitingBanner}
          {beforeFeed}
          <QuestStudioDirectTimeline
            questId={questId}
            feed={feed}
            loading={loading}
            restoring={restoring}
            streaming={streaming}
            activeToolCount={activeToolCount}
            connectionState={connectionState}
            error={error}
            snapshot={snapshot}
            hasOlderHistory={hasOlderHistory}
            loadingOlderHistory={loadingOlderHistory}
            onLoadOlderHistory={onLoadOlderHistory}
            onReadNow={handleReadNow}
            onWithdraw={handleWithdraw}
            messageAction={messageAction}
            emptyLabel={t('copilot_studio_empty', undefined, 'Copilot trace appears here.')}
            bottomInset={bottomInset}
          />
        </div>
      )}
    </QuestCopilotPaneLayout>
  )
}

export default QuestStudioTraceView
