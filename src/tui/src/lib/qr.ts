export async function renderQrAscii(content: string): Promise<string> {
  const normalized = String(content || '').trim()
  if (!normalized) {
    return ''
  }
  const qrModule = (await import('qrcode')) as {
    toString: (
      text: string,
      options?: {
        type?: string
        small?: boolean
        errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
        margin?: number
      }
    ) => Promise<string>
  }
  try {
    return await qrModule.toString(normalized, {
      type: 'utf8',
      errorCorrectionLevel: 'M',
      margin: 0,
    })
  } catch {
    return qrModule.toString(normalized, {
      type: 'utf8',
      errorCorrectionLevel: 'M',
      margin: 2,
    })
  }
}
