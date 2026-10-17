'use client'

import * as React from 'react'
import { GitBranch, Info } from 'lucide-react'

import { useI18n } from '@/lib/i18n/useI18n'
import type { GitBranchNode, GitBranchesPayload } from '@/types'
import { cn } from '@/lib/utils'

type BranchMapExplainerProps = {
  branches: GitBranchesPayload | null
}
function branchKindLabel(node: GitBranchNode, zh: boolean) {
  const ref = String(node.ref || '').trim().toLowerCase()
  if (ref.startsWith('idea/')) return zh ? 'Idea 分支' : 'Idea branch'
  if (ref.startsWith('analysis/')) return zh ? '分析切片' : 'Analysis slice'
  if (ref.startsWith('paper/')) return zh ? '论文工作区' : 'Paper workspace'
  if (node.branch_kind === 'implementation' || ref.startsWith('run/')) return zh ? '实验实现' : 'Experiment implementation'
  if (node.branch_kind === 'quest' || ref === String(node.ref || '').split('/')[0]) return zh ? '项目主线' : 'Quest line'
  return zh ? '其他 Git 分支' : 'Other Git branch'
}

function branchOrigin(node: GitBranchNode, zh: boolean) {
  const ref = String(node.ref || '').trim().toLowerCase()
  if (ref.startsWith('idea/')) return zh ? '通常由 submit_idea(mode=create) 创建' : 'Usually created by submit_idea(mode=create)'
  if (ref.startsWith('analysis/')) return zh ? '由 analysis campaign 为每个 slice 创建' : 'Created once per analysis-campaign slice'
  if (ref.startsWith('paper/')) return zh ? '写作链路创建 paper 工作区时出现' : 'Appears when the writing flow creates a paper workspace'
  if (node.branch_kind === 'implementation' || ref.startsWith('run/')) return zh ? '由 prepare_branch 或主实验工作区创建' : 'Created by prepare_branch or a main-experiment workspace'
  return zh ? '项目初始化或手动 Git 分支' : 'Project initialization or a manual Git branch'
}

export function BranchMapExplainer({ branches }: BranchMapExplainerProps) {
  const { language } = useI18n('admin')
  const zh = language === 'zh-CN'
  const nodes = branches?.nodes || []
  const counts = React.useMemo(() => {
    const result = { quest: 0, idea: 0, implementation: 0, analysis: 0, paper: 0, other: 0 }
    nodes.forEach((node) => {
      const ref = String(node.ref || '').trim().toLowerCase()
      if (ref.startsWith('idea/') || node.branch_kind === 'idea') result.idea += 1
      else if (ref.startsWith('analysis/') || node.branch_kind === 'analysis' || node.mode === 'analysis') result.analysis += 1
      else if (ref.startsWith('paper/')) result.paper += 1
      else if (ref.startsWith('run/') || node.branch_kind === 'implementation') result.implementation += 1
      else if (node.branch_kind === 'quest' || ref === branches?.default_ref) result.quest += 1
      else result.other += 1
    })
    return result
  }, [branches?.default_ref, nodes])

  const recentNodes = [...nodes]
    .sort((left, right) => String(right.updated_at || '').localeCompare(String(left.updated_at || '')))
    .slice(0, 4)

  return (
    <div className="mt-7 border-t border-dashed border-black/[0.10] pt-6 dark:border-white/[0.10]">
      <div className="flex items-start gap-3">
        <div className="mt-1 shrink-0 text-muted-foreground">
          <GitBranch className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {zh ? 'Branch Map 怎么变化' : 'How Branch Map changes'}
          </div>
          <div className="mt-2 text-sm leading-7 text-muted-foreground">
            {branches
              ? zh
                ? `当前有 ${nodes.length} 个持久化 Git 分支节点；当前工作区是 ${branches.active_workspace_ref || branches.current_ref || 'main'}。`
                : `${nodes.length} durable Git branch nodes are visible; the active workspace is ${branches.active_workspace_ref || branches.current_ref || 'main'}.`
              : zh
                ? '正在读取 Git 分支投影，节点解释会在数据返回后显示。'
                : 'Loading the Git branch projection; the node explanation will appear when it is ready.'}
          </div>
        </div>
      </div>

      {branches ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {[
              [zh ? '项目主线' : 'Quest', counts.quest],
              [zh ? 'Idea' : 'Ideas', counts.idea],
              [zh ? '实验实现' : 'Implementations', counts.implementation],
              [zh ? '分析切片' : 'Analysis', counts.analysis],
              [zh ? '论文工作区' : 'Paper', counts.paper],
              [zh ? '其他' : 'Other', counts.other],
            ].map(([label, count]) => (
              <span key={String(label)} className="rounded-full border border-black/[0.10] px-2.5 py-1 text-muted-foreground dark:border-white/[0.12]">
                {label} {count}
              </span>
            ))}
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <div className="rounded-[18px] border border-black/[0.08] bg-white/60 px-4 py-3 dark:border-white/[0.10] dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
                {zh ? '什么时候会增加节点' : 'What adds a node'}
              </div>
              <div className="mt-2 space-y-1.5 text-xs leading-6 text-muted-foreground">
                <div>{zh ? '新建一个 Git ref 时，Branch Map 会增加一个真实节点。' : 'A real node appears when a new Git ref is created.'}</div>
                <div>{zh ? '常见来源：新 Idea、主实验工作区、每个 analysis slice、paper 工作区，或手动建分支。' : 'Common sources: a new idea, an experiment workspace, each analysis slice, a paper workspace, or a manual branch.'}</div>
                <div>{zh ? '同一分支上的提交、重复运行、普通 artifact 更新不会增加节点，只会更新该节点。' : 'Commits, reruns, and ordinary artifact updates on the same branch update a node; they do not add one.'}</div>
              </div>
            </div>

            <div className="rounded-[18px] border border-black/[0.08] bg-white/60 px-4 py-3 dark:border-white/[0.10] dark:bg-white/[0.03]">
              <div className="text-xs font-semibold text-foreground">{zh ? '当前最近的分支 ref' : 'Recent branch refs'}</div>
              <div className="mt-2 space-y-2">
                {recentNodes.length ? (
                  recentNodes.map((node) => (
                    <div key={node.ref} className="min-w-0">
                      <div className="truncate font-mono text-xs text-foreground">{node.ref}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {branchKindLabel(node, zh)} · {branchOrigin(node, zh)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs leading-6 text-muted-foreground">{zh ? '还没有真实 Git 分支节点。' : 'No durable Git branch nodes yet.'}</div>
                )}
              </div>
            </div>
          </div>

          <div className={cn('mt-3 text-[11px] leading-5 text-muted-foreground')}>
            {zh
              ? '注意：画布中的 baseline 根节点和“下一步”占位节点是解释性节点，不是 Git 分支；它们不会让真实 Branch Map 数量增加。'
              : 'Note: the canvas may also show a baseline root and a next-step placeholder. They are explanatory nodes, not Git branches, so they do not increase the durable Branch Map count.'}
          </div>
        </>
      ) : null}
    </div>
  )
}
