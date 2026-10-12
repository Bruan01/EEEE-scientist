import { toast } from '@/components/ui/toast'
import { recordRequestEvent } from '@/lib/bugbash/repro-recorder'
import { redactSensitive, sanitizeUrl, truncateText } from '@/lib/bugbash/sanitize'
import { resolveApiBaseUrl } from '@/lib/api/client'

const DEFAULT_TIMEOUT_MS = 90000
const DEFAULT_RETRY_DELAY_MS = 800
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])

export type RequestOptions = {
  timeoutMs?: number
  retries?: number
  retryDelayMs?: number
  retryOnStatus?: (status: number) => boolean
  retryOnError?: (error: unknown, timeoutTriggered: boolean) => boolean
  toastOnError?: boolean
  errorTitle?: string
  signal?: AbortSignal
}

export type StreamRequestResult = {
  response: Response
  cleanup: () => void
}

export class RequestError extends Error {
  status?: number
  url?: string
  code?: 'timeout' | 'network' | 'http'

  constructor(
    message: string,
    options?: { status?: number; url?: string; code?: 'timeout' | 'network' | 'http' }
  ) {
    super(message)
    this.name = 'RequestError'
    this.status = options?.status
    this.url = options?.url
    this.code = options?.code
  }
}

type AttemptResult = {
  response?: Response
  error?: unknown
  cleanup: () => void
  timeoutTriggered: boolean
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const defaultRetryOnStatus = (status: number) => RETRYABLE_STATUS.has(status)

const defaultRetryOnError = (error: unknown, timeoutTriggered: boolean) => {
  if (timeoutTriggered) return true
  if (error instanceof Error && error.name === 'AbortError') return false
  if (error instanceof RequestError) return error.code === 'network'
  return true
}

const createTimeoutSignal = (timeoutMs: number, signal?: AbortSignal) => {
  const controller = new AbortController()
  let timeoutTriggered = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const onAbort = () => {
    controller.abort()
  }

  if (signal) {
    if (signal.aborted) {
      controller.abort()
    } else {
      signal.addEventListener('abort', onAbort)
    }
  }

  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      timeoutTriggered = true
      controller.abort()
    }, timeoutMs)
  }

  const clearTimeoutHandle = () => {
    if (timeoutId) {
      globalThis.clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  const cleanup = () => {
    clearTimeoutHandle()
    if (signal) {
      signal.removeEventListener('abort', onAbort)
    }
  }

  return { signal: controller.signal, clearTimeout: clearTimeoutHandle, cleanup, timeoutTriggered: () => timeoutTriggered }
}

const attemptFetch = async (
  url: string,
  init: RequestInit,
  options: { timeoutMs: number; signal?: AbortSignal }
): Promise<AttemptResult> => {
  const handle = createTimeoutSignal(options.timeoutMs, options.signal)
  try {
    const response = await fetch(url, { ...init, signal: handle.signal })
    handle.clearTimeout()
    return { response, cleanup: handle.cleanup, timeoutTriggered: handle.timeoutTriggered() }
  } catch (error) {
    handle.clearTimeout()
    return { error, cleanup: handle.cleanup, timeoutTriggered: handle.timeoutTriggered() }
  }
}

const toRequestError = (error: unknown, info: { url: string; timeoutTriggered: boolean }) => {
  if (error instanceof RequestError) return error
  if (error instanceof Error && error.name === 'AbortError' && info.timeoutTriggered) {
    return new RequestError('Request timed out.', { url: info.url, code: 'timeout' })
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return error
  }
  const message = error instanceof Error ? error.message : 'Network error.'
  return new RequestError(message || 'Network error.', { url: info.url, code: 'network' })
}

const shouldRetry = (
  status: number | null,
  error: unknown,
  options: {
    attempt: number
    retries: number
    retryOnStatus: (status: number) => boolean
    retryOnError: (error: unknown, timeoutTriggered: boolean) => boolean
    timeoutTriggered: boolean
  }
) => {
  if (options.attempt >= options.retries) return false
  if (status !== null) return options.retryOnStatus(status)
  return options.retryOnError(error, options.timeoutTriggered)
}

const buildRetryDelay = (base: number, attempt: number) => base * Math.pow(2, attempt)

const buildRequestDetails = (error: RequestError | Error, url?: string, method?: string) => {
  const parts = []
  if (method) {
    parts.push(`Method: ${method}`)
  }
  if (url) {
    parts.push(`URL: ${sanitizeUrl(url)}`)
  }
  if (error instanceof RequestError) {
    if (error.status) {
      parts.push(`Status: ${error.status}`)
    }
    if (error.code) {
      parts.push(`Code: ${error.code}`)
    }
  }
  if (error.message) {
    parts.push(`Message: ${redactSensitive(error.message)}`)
  }
  return parts.length ? truncateText(parts.join('\n'), 2000) : undefined
}

const showRequestToast = (
  error: RequestError | Error,
  options?: { title?: string; url?: string; retry?: () => void; method?: string }
) => {
  if (error instanceof Error && error.name === 'AbortError') return
  const details = buildRequestDetails(error, options?.url, options?.method)
  const action = options?.retry
    ? {
        label: 'Retry',
        onClick: options.retry,
      }
    : undefined
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  const isTimeout = error instanceof RequestError && error.code === 'timeout'
  const isNetwork = error instanceof RequestError && error.code === 'network'
  const isServerError =
    error instanceof RequestError &&
    typeof error.status === 'number' &&
    error.status >= 500
  if (isTimeout || isNetwork || isServerError) {
    const title = options?.title || (isTimeout ? 'Request timed out' : isServerError ? 'Server error' : 'Network error')
    const description = isTimeout
      ? 'The request took too long to respond.'
      : offline
        ? 'You are offline. Reconnect and try again.'
        : isServerError
          ? 'The server returned an error response.'
          : redactSensitive(error.message || 'Unable to reach the server.')
    toast({
      type: isTimeout ? 'warning' : 'error',
      title,
      description,
      details,
      action,
    })
    return
  }
  const description = error instanceof Error ? error.message : 'Request failed.'
  toast({
    type: 'error',
    title: options?.title || 'Request failed',
    description: redactSensitive(description),
    details,
    action,
  })
}

const readJsonSafely = async (response: Response): Promise<unknown> => {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const extractErrorMessage = (payload: unknown): string | null => {
  if (!payload) return null
  if (typeof payload === 'string') return payload
  if (typeof payload !== 'object') return null
  const record = payload as Record<string, unknown>
  const detail = record.detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object') {
    const detailMessage = (detail as { message?: string }).message
    if (typeof detailMessage === 'string') return detailMessage
  }
  const message = record.message
  if (typeof message === 'string') return message
  const error = record.error
  if (typeof error === 'string') return error
  return null
}

export const getResponseErrorMessage = async (response: Response): Promise<string> => {
  const payload = await readJsonSafely(response)
  return extractErrorMessage(payload) || response.statusText || `HTTP ${response.status}`
}

const fetchWithRetry = async (
  url: string,
  init: RequestInit,
  options: RequestOptions
): Promise<{ response: Response; cleanup: () => void }> => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const retries = options.retries ?? 0
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  const retryOnStatus = options.retryOnStatus ?? defaultRetryOnStatus
  const retryOnError = options.retryOnError ?? defaultRetryOnError
  let attempt = 0

  while (true) {
    const result = await attemptFetch(url, init, { timeoutMs, signal: options.signal })

    if (result.error) {
      const mappedError = toRequestError(result.error, { url, timeoutTriggered: result.timeoutTriggered })
      const retry = shouldRetry(null, mappedError, {
        attempt,
        retries,
        retryOnStatus,
        retryOnError,
        timeoutTriggered: result.timeoutTriggered,
      })
      if (retry) {
        result.cleanup()
        await sleep(buildRetryDelay(retryDelayMs, attempt))
        attempt += 1
        continue
      }
      result.cleanup()
      throw mappedError
    }

    const response = result.response as Response
    const retry = shouldRetry(response.status, null, {
      attempt,
      retries,
      retryOnStatus,
      retryOnError,
      timeoutTriggered: result.timeoutTriggered,
    })
    if (!response.ok && retry) {
      result.cleanup()
      await sleep(buildRetryDelay(retryDelayMs, attempt))
      attempt += 1
      continue
    }

    return { response, cleanup: result.cleanup }
  }
}

