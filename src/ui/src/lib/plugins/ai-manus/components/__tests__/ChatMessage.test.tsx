import { fireEvent, render, screen } from '@testing-library/react'
import { ChatMessage } from '@/lib/plugins/ai-manus/components/ChatMessage'
import type { ChatMessageItem } from '@/lib/plugins/ai-manus/types'
import type { ToolContent } from '@/lib/plugins/ai-manus/types'

const now = Math.floor(Date.now() / 1000)

describe('ChatMessage', () => {
  it('renders user content', () => {
    const message: ChatMessageItem = {
      id: 'msg-user',
      type: 'user',
      seq: 1,
      ts: now,
      content: {
        content: 'Hello world',
        timestamp: now,
        role: 'user',
      },
    }

    render(<ChatMessage message={message} />)

    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders assistant streaming state', () => {
    const message: ChatMessageItem = {
      id: 'msg-assistant',
      type: 'text_delta',
      seq: 1,
      ts: now,
      content: {
        content: 'Streaming response',
        timestamp: now,
        role: 'assistant',
        status: 'in_progress',
      },
    }

    const { container } = render(<ChatMessage message={message} displayStreaming />)

    expect(screen.getByText('DeepScientist')).toBeInTheDocument()
    expect(container.querySelector('[data-content-streaming="true"]')).toBeTruthy()
  })

  it('renders restored user text_delta as user', () => {
    const message: ChatMessageItem = {
      id: 'msg-user-restored',
      type: 'text_delta',
      seq: 1,
      ts: now,
      content: {
        content: 'Restored user message',
        timestamp: now,
        role: 'user',
      },
    }

    render(<ChatMessage message={message} />)

    expect(screen.getByText('Restored user message')).toBeInTheDocument()
    expect(screen.queryByText('DeepScientist')).toBeNull()
  })

  it('renders tool chips', () => {
    const tool: ToolContent = {
      event_id: 'evt-1',
      timestamp: now,
      tool_call_id: 'tool-1',
      name: 'shell',
      status: 'calling',
      function: 'shell_exec',
      args: { command: 'ls' },
    }

    const message: ChatMessageItem = {
      id: 'msg-tool',
      type: 'tool_call',
      seq: 1,
      ts: now,
      content: tool,
    }

    render(<ChatMessage message={message} />)

    expect(screen.getByText('Executing command')).toBeInTheDocument()
    expect(screen.getByText('ls')).toBeInTheDocument()
  })

  it('renders attachments and fires click handler', () => {
    const handleClick = jest.fn()
    const message: ChatMessageItem = {
      id: 'msg-attachments',
      type: 'attachments',
      seq: 1,
      ts: now,
      content: {
        role: 'user',
        timestamp: now,
        attachments: [
          {
            file_id: 'file-1',
            filename: 'report.pdf',
            size: 1024,
          },
        ],
      },
    }

    render(<ChatMessage message={message} onFileClick={handleClick} />)

    fireEvent.click(screen.getByText('report.pdf'))
    expect(handleClick).toHaveBeenCalledWith('file-1')
  })
})
