import { render, screen } from '@testing-library/react'
import { ReadPaperToolView } from '@/components/chat/toolViews/ReadPaperToolView'
import type { ToolEventData } from '@/lib/types/chat-events'

const baseToolContent: ToolEventData = {
  event_id: 'evt-read-paper',
  timestamp: 1,
  tool_call_id: 'tool-read-paper',
  name: 'read_paper',
  status: 'called',
  function: 'read_paper',
  args: {},
}

describe('ReadPaperToolView', () => {
  it('renders arXiv card with question and answer', () => {
    render(
      <ReadPaperToolView
        toolContent={{
          ...baseToolContent,
          content: {
            success: true,
            count: 1,
            success_count: 1,
            failed_count: 0,
            usage: {
              input_tokens: 120,
              output_tokens: 30,
              total_tokens: 150,
            },
            results: [
              {
                id: '2303.08774',
                question: 'What is the main contribution?',
                status: 'ok',
                answer: 'The method introduces a stronger scaling path.',
                arxiv: {
                  arxiv_id: '2303.08774',
                  abs_url: 'https://arxiv.org/abs/2303.08774',
                  pdf_url: 'https://arxiv.org/pdf/2303.08774.pdf',
                },
              },
            ],
          },
        }}
        live={false}
        panelMode="inline"
      />
    )

    expect(screen.getByText('What is the main contribution?')).toBeInTheDocument()
    expect(screen.getByText('The method introduces a stronger scaling path.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'arXiv' })).toHaveAttribute(
      'href',
      'https://arxiv.org/abs/2303.08774'
    )
    expect(screen.getByRole('link', { name: 'PDF' })).toHaveAttribute(
      'href',
      'https://arxiv.org/pdf/2303.08774.pdf'
    )
  })

  it('renders namespaced PASA MCP content envelopes', () => {
    render(
      <ReadPaperToolView
        toolContent={{
          ...baseToolContent,
          name: 'mcp__pasa_search__read_paper',
          function: 'mcp__pasa_search__read_paper',
          metadata: { mcp_server: 'pasa_search' },
          content: {
            result: {
              structured_content: {
                count: 1,
                success_count: 1,
                failed_count: 0,
                results: [
                  {
                    paper_id: '2602.00002',
                    question: 'What evidence supports the method?',
                    status: 'ok',
                    answer: 'The paper reports controlled retrieval and annotation ablations.',
                    arxiv: {
                      paper_id: '2602.00002',
                    },
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

    expect(screen.getByText(/Processed 1 item\(s\): 1 succeeded, 0 failed\. · PASA/)).toBeInTheDocument()
    expect(screen.getByText('What evidence supports the method?')).toBeInTheDocument()
    expect(
      screen.getByText('The paper reports controlled retrieval and annotation ablations.')
    ).toBeInTheDocument()
  })
})
