import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReadableStream as NodeReadableStream } from 'stream/web'
import useLabProjectStream from '@/lib/plugins/lab/components/useLabProjectStream'

const mockDispatchLabFocus = jest.fn()

jest.mock('@/lib/api/client', () => ({
  getApiBaseUrl: () => 'http://example.com',
}))

jest.mock('@/lib/plugins/lab/components/lab-focus', () => ({
  dispatchLabFocus: (...args: unknown[]) => mockDispatchLabFocus(...args),
}))

describe('useLabProjectStream', () => {
  beforeEach(() => {
    window.localStorage.setItem('ds_access_token', 'token-123')
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
    window.localStorage.clear()
    mockDispatchLabFocus.mockReset()
  })

  it('does not connect when disabled', async () => {
    const fetchMock = jest.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    renderHook(() => useLabProjectStream({ projectId: 'project-1', enabled: false }), {
      wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    })

    await act(async () => {})
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('invalidates targeted queries for lab.agent.changed', async () => {
    const encoder = new TextEncoder()
    const Stream = globalThis.ReadableStream ?? NodeReadableStream
    const stream = new Stream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'id: evt-1\n' +
              'event: lab.agent.changed\n' +
              'data: {"data":{"agent_instance_id":"a-1","action":"updated"}}\n\n'
          )
        )
        controller.close()
      },
    })

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: () => null,
      },
      body: stream,
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

    const { unmount } = renderHook(
      () => useLabProjectStream({ projectId: 'project-1', enabled: true }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      }
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['lab-agents', 'project-1'] })
      )
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['lab-overview', 'project-1'] })
      )
    })

    unmount()
  })

  it('dispatches focus for auto-focusable promoted/created agents', async () => {
    const encoder = new TextEncoder()
    const Stream = globalThis.ReadableStream ?? NodeReadableStream
    const stream = new Stream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'id: evt-focus\n' +
              'event: lab.agent.changed\n' +
              'data: {"data":{"agent_instance_id":"agent-focus-1","action":"promoted","auto_focus":true}}\n\n'
          )
        )
        controller.close()
      },
    })

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: () => null,
      },
      body: stream,
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const { unmount } = renderHook(
      () => useLabProjectStream({ projectId: 'project-1', enabled: true }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      }
    )

    await waitFor(() => {
      expect(mockDispatchLabFocus).toHaveBeenCalledWith({
        projectId: 'project-1',
        focusType: 'agent',
        focusId: 'agent-focus-1',
      })
    })

    unmount()
  })

  it('invalidates quest-scoped keys when quest id is present', async () => {
    const encoder = new TextEncoder()
    const Stream = globalThis.ReadableStream ?? NodeReadableStream
    const stream = new Stream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'id: evt-2\n' +
              'event: lab.quest.changed\n' +
              'data: {"data":{"quest_id":"quest-1","action":"updated"}}\n\n'
          )
        )
        controller.close()
      },
    })

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: () => null,
      },
      body: stream,
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

    const { unmount } = renderHook(
      () => useLabProjectStream({ projectId: 'project-1', enabled: true }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      }
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['lab-agents', 'project-1'] })
      )
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['lab-quests', 'project-1'] })
      )
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['lab-overview', 'project-1'] })
      )
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['lab-quest-detail', 'project-1', 'quest-1'] })
      )
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['lab-quest-graph', 'project-1', 'quest-1'] })
      )
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['lab-quest-node-trace', 'project-1', 'quest-1'] })
      )
    })

    unmount()
  })

  it('invalidates runtime queries for lab.quest.runtime', async () => {
    const encoder = new TextEncoder()
    const Stream = globalThis.ReadableStream ?? NodeReadableStream
    const stream = new Stream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'id: evt-runtime\n' +
              'event: lab.quest.runtime\n' +
              'data: {"data":{"quest_id":"quest-1","action":"runtime_updated"}}\n\n'
          )
        )
        controller.close()
      },
    })

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: () => null,
      },
      body: stream,
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

    const { unmount } = renderHook(
      () => useLabProjectStream({ projectId: 'project-1', enabled: true }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      }
    )

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['lab-quest-runtime', 'project-1', 'quest-1'] })
      )
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['lab-quest-summary', 'project-1', 'quest-1'] })
      )
    })

    unmount()
  })

  it('reconnects after a fetch error', async () => {
    jest.useFakeTimers()

    const encoder = new TextEncoder()
    const Stream = globalThis.ReadableStream ?? NodeReadableStream
    const stream = new Stream({
      start(controller) {
        controller.enqueue(encoder.encode('id: evt-2\nevent: lab.ping\ndata: {}\n\n'))
        controller.close()
      },
    })

    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: () => null,
        },
        body: stream,
      })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const { unmount } = renderHook(
      () => useLabProjectStream({ projectId: 'project-1', enabled: true }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      }
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      await Promise.resolve()
      jest.runOnlyPendingTimers()
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    unmount()
  })

  it('dedupes repeated stream events with same id+type', async () => {
    const encoder = new TextEncoder()
    const Stream = globalThis.ReadableStream ?? NodeReadableStream
    const stream = new Stream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'id: evt-dup-1\n' +
              'event: lab.quest.changed\n' +
              'data: {"data":{"quest_id":"quest-dup","action":"sync"}}\n\n'
          )
        )
        setTimeout(() => {
          controller.enqueue(
            encoder.encode(
              'id: evt-dup-1\n' +
                'event: lab.quest.changed\n' +
                'data: {"data":{"quest_id":"quest-dup","action":"sync"}}\n\n'
            )
          )
          controller.close()
        }, 140)
      },
    })

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: () => null,
      },
      body: stream,
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

    const { unmount } = renderHook(
      () => useLabProjectStream({ projectId: 'project-1', enabled: true }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      }
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      const questDetailInvalidations = invalidateSpy.mock.calls.filter((call) => {
        const target = call[0] as { queryKey?: unknown[] } | undefined
        return (
          JSON.stringify(target?.queryKey) ===
          JSON.stringify(['lab-quest-detail', 'project-1', 'quest-dup'])
        )
      })
      // This key is quest-scoped and only comes from the event path (not stream-open recovery).
      // We emit the same event id+type in two separate batches; dedupe should keep it to one invalidation.
      expect(questDetailInvalidations).toHaveLength(1)
    })

    unmount()
  })
})
