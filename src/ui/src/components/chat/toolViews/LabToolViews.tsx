'use client'

import type { ToolViewProps } from './types'
import type { ToolContent } from '@/lib/plugins/ai-manus/types'
import { LabToolCard } from '@/lib/plugins/ai-manus/components/LabToolCard'

function LabToolPanelBase({ toolContent }: ToolViewProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--background-surface)]">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto w-full max-w-[560px]">
          <LabToolCard tool={toolContent as ToolContent} />
        </div>
      </div>
    </div>
  )
}

export function LabQuestToolView(props: ToolViewProps) {
  return <LabToolPanelBase {...props} />
}

export function LabPiSleepToolView(props: ToolViewProps) {
  return <LabToolPanelBase {...props} />
}

export function LabBaselineToolView(props: ToolViewProps) {
  return <LabToolPanelBase {...props} />
}