const resolveMethod = (init?: RequestInit) => (init?.method || 'GET').toString().toUpperCase()

export const requestRaw = async (url: string, init: RequestInit, options: RequestOptions = {}) => {
  const method = resolveMethod(init)
  const startedAt = Date.now()
  try {
    const { response, cleanup } = await fetchWithRetry(url, init, options)
    cleanup()
    recordRequestEvent({
      method,
      url: sanitizeUrl(url),
      status: response.status,
      duration_ms: Date.now() - startedAt,
    })
    if (!response.ok && options.toastOnError) {
      const message = response.statusText || `HTTP ${response.status}`
      showRequestToast(new RequestError(message, { status: response.status, url, code: 'http' }), {
        title: options.errorTitle,
        url,
        method,
        retry: () => {
          void requestRaw(url, init, options)
        },
      })
    }
    return response
  } catch (error) {
    recordRequestEvent({
      method,
      url: sanitizeUrl(url),
      status: error instanceof RequestError ? error.status : undefined,
      duration_ms: Date.now() - startedAt,
      error: redactSensitive(error instanceof Error ? error.message : 'request_failed'),
    })
    throw error
  }
}

export const requestJson = async <T>(
  url: string,
  init: RequestInit,
  options: RequestOptions = {}
): Promise<T> => {
  const method = resolveMethod(init)
  const response = await requestRaw(url, init, { ...options, toastOnError: false })
  const payload = await readJsonSafely(response)
  if (!response.ok) {
    const message = extractErrorMessage(payload) || response.statusText || `HTTP ${response.status}`
    const error = new RequestError(message, { status: response.status, url, code: 'http' })
    if (options.toastOnError) {
      showRequestToast(error, {
        title: options.errorTitle,
        url,
        method,
        retry: () => {
          void requestJson(url, init, options)
        },
      })
    }
    throw error
  }
  return payload as T
}

