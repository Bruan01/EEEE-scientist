import type { ArxivItemResponse, ArxivListResponse } from '@/lib/types/arxiv'

const DEMO_ARXIV_ITEMS: Record<string, ArxivItemResponse[]> = {
  'demo-memory': [
    {
      file_id: '',
      document_id: null,
      path: null,
      arxiv_id: '2509.26603',
      title: '[2509.26603] DeepScientist: Advancing Frontier-Pushing Scientific Findings Progressively',
      authors: ['Yixuan Weng', 'Minjun Zhu', 'Qiujie Xie', 'Qiyao Sun', 'Zhen Lin', 'Sifan Liu', 'Yue Zhang'],
      abstract:
        'Example paper used by the first-run tutorial. In real projects, papers imported or read by the agent are collected here so the literature trail stays visible inside the workspace.',
      summary_source: 'agent_read',
      categories: ['cs.CL', 'cs.LG'],
      tags: ['tutorial-example', 'agent-read'],
      published_at: '2025-09-30T17:49:32Z',
      display_name: '2509.26603 · DeepScientist',
      created_at: '2026-03-22T14:06:00Z',
      updated_at: '2026-03-22T14:06:00Z',
      status: 'ready',
      error: null,
      version: 1,
    },
  ],
}

export function buildDemoArxivList(projectId: string): ArxivListResponse {
  return {
    items: DEMO_ARXIV_ITEMS[projectId] ?? [],
  }
}
