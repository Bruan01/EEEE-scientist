import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'

import App from '@/App'
import { ToastProvider } from '@/components/ui/toast'
import { initializeBuiltinPlugins, scheduleCommonPluginPreload } from '@/lib/plugin/init'
import { installAdminFrontendLogCapture } from '@/lib/adminFrontendLogs'
import { useInterfacePreferencesStore } from '@/lib/stores/interface-preferences'
import { useThemeStore } from '@/lib/stores/theme'
import '@/index.css'

useThemeStore.getState().initTheme()
useInterfacePreferencesStore.getState().initInterfacePreferences()
initializeBuiltinPlugins()
installAdminFrontendLogCapture()
if (typeof window !== 'undefined') {
  queueMicrotask(() => {
    scheduleCommonPluginPreload()
  })
}

function Providers({ children }: { children: React.ReactNode }) {
  const compactMode = useInterfacePreferencesStore((state) => state.compactMode)
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion={compactMode ? 'always' : 'never'} skipAnimations={compactMode}>
        <ToastProvider>{children}</ToastProvider>
      </MotionConfig>
    </QueryClientProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>
)
