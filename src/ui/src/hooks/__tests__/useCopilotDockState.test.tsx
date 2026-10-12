import * as React from 'react'
import { render, screen } from '@testing-library/react'

import { useCopilotDockState } from '@/hooks/useCopilotDockState'

function Harness({ stageWidth }: { stageWidth: number }) {
  const dock = useCopilotDockState('p1', { defaultOpen: true, defaultWidth: 440 })

  React.useEffect(() => {
    dock.clampToStage(stageWidth)
    // Intentionally depend on the whole object to mimic a common mistake and ensure
    // clampToStage is idempotent (prevents maximum update depth loops).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dock, stageWidth])

  return <div data-testid="width">{dock.state.width}</div>
}

describe('useCopilotDockState', () => {
  it('clampToStage is idempotent for the same stage width', () => {
    render(<Harness stageWidth={1400} />)
    expect(screen.getByTestId('width')).toBeInTheDocument()
  })
})

