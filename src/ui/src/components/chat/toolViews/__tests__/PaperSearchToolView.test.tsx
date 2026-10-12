import { render, screen } from '@testing-library/react'
import { PaperSearchToolView } from '@/components/chat/toolViews/PaperSearchToolView'
import type { ToolEventData } from '@/lib/types/chat-events'

const baseToolContent: ToolEventData = {
  event_id: 'evt-paper-search',
  timestamp: 1,
  tool_call_id: 'tool-paper-search',
  name: 'paper_search',
  status: 'called',
  function: 'paper_search',
  args: {},
}

describe('PaperSearchToolView', () => {
  it('renders question and arXiv links from tool result payload', () => {
    render(
      <PaperSearchToolView
        toolContent={{
          ...baseToolContent,
          args: {
            question: 'How to improve scientific paper review quality?',
          },
          content: {
            result: {
              query: 'How to improve scientific paper review quality?',
              count: 1,
              papers: [
                {
                  title: 'Reviewer Assistance for Scientific Writing',
                  abstract: 'We study review quality with structured feedback loops.',
                  arxiv_id: '2401.12345',
                  abs_url: 'https://arxiv.org/abs/2401.12345',
                  pdf_url: 'https://arxiv.org/pdf/2401.12345.pdf',
                  source: 'arxiv',
                },
              ],
            },
          },
        }}
        live={false}
        panelMode="inline"
      />
    )

    expect(
      screen.getByText('Question: "How to improve scientific paper review quality?" • 1 papers found')
    ).toBeInTheDocument()
    expect(screen.getByText('Reviewer Assistance for Scientific Writing')).toBeInTheDocument()
    expect(screen.getByText('arXiv:2401.12345')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'arXiv' })).toHaveAttribute(
      'href',
      'https://arxiv.org/abs/2401.12345'
    )
    expect(screen.getByRole('link', { name: 'PDF' })).toHaveAttribute(
      'href',
      'https://arxiv.org/pdf/2401.12345.pdf'
    )
  })

  it('shows a clear empty-result message after search completes', () => {
    render(
      <PaperSearchToolView
        toolContent={{
          ...baseToolContent,
          content: {
            query: 'What are new methods for multimodal review agents?',
            count: 0,
            papers: [],
          },
        }}
        live={false}
        panelMode="inline"
      />
    )

    expect(
      screen.getByText('Question: "What are new methods for multimodal review agents?" • 0 papers found')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Search completed, but no papers were returned. Try a narrower question.')
    ).toBeInTheDocument()
  })

  it('renders grouped parallel question results when question_results is provided', () => {
    render(
      <PaperSearchToolView
        toolContent={{
          ...baseToolContent,
          content: {
            result: {
              query: 'fallback query',
              count: 2,
              papers: [],
              question_results: [
                {
                  question: 'What are retrieval models for tool use in LLM agents?',
                  count: 1,
                  papers: [
                    {
                      title: 'Retrieval Models for Tool-Augmented LLMs',
                      arxiv_id: '2501.11111',
                      abs_url: 'https://arxiv.org/abs/2501.11111',
                      pdf_url: 'https://arxiv.org/pdf/2501.11111.pdf',
                    },
                  ],
                },
                {
                  question: 'How to benchmark tool selection quality?',
                  count: 1,
                  papers: [
                    {
                      title: 'Benchmarking Tool Selection in Agentic LLMs',
                      arxiv_id: '2502.22222',
                      abs_url: 'https://arxiv.org/abs/2502.22222',
                      pdf_url: 'https://arxiv.org/pdf/2502.22222.pdf',
                    },
                  ],
                },
              ],
            },
          },
        }}
        live={false}
        panelMode="inline"
      />
    )

    expect(screen.getByText('Parallel questions: 2 • 2 merged papers found')).toBeInTheDocument()
    expect(
      screen.getByText('Q1: "What are retrieval models for tool use in LLM agents?" • 1 papers found')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Q2: "How to benchmark tool selection quality?" • 1 papers found')
    ).toBeInTheDocument()
    expect(screen.getByText('Retrieval Models for Tool-Augmented LLMs')).toBeInTheDocument()
    expect(screen.getByText('Benchmarking Tool Selection in Agentic LLMs')).toBeInTheDocument()
  })

  it('shows paper_search usage count and annotation gate hint when provided', () => {
    render(
      <PaperSearchToolView
        toolContent={{
          ...baseToolContent,
          content: {
            result: {
              query: 'How to audit novelty in multimodal agents?',
              count: 1,
              papers: [
                {
                  title: 'Audit Loops for Multimodal Agents',
                  arxiv_id: '2503.33333',
                  abs_url: 'https://arxiv.org/abs/2503.33333',
                },
              ],
              paper_search_usage: {
                total_calls: 5,
              },
              required_paper_search_calls_for_pdf_annotate: 5,
              annotation_gate_hint:
                'paper_search total calls so far: 5. Retrieval threshold reached (>= 5). You can now start step-by-step PDF annotations.',
            },
          },
        }}
        live={false}
        panelMode="inline"
      />
    )

    expect(
      screen.getByText('paper_search calls: 5 (>=5 to start PDF annotations)')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'paper_search total calls so far: 5. Retrieval threshold reached (>= 5). You can now start step-by-step PDF annotations.'
      )
    ).toBeInTheDocument()
  })

  it('renders namespaced DeepXiv MCP structured results as paper cards', () => {
    render(
      <PaperSearchToolView
        toolContent={{
          ...baseToolContent,
          name: 'mcp__deepxiv__paper_search',
          function: 'mcp__deepxiv__paper_search',
          metadata: { mcp_server: 'deepxiv' },
          args: {
            query: 'gradient diversity for reasoning generalization',
          },
          content: {
            result: {
              structuredContent: {
                query: 'gradient diversity for reasoning generalization',
                result: [
                  {
                    title: 'Gradient Diversity Predicts Reasoning Generalization',
                    abstract: 'We study model-relevant data diversity with gradient features.',
                    paper_id: '2601.00001',
                    source: 'deepxiv',
                  },
                ],
              },
            },
          },
        }}
        live={false}
        panelMode="inline"
      />
    )

    expect(
      screen.getByText('Question: "gradient diversity for reasoning generalization" • 1 papers found • DeepXiv')
    ).toBeInTheDocument()
    expect(screen.getByText('Gradient Diversity Predicts Reasoning Generalization')).toBeInTheDocument()
    expect(screen.getByText('arXiv:2601.00001')).toBeInTheDocument()
    expect(screen.getByText('deepxiv')).toBeInTheDocument()
  })

  it('renders JSON text envelopes returned by MCP content blocks', () => {
    render(
      <PaperSearchToolView
        toolContent={{
          ...baseToolContent,
          name: 'mcp__pasa_search__paper_search',
          function: 'mcp__pasa_search__paper_search',
          metadata: { mcp_server: 'pasa_search' },
          args: {
            query: 'paper review agents',
          },
          content: {
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    query: 'paper review agents',
                    papers: [
                      {
                        title: 'Agentic Review Workflows for Scientific Papers',
                        arxiv_id: '2602.00002',
                        summary: 'A search and reading pipeline for AI-assisted paper review.',
                      },
                    ],
                  }),
                },
              ],
            },
          },
        }}
        live={false}
        panelMode="inline"
      />
    )

    expect(screen.getByText('Question: "paper review agents" • 1 papers found • PASA')).toBeInTheDocument()
    expect(screen.getByText('Agentic Review Workflows for Scientific Papers')).toBeInTheDocument()
    expect(screen.getByText('pasa')).toBeInTheDocument()
  })
})