export const requestStream = async (
  url: string,
  init: RequestInit,
  options: RequestOptions = {}
): Promise<StreamRequestResult> => {
  const method = resolveMethod(init)
  const startedAt = Date.now()
  try {
    const { response, cleanup } = await fetchWithRetry(url, init, options)
    recordRequestEvent({
      method,
      url: sanitizeUrl(url),
      status: response.status,
      duration_ms: Date.now() - startedAt,
    })
    return { response, cleanup }
  } catch (error) {
    recordRequestEvent({
      method,
      url: sanitizeUrl(url),
      status: error instanceof RequestError ? error.status : undefined,
      duration_ms: Date.now() - startedAt,
      error: redactSensitive(error instanceof Error ? error.message : 'request_failed'),
    })
    throw error
  }
}

const isAbsoluteUrl = (value: string) =>
  value.startsWith('http://') || value.startsWith('https://') || value.startsWith('//')

const buildApiUrl = (path: string) => {
  if (!path) return resolveApiBaseUrl()
  if (isAbsoluteUrl(path)) {
    if (path.startsWith('//')) {
      if (typeof window !== 'undefined') return `${window.location.protocol}${path}`
      return `http:${path}`
    }
    return path
  }
  const base = resolveApiBaseUrl().replace(/\/$/, '')
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}

export const apiRequestJson = async <T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {}
): Promise<T> => {
  const url = buildApiUrl(path)
  return requestJson<T>(url, init, {
    retries: options.retries ?? 1,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    toastOnError: options.toastOnError ?? true,
    ...options,
  })
}

export const apiRequestStream = async (
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {}
): Promise<StreamRequestResult> => {
  const url = buildApiUrl(path)
  const method = resolveMethod(init)
  const merged: RequestOptions = {
    retries: options.retries ?? 0,
    timeoutMs: options.timeoutMs ?? 0,
    toastOnError: options.toastOnError ?? true,
    ...options,
  }
  const { response, cleanup } = await requestStream(url, init, merged)
  if (!response.ok) {
    const message = await getResponseErrorMessage(response)
    const error = new RequestError(message, { status: response.status, url, code: 'http' })
    cleanup()
    if (merged.toastOnError) {
      showRequestToast(error, { title: merged.errorTitle, url, method })
    }
    throw error
  }
  return { response, cleanup }
}
