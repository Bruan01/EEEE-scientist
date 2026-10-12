import { fireEvent, render, screen } from '@testing-library/react'
import { ToolPanel } from '@/lib/plugins/ai-manus/components/ToolPanel'
import type { ToolContent } from '@/lib/plugins/ai-manus/types'

const baseTool: ToolContent = {
  event_id: 'evt-1',
  timestamp: Math.floor(Date.now() / 1000),
  tool_call_id: 'tool-1',
  name: 'message',
  status: 'called',
  function: 'message_notify_user',
  args: {},
}

describe('ToolPanel', () => {
  it('renders only when open and closes on escape', () => {
    const onClose = jest.fn()
    const onJump = jest.fn()

    const { rerender } = render(
      <ToolPanel
        open={false}
        toolContent={baseTool}
        live={false}
        realTime
        onClose={onClose}
        onJumpToRealTime={onJump}
      />
    )

    expect(screen.queryByText('Tool Panel')).not.toBeInTheDocument()

    rerender(
      <ToolPanel
        open
        toolContent={baseTool}
        live={false}
        realTime
        onClose={onClose}
        onJumpToRealTime={onJump}
      />
    )

    expect(screen.getByText('Tool Panel')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
