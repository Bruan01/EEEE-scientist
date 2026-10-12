import { act, renderHook, waitFor } from '@testing-library/react'
import { ReadableStream as NodeReadableStream } from 'stream/web'
import { useBashSessionStream } from '@/lib/hooks/useBashSessionStream'
import { listBashSessions } from '@/lib/api/bash'

jest.mock('@/lib/api/client', () => ({
  getApiBaseUrl: () => 'http://example.com',
}))

jest.mock('@/lib/api/auth', () => ({
  refreshAccessToken: jest.fn(async () => false),
}))

jest.mock('@/lib/api/bash', () => ({
  listBashSessions: jest.fn(async () => []),
}))

const buildSnapshotStream = () => {
  const encoder = new TextEncoder()
  const Stream = globalThis.ReadableStream ?? NodeReadableStream
  return new Stream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          'event: snapshot\n' +
            'data: {"sessions":[{"bash_id":"bash-1","started_at":"2026-01-01T00:00:00Z","status":"running"}]}\n\n'
        )
      )
      controller.close()
    },
  })
}

describe('useBashSessionStream', () => {
  beforeEach(() => {
    window.localStorage.setItem('ds_access_token', 'token-123')
    ;(listBashSessions as jest.Mock).mockClear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
    window.localStorage.clear()
  })

  it('reconnects after stream EOF', async () => {
    jest.useFakeTimers()
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: buildSnapshotStream(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: buildSnapshotStream(),
      })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { result, unmount } = renderHook(() =>
      useBashSessionStream({ projectId: 'project-1', enabled: true, stream: true })
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(result.current.sessions.length).toBe(1)
      expect(result.current.connection.status).toBe('reconnecting')
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

  it('falls back to reload when stream fails without snapshot', async () => {
    jest.useFakeTimers()
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: buildSnapshotStream(),
      })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { unmount } = renderHook(() =>
      useBashSessionStream({ projectId: 'project-1', enabled: true, stream: true })
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(listBashSessions).toHaveBeenCalledTimes(1)
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
})
