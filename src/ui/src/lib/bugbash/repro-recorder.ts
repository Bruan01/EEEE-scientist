import { redactSensitive, sanitizeUrl, truncateText } from '@/lib/bugbash/sanitize'

export type ReproEvent =
  | {
      type: 'click'
      ts: number
      target: {
        tag: string
        id?: string
        role?: string
        label?: string
        testId?: string
        tooltip?: string
        name?: string
        href?: string
        path?: string
      }
    }
  | {
      type: 'route'
      ts: number
      from: string
      to: string
    }
  | {
      type: 'request'
      ts: number
      method: string
      url: string
      status?: number
      duration_ms?: number
      error?: string
    }

const EVENTS_KEY = 'ds:bugbash:repro-events'
const ENABLED_KEY = 'ds:bugbash:repro-enabled'
const MAX_EVENTS = 400
const MAX_LABEL_LENGTH = 120
const isDev = process.env.NODE_ENV !== 'production'

let enabled = false
let events: ReproEvent[] = []
let initialized = false
let clickListener: ((event: MouseEvent) => void) | null = null

const loadState = () => {
  if (typeof window === 'undefined') return
  try {
    const stored = window.localStorage.getItem(ENABLED_KEY)
    enabled = stored === '1'
  } catch {
    enabled = false
  }
  try {
    const storedEvents = window.localStorage.getItem(EVENTS_KEY)
    if (storedEvents) {
      const parsed = JSON.parse(storedEvents)
      if (Array.isArray(parsed)) {
        events = parsed.slice(-MAX_EVENTS)
      }
    }
  } catch {
    events = []
  }
}

const persistEvents = () => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(-MAX_EVENTS)))
  } catch {
    // ignore storage issues
  }
}

const persistEnabled = () => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0')
  } catch {
    // ignore storage issues
  }
}

const clampLabel = (value?: string | null) => {
  if (!value) return undefined
  return truncateText(redactSensitive(value), MAX_LABEL_LENGTH)
}

const buildElementPath = (element: Element) => {
  const parts: string[] = []
  let current: Element | null = element
  while (current && parts.length < 4) {
    const tag = current.tagName.toLowerCase()
    const id = current.id ? `#${current.id}` : ''
    const testId = current.getAttribute('data-testid')
    const label = current.getAttribute('aria-label')
    const suffix = testId ? `[data-testid=${testId}]` : label ? `[aria-label]` : ''
    parts.unshift(`${tag}${id}${suffix}`)
    current = current.parentElement
  }
  return parts.join('>')
}

const resolveTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return null
  const interactive = target.closest(
    'button,a,[role="button"],[role="menuitem"],input,textarea,select'
  )
  if (!interactive) return null
  const href =
    interactive instanceof HTMLAnchorElement && interactive.href
      ? sanitizeUrl(interactive.href)
      : undefined
  return {
    tag: interactive.tagName.toLowerCase(),
    id: interactive.id || undefined,
    role: interactive.getAttribute('role') || undefined,
    label: clampLabel(interactive.getAttribute('aria-label')),
    testId: clampLabel(interactive.getAttribute('data-testid')),
    tooltip: clampLabel(interactive.getAttribute('data-tooltip')),
    name: clampLabel(interactive.getAttribute('name')),
    href,
    path: buildElementPath(interactive),
  }
}

const handleClick = (event: MouseEvent) => {
  if (!enabled) return
  const target = resolveTarget(event.target)
  if (!target) return
  recordReproEvent({ type: 'click', ts: Date.now(), target })
}

const attachListeners = () => {
  if (typeof window === 'undefined' || clickListener) return
  clickListener = handleClick
  window.addEventListener('click', clickListener, true)
}

const detachListeners = () => {
  if (typeof window === 'undefined' || !clickListener) return
  window.removeEventListener('click', clickListener, true)
  clickListener = null
}

export function initReproRecorder() {
  if (!isDev || initialized) return
  initialized = true
  loadState()
  if (enabled) attachListeners()
  if (typeof window !== 'undefined') {
    ;(window as Window & { __DS_REPRO__?: unknown }).__DS_REPRO__ = {
      isEnabled: () => enabled,
      setEnabled: (next: boolean) => setReproEnabled(next),
      getEvents: () => [...events],
      clear: () => clearReproEvents(),
    }
  }
}

export function isReproSupported() {
  return isDev
}

export function isReproEnabled() {
  return enabled
}

export function setReproEnabled(next: boolean) {
  if (!isDev) return
  enabled = next
  persistEnabled()
  if (enabled) {
    attachListeners()
    return
  }
  detachListeners()
}

export function recordReproEvent(event: ReproEvent) {
  if (!isDev || !enabled) return
  events.push(event)
  if (events.length > MAX_EVENTS) {
    events = events.slice(-MAX_EVENTS)
  }
  persistEvents()
}

export function recordRouteChange(from: string | null, to: string) {
  recordReproEvent({
    type: 'route',
    ts: Date.now(),
    from: from || 'initial',
    to,
  })
}

export function recordRequestEvent(
  payload: Omit<Extract<ReproEvent, { type: 'request' }>, 'type' | 'ts'>
) {
  recordReproEvent({
    type: 'request',
    ts: Date.now(),
    ...payload,
  })
}

export function getReproEvents() {
  return [...events]
}

export function clearReproEvents() {
  events = []
  persistEvents()
}
