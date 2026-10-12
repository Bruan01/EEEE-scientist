import { act, renderHook, waitFor } from '@testing-library/react'
import { ReadableStream as NodeReadableStream } from 'stream/web'
import { __resetSSESessionManagerForTests, useSSESession } from '@/lib/hooks/useSSESession'
import { useChatSessionStore } from '@/lib/stores/session'
import { __resetChatEventCacheForTests, getCachedSessionEvents } from '@/lib/stores/chat-event-cache'

jest.mock('@/lib/api/client', () => ({
  getApiBaseUrl: () => 'http://example.com',
}))

function resetStore() {
  useChatSessionStore.setState({
    sessionIdsByProject: {},
    lastEventIdBySession: {},
    executionTargetsByProject: {},
    cliServerIdsByProject: {},
  })
}

describe('useSSESession', () => {
  beforeEach(() => {
    resetStore()
    __resetChatEventCacheForTests()
    __resetSSESessionManagerForTests()
    window.localStorage.clear()
  })

  it('sends Last-Event-ID and updates store on replay', async () => {
    const sessionId = 'sess-1'
    const onEvent = jest.fn()
    useChatSessionStore.getState().setLastEventId(sessionId, 'evt-0')

    const encoder = new TextEncoder()
    const Stream = globalThis.ReadableStream ?? NodeReadableStream
    const stream = new Stream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: message\n' +
              'data: {"event_id":"evt-1","timestamp":1,"role":"assistant","content":"hi"}\n\n'
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

    const { result } = renderHook(() =>
      useSSESession({ sessionId, projectId: 'proj-1', onEvent })
    )

    await act(async () => {
      await result.current.sendMessage({
        message: 'hi',
        surface: 'welcome',
        replayFromLastEvent: true,
      })
    })

    const [, options] = fetchMock.mock.calls[0]
    const headers = options?.headers as Record<string, string>

    expect(headers['Last-Event-ID']).toBe('evt-0')
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'message' }),
      expect.objectContaining({ sessionId })
    )
    expect(useChatSessionStore.getState().getLastEventId(sessionId)).toBe('evt-1')
  })

  it('does not update Last-Event-ID for message delta events', async () => {
    const sessionId = 'sess-2'
    const onEvent = jest.fn()
    useChatSessionStore.getState().setLastEventId(sessionId, 'evt-0')

    const encoder = new TextEncoder()
    const Stream = globalThis.ReadableStream ?? NodeReadableStream
    const stream = new Stream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: message\n' +
              'data: {"event_id":"evt-delta","timestamp":1,"role":"assistant","delta":"hello"}\n\n'
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

    const { result } = renderHook(() =>
      useSSESession({ sessionId, projectId: 'proj-1', onEvent })
    )

    await act(async () => {
      await result.current.sendMessage({
        message: 'hi',
        surface: 'welcome',
      })
    })

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'message' }),
      expect.objectContaining({ sessionId })
    )
    expect(useChatSessionStore.getState().getLastEventId(sessionId)).toBe('evt-0')
  })

  it('does not update Last-Event-ID for reasoning delta events', async () => {
    const sessionId = 'sess-3'
    const onEvent = jest.fn()
    useChatSessionStore.getState().setLastEventId(sessionId, 'evt-0')

    const encoder = new TextEncoder()
    const Stream = globalThis.ReadableStream ?? NodeReadableStream
    const stream = new Stream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: reasoning\n' +
              'data: {"event_id":"evt-reason","timestamp":1,"reasoning_id":"r-1","status":"in_progress","delta":"thinking"}\n\n'
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

    const { result } = renderHook(() =>
      useSSESession({ sessionId, projectId: 'proj-1', onEvent })
    )

    await act(async () => {
      await result.current.sendMessage({
        message: 'hi',
        surface: 'welcome',
      })
    })

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'reasoning' }),
      expect.objectContaining({ sessionId })
    )
    expect(useChatSessionStore.getState().getLastEventId(sessionId)).toBe('evt-0')
  })

  it('stops dispatching events after abort', async () => {
    const sessionId = 'sess-4'
    const onEvent = jest.fn()

    const encoder = new TextEncoder()
    const Stream = globalThis.ReadableStream ?? NodeReadableStream
    let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null
    let aborted = false

    const stream = new Stream({
      start(controller) {
        controllerRef = controller
        controller.enqueue(
          encoder.encode(
            'event: message\n' +
              'data: {"event_id":"evt-1","timestamp":1,"role":"assistant","delta":"hello"}\n\n'
          )
        )
        if (aborted) {
          controller.error(new DOMException('Aborted', 'AbortError'))
        }
      },
      cancel() {
        aborted = true
      },
    })

    const fetchMock = jest.fn().mockImplementation((_url, options) => {
      const signal = options?.signal as AbortSignal | undefined
      if (signal) {
        if (signal.aborted) {
          aborted = true
          controllerRef?.error(new DOMException('Aborted', 'AbortError'))
        } else {
          signal.addEventListener('abort', () => {
            aborted = true
            controllerRef?.error(new DOMException('Aborted', 'AbortError'))
          })
        }
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: () => null,
        },
        body: stream,
      })
    })

    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { result } = renderHook(() =>
      useSSESession({ sessionId, projectId: 'proj-1', onEvent })
    )

    act(() => {
      void result.current.sendMessage({
        message: 'hi',
        surface: 'welcome',
      })
    })

    await waitFor(() => expect(onEvent).toHaveBeenCalledTimes(1))
    expect(getCachedSessionEvents(sessionId)?.length).toBe(1)

    let stoppedRunId: number | null = null
    act(() => {
      stoppedRunId = result.current.stop()
    })

    expect(stoppedRunId).toBe(1)

    if (!aborted && controllerRef) {
      const controller = controllerRef as { enqueue: (chunk: Uint8Array) => void }
      controller.enqueue(
        encoder.encode(
          'event: message\n' +
            'data: {"event_id":"evt-1","timestamp":1,"role":"assistant","delta":" world"}\n\n'
        )
      )
    }

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(getCachedSessionEvents(sessionId)?.length).toBe(1)
  })

  it('avoids duplicate stream-only subscriptions while streaming', async () => {
    const sessionId = 'sess-5'
    const onEvent = jest.fn()

    const encoder = new TextEncoder()
    const Stream = globalThis.ReadableStream ?? NodeReadableStream
    const stream = new Stream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: message\n' +
              'data: {"event_id":"evt-1","timestamp":1,"role":"assistant","delta":"hello"}\n\n'
          )
        )
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

    const { result } = renderHook(() =>
      useSSESession({ sessionId, projectId: 'proj-1', onEvent })
    )

    act(() => {
      void result.current.sendMessage({
        message: '',
        surface: 'welcome',
      })
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    act(() => {
      void result.current.sendMessage({
        message: '',
        surface: 'welcome',
      })
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.stop()
    })
  })

  it('allows reconnecting after a closed stream', async () => {
    const sessionId = 'sess-6'
    const onEvent = jest.fn()

    const encoder = new TextEncoder()
    const Stream = globalThis.ReadableStream ?? NodeReadableStream
    const streamFactory = () =>
      new Stream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'event: message\n' +
                'data: {"event_id":"evt-1","timestamp":1,"role":"assistant","content":"hi"}\n\n'
            )
          )
          controller.close()
        },
      })

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: () => null,
        },
        body: streamFactory(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: () => null,
        },
        body: streamFactory(),
      })

    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { result } = renderHook(() =>
      useSSESession({ sessionId, projectId: 'proj-1', onEvent })
    )

    await act(async () => {
      await result.current.sendMessage({
        message: '',
        surface: 'welcome',
      })
    })

    await act(async () => {
      await result.current.sendMessage({
        message: '',
        surface: 'welcome',
        replayFromLastEvent: true,
      })
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('allows starting a new stream after stop', async () => {
    const sessionId = 'sess-7'
    const onEvent = jest.fn()

    const encoder = new TextEncoder()
    const Stream = globalThis.ReadableStream ?? NodeReadableStream
    const streamFactory = () =>
      new Stream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'event: message\n' +
                'data: {"event_id":"evt-1","timestamp":1,"role":"assistant","delta":"hello"}\n\n'
            )
          )
        },
      })

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: () => null,
        },
        body: streamFactory(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: () => null,
        },
        body: streamFactory(),
      })

    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { result } = renderHook(() =>
      useSSESession({ sessionId, projectId: 'proj-1', onEvent })
    )

    act(() => {
      void result.current.sendMessage({
        message: '',
        surface: 'welcome',
      })
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    act(() => {
      result.current.stop()
    })

    await new Promise((resolve) => setTimeout(resolve, 0))

    act(() => {
      void result.current.sendMessage({
        message: '',
        surface: 'welcome',
        replayFromLastEvent: true,
      })
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('auto-stops an unobserved stream on unmount when requested', async () => {
    const sessionId = 'sess-8'
    const onEvent = jest.fn()

    const encoder = new TextEncoder()
    const Stream = globalThis.ReadableStream ?? NodeReadableStream
    let cancelCount = 0

    const stream = new Stream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: message\n' +
              'data: {"event_id":"evt-1","timestamp":1,"role":"assistant","delta":"hello"}\n\n'
          )
        )
      },
      cancel() {
        cancelCount += 1
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

    const { result, unmount } = renderHook(() =>
      useSSESession({
        sessionId,
        projectId: 'proj-1',
        onEvent,
        autoStopWhenUnobserved: true,
      })
    )

    act(() => {
      void result.current.sendMessage({
        message: '',
        surface: 'welcome',
      })
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    unmount()

    await waitFor(() => expect(cancelCount).toBeGreaterThan(0))
  })
})
