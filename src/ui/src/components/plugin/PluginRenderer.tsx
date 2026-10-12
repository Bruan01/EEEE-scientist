"use client";

/**
 * PluginRenderer Component
 *
 * Renders a plugin component based on pluginId.
 * Uses the PluginRegistry for builtin plugins and PluginResolver for external plugins.
 * Supports lazy loading with Suspense for code splitting.
 *
 * @module components/plugin/PluginRenderer
 */

import {
  Component,
  type ErrorInfo,
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useCallback,
  useState,
} from "react";
import { usePluginResolver } from "@/lib/contexts/PluginResolverContext";
import { useTabsStore } from "@/lib/stores/tabs";
import { builtinPluginLoader } from "@/lib/plugin/builtin-loader";
import { pluginRegistry } from "@/lib/plugin/registry";
import {
  pluginLifecycleManager,
  generateInstanceId,
} from "@/lib/plugin/lifecycle";
import { PluginNotFound } from "./PluginNotFound";
import { PluginError } from "./PluginError";
import type { TabContext, PluginComponentProps } from "@/lib/types/tab";
import type { PluginContext } from "@/lib/types/plugin";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getDynamicImportRecoveryMessage,
  isDynamicImportRecoveryError,
} from "@/lib/utils/dynamic-import-recovery";

// ============================================================
// Types
// ============================================================

/**
 * PluginRenderer Props
 */
export interface PluginRendererProps {
  /** Plugin ID to render */
  pluginId: string;

  /** Context data for the plugin */
  context: TabContext;

  /** Tab ID */
  tabId: string;

  /** Project ID (optional) */
  projectId?: string;

  /** Custom loading component */
  loadingComponent?: ReactNode;

  /** Custom error component */
  errorComponent?: ReactNode;

  /** Called when plugin loads successfully */
  onLoad?: () => void;

  /** Called when plugin encounters an error */
  onError?: (error: Error) => void;
}

/**
 * Error Boundary State
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Props
 */
interface ErrorBoundaryProps {
  pluginId: string;
  children: ReactNode;
  onReset?: () => void;
  onError?: (error: Error) => void;
  customErrorComponent?: ReactNode;
}

// ============================================================
// Loading Component
// ============================================================

/**
 * Default loading skeleton for lazy-loaded plugins
 */
function PluginLoadingSkeleton({ pluginId }: { pluginId: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center h-full",
        "bg-soft-bg-base text-soft-text-secondary"
      )}
    >
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-soft-accent" />
        <div className="text-sm text-soft-text-secondary">
          Loading plugin...
        </div>
        <div className="text-xs text-soft-text-secondary/60 font-mono">
          {pluginId}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Error Boundary
// ============================================================

/**
 * Plugin Error Boundary
 *
 * Catches errors in plugin components and displays a friendly error message.
 * Supports custom error components and error callbacks.
 */
class PluginErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (isDynamicImportRecoveryError(error)) {
      console.warn("[PluginRenderer] Recovering stale plugin bundle:", error);
    } else {
      console.error("[PluginRenderer] Plugin error:", error, errorInfo);
    }

    // Notify parent component
    this.props.onError?.(error);

    // Update lifecycle manager
    const instanceId = `${this.props.pluginId}:default`;
    pluginLifecycleManager.setError(instanceId, error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.state.error && isDynamicImportRecoveryError(this.state.error)) {
        return (
          <div
            className={cn(
              "flex h-full items-center justify-center px-6 text-center",
              "bg-soft-bg-base text-soft-text-secondary"
            )}
          >
            <div className="max-w-sm text-sm">
              {getDynamicImportRecoveryMessage(this.state.error)}
            </div>
          </div>
        );
      }

      // Use custom error component if provided
      if (this.props.customErrorComponent) {
        return this.props.customErrorComponent;
      }

      return (
        <PluginError
          pluginId={this.props.pluginId}
          error={this.state.error}
          onRetry={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================================
// Plugin Content Component
// ============================================================

/**
 * Internal component that renders the actual plugin content
 */
function PluginContent({
  pluginId,
  context,
  tabId,
  projectId,
  onLoad,
}: {
  pluginId: string;
  context: TabContext;
  tabId: string;
  projectId?: string;
  onLoad?: () => void;
}) {
  const resolver = usePluginResolver();
  const { setTabDirty, updateTab } = useTabsStore();
  const [isReady, setIsReady] = useState(false);

  // Convert TabContext to PluginContext
  const pluginContext: PluginContext = useMemo(
    () => ({
      type: context.type,
      resourceId: context.resourceId,
      resourceName: context.resourceName,
      resourcePath: context.resourcePath,
      mimeType: context.mimeType,
    }),
    [context]
  );

  // Generate instance ID for lifecycle tracking
  const instanceId = useMemo(
    () => generateInstanceId(pluginId, pluginContext),
    [pluginId, pluginContext]
  );

  // Create callbacks for plugin to update tab state
  const setDirty = useCallback(
    (isDirty: boolean) => {
      setTabDirty(tabId, isDirty);
    },
    [tabId, setTabDirty]
  );

  const setTitle = useCallback(
    (title: string) => {
      updateTab(tabId, { title });
    },
    [tabId, updateTab]
  );

  // Get the plugin component
  // First try builtin loader for builtin plugins
  const PluginComponent = useMemo(() => {
    // Check if it's a builtin plugin
    if (builtinPluginLoader.isBuiltinPlugin(pluginId)) {
      return builtinPluginLoader.getLazyComponent(pluginId);
    }

    // Fall back to resolver for external plugins
    return resolver.getPluginComponent(pluginId);
  }, [pluginId, resolver]);

  // Track plugin lifecycle
  useEffect(() => {
    // Set loading state
    pluginLifecycleManager.setState(instanceId, "loading");

    // Plugin activated
    console.debug(
      `[PluginRenderer] Plugin ${pluginId} activating for tab ${tabId}`
    );

    // Mark as initializing then active after a short delay
    // (actual initialization happens in Suspense)
    const timeoutId = setTimeout(() => {
      pluginLifecycleManager.setState(instanceId, "initializing");
      pluginLifecycleManager.setState(instanceId, "active");
      setIsReady(true);
      onLoad?.();
      console.debug(
        `[PluginRenderer] Plugin ${pluginId} activated for tab ${tabId}`
      );
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      // Plugin deactivated
      console.debug(
        `[PluginRenderer] Plugin ${pluginId} deactivating for tab ${tabId}`
      );
      pluginLifecycleManager.setState(instanceId, "destroying");
      pluginLifecycleManager.setState(instanceId, "unloaded");
    };
  }, [pluginId, tabId, instanceId, onLoad]);

  // Plugin not found
  if (!PluginComponent) {
    return <PluginNotFound pluginId={pluginId} context={context} />;
  }

  // Render the plugin component
  return (
    <PluginComponent
      context={context}
      tabId={tabId}
      setDirty={setDirty}
      setTitle={setTitle}
    />
  );
}

// ============================================================
// Main PluginRenderer Component
// ============================================================

/**
 * PluginRenderer Component
 *
 * Resolves and renders a plugin component based on pluginId.
 * Features:
 * - Lazy loading with Suspense for builtin plugins
 * - Error boundary for graceful error handling
 * - Lifecycle management integration
 * - Custom loading and error components
 *
 * @example
 * ```tsx
 * <PluginRenderer
 *   pluginId="@ds/plugin-pdf-viewer"
 *   context={{ type: 'file', resourceId: '123', resourceName: 'document.pdf' }}
 *   tabId="tab-1"
 * />
 * ```
 *
 * @example with custom loading
 * ```tsx
 * <PluginRenderer
 *   pluginId="@ds/plugin-notebook"
 *   context={{ type: 'notebook', resourceId: '456' }}
 *   tabId="tab-2"
 *   loadingComponent={<MyCustomLoader />}
 *   onLoad={() => console.log('Plugin loaded!')}
 *   onError={(error) => console.error('Plugin error:', error)}
 * />
 * ```
 */
export function PluginRenderer({
  pluginId,
  context,
  tabId,
  projectId,
  loadingComponent,
  errorComponent,
  onLoad,
  onError,
}: PluginRendererProps) {
  // Reset key for error recovery
  const [resetKey, setResetKey] = useState(0);

  const handleReset = useCallback(() => {
    setResetKey((prev) => prev + 1);
  }, []);

  // Determine loading fallback
  const loadingFallback = loadingComponent ?? (
    <PluginLoadingSkeleton pluginId={pluginId} />
  );

  return (
    <PluginErrorBoundary
      key={resetKey}
      pluginId={pluginId}
      onReset={handleReset}
      onError={onError}
      customErrorComponent={errorComponent}
    >
      <Suspense fallback={loadingFallback}>
        <PluginContent
          pluginId={pluginId}
          context={context}
          tabId={tabId}
          projectId={projectId}
          onLoad={onLoad}
        />
      </Suspense>
    </PluginErrorBoundary>
  );
}

export default PluginRenderer;
