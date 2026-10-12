import { act, renderHook, waitFor } from '@testing-library/react'
import { ReadableStream as NodeReadableStream } from 'stream/web'
import { useBashLogStream } from '@/lib/hooks/useBashLogStream'

jest.mock('@/lib/api/client', () => ({
  getApiBaseUrl: () => 'http://example.com',
}))

jest.mock('@/lib/api/auth', () => ({
  refreshAccessToken: jest.fn(async () => false),
}))

const buildStream = (chunks: string[]) => {
  const encoder = new TextEncoder()
  const Stream = globalThis.ReadableStream ?? NodeReadableStream
  return new Stream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)))
      controller.close()
    },
  })
}

describe('useBashLogStream', () => {
  beforeEach(() => {
    window.localStorage.setItem('ds_access_token', 'token-123')
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
    window.localStorage.clear()
  })

  it('reconnects after unexpected EOF', async () => {
    jest.useFakeTimers()
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: buildStream([
          'event: snapshot\n' +
            'data: {"bash_id":"bash-1","latest_seq":1,"lines":[]}\n\n',
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: buildStream([
          'event: snapshot\n' +
            'data: {"bash_id":"bash-1","latest_seq":1,"lines":[]}\n\n',
        ]),
      })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { result, unmount } = renderHook(() =>
      useBashLogStream({ projectId: 'project-1', bashId: 'bash-1', enabled: true })
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(result.current.status).toBe('reconnecting')
    })

    await act(async () => {
      jest.advanceTimersByTime(2100)
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    unmount()
  })

  it('streams log events and stops reconnecting after done', async () => {
    jest.useFakeTimers()
    const onLog = jest.fn()
    const onDone = jest.fn()
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: buildStream([
        'event: log\n' +
          'id: 2\n' +
          'data: {"bash_id":"bash-1","seq":2,"stream":"stdout","line":"hello","timestamp":"2026-01-01T00:00:00Z"}\n\n',
        'event: done\n' +
          'data: {"bash_id":"bash-1","status":"completed","exit_code":0,"finished_at":"2026-01-01T00:00:01Z"}\n\n',
      ]),
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { result, unmount } = renderHook(() =>
      useBashLogStream({
        projectId: 'project-1',
        bashId: 'bash-1',
        enabled: true,
        onLog,
        onDone,
      })
    )

    await waitFor(() => {
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({
          bash_id: 'bash-1',
          seq: 2,
          line: 'hello',
        })
      )
    })

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({
          bash_id: 'bash-1',
          status: 'completed',
        })
      )
      expect(result.current.status).toBe('closed')
    })

    await act(async () => {
      jest.advanceTimersByTime(3000)
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)

    unmount()
  })
})
