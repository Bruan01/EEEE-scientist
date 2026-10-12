import { useInput, useStdin } from 'ink'

type InputHandler = Parameters<typeof useInput>[0]
type InputOptions = NonNullable<Parameters<typeof useInput>[1]>

export function useSafeInput(handler: InputHandler, options?: InputOptions): boolean {
  const { isRawModeSupported } = useStdin()
  const isActive = Boolean(isRawModeSupported) && (options?.isActive ?? true)
  useInput(handler, {
    ...options,
    isActive,
  })
  return Boolean(isRawModeSupported)
}
