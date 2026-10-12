export type LabFocusPayload = {
  projectId?: string | null
  focusType:
    | 'agent'
    | 'quest'
    | 'quest-branch'
    | 'quest-event'
    | 'overview'
    | 'canvas'
    | 'terminal'
  focusId?: string | null
  branch?: string | null
  eventId?: string | null
}

export const LAB_FOCUS_EVENT = 'ds:lab:focus'

export const dispatchLabFocus = (payload: LabFocusPayload) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(LAB_FOCUS_EVENT, { detail: payload }))
}
