import * as React from 'react'
import {
  getDynamicImportRecoveryMessage,
  isDynamicImportRecoveryError,
  wrapRecoverableImport,
} from '@/lib/utils/dynamic-import-recovery'

type DynamicOptions = {
  ssr?: boolean
  loading?: React.ComponentType | (() => React.ReactNode)
  recoveryKey?: string
}

type DynamicBoundaryProps = {
  children: React.ReactNode
}

type DynamicBoundaryState = {
  error: Error | null
}

class DynamicBoundary extends React.Component<DynamicBoundaryProps, DynamicBoundaryState> {
  constructor(props: DynamicBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): DynamicBoundaryState {
    return { error }
  }

  render() {
    if (this.state.error) {
      const message = isDynamicImportRecoveryError(this.state.error)
        ? getDynamicImportRecoveryMessage(this.state.error)
        : getDynamicImportRecoveryMessage()
      return (
        <div className="flex h-full min-h-[96px] items-center justify-center px-4 py-6 text-center text-sm text-black/55">
          {message}
        </div>
      )
    }
    return this.props.children
  }
}

export default function dynamic<T extends React.ComponentType<any>>(
  loader: () => Promise<{ default: T } | T>,
  options?: DynamicOptions
) {
  const LazyComponent = React.lazy(
    wrapRecoverableImport(async () => {
      const resolved = await loader()
      if (resolved && typeof resolved === 'object' && 'default' in resolved) {
        return resolved as { default: T }
      }
      return { default: resolved as T }
    }, options?.recoveryKey ?? 'dynamic-component')
  )

  const Loading = options?.loading

  return function DynamicComponent(props: React.ComponentProps<T>) {
    return (
      <DynamicBoundary>
        <React.Suspense fallback={Loading ? (typeof Loading === 'function' ? <>{Loading()}</> : <Loading />) : null}>
          <LazyComponent {...props} />
        </React.Suspense>
      </DynamicBoundary>
    )
  }
}
