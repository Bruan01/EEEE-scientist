declare module 'qrcode' {
  export function toString(
    text: string,
    options?: {
      type?: string
      small?: boolean
      errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
      margin?: number
    }
  ): Promise<string>
}
