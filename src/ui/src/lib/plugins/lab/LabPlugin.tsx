'use client'

import { useEffect } from 'react'
import type { PluginComponentProps } from '@/lib/types/plugin'
import LabSurface from './components/LabSurface'
import { useMaxEntitlement } from '@/lib/hooks/useMaxEntitlement'
import { useI18n } from '@/lib/i18n/useI18n'
import './lab.css'

const LAB_FOCUS_EVENT = 'ds:lab:focus'

export default function LabPlugin({ context, setTitle }: PluginComponentProps) {
  const { t } = useI18n('lab')
  const maxEntitlement = useMaxEntitlement('lab.use')
  const projectId =
    typeof context.customData?.projectId === 'string' ? context.customData.projectId : null
  const readOnly = Boolean(context.customData?.readOnly)
  const focusType =
    context.customData?.focusType === 'agent' ||
    context.customData?.focusType === 'quest' ||
    context.customData?.focusType === 'quest-branch' ||
    context.customData?.focusType === 'quest-event' ||
    context.customData?.focusType === 'overview'
      ? context.customData.focusType
      : null
  const focusId = typeof context.customData?.focusId === 'string' ? context.customData.focusId : null
  const focusBranch =
    typeof context.customData?.branch === 'string' ? context.customData.branch : null
  const focusEventId =
    typeof context.customData?.eventId === 'string' ? context.customData.eventId : null

  useEffect(() => {
    setTitle(t('plugin_home_title', undefined, 'Home'))
  }, [setTitle, t])

  useEffect(() => {
    if (!projectId || !focusType) return
    if (!focusId && focusType !== 'overview') return
    window.dispatchEvent(
      new CustomEvent(LAB_FOCUS_EVENT, {
        detail: {
          projectId,
          focusType,
          focusId,
          branch: focusBranch,
          eventId: focusEventId,
        },
      })
    )
  }, [focusBranch, focusEventId, focusId, focusType, projectId])

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-[var(--soft-border)] bg-[var(--soft-bg-surface)]">
        <div className="text-sm text-[var(--soft-text-secondary)]">
          {t('plugin_project_not_found', undefined, 'Project not found.')}
        </div>
      </div>
    )
  }

  if (!maxEntitlement.isEntitlementLoading && !maxEntitlement.isMaxEntitled) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-[var(--soft-border)] bg-[var(--soft-bg-surface)]">
        <div className="px-6 text-center">
          <div className="text-sm font-medium text-[var(--soft-text-primary)]">
            {t('plugin_plan_access_required', undefined, 'Plan access required')}
          </div>
          <div className="mt-1 text-xs text-[var(--soft-text-secondary)]">
            {t('plugin_max_only_desc', undefined, 'Lab is currently available for Max users only.')}
          </div>
        </div>
      </div>
    )
  }

  return <LabSurface projectId={projectId} readOnly={readOnly} />
}
