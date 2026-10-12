/**
 * Copy text to clipboard with fallback for HTTP environments
 * @param text - The text to copy
 * @returns Promise<boolean> - Whether the copy was successful
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Prefer modern Clipboard API in secure context (HTTPS)
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        // Fall through to execCommand fallback (some browsers/contexts deny clipboard even on HTTPS)
      }
    }

    // Fallback: use legacy execCommand for HTTP environments
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    // If we're inside a Radix Dialog (focus-trapped), append within the dialog so focus/select works.
    const active = document.activeElement
    const dialogRoot =
      active instanceof HTMLElement ? active.closest('[role="dialog"]') : null
    const mountPoint = (dialogRoot ?? document.body) as HTMLElement
    mountPoint.appendChild(textArea)
    textArea.focus()
    textArea.select()

    const success = document.execCommand('copy')
    textArea.remove()
    return success
  } catch (err) {
    console.error('Failed to copy to clipboard:', err)
    return false
  }
}
