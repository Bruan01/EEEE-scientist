"use client";

/**
 * Plugin Resolver Context
 *
 * Provides dependency injection for plugin resolution.
 * Tab system uses this context to get plugin components without
 * direct dependency on PluginRegistry.
 *
 * @module contexts/PluginResolverContext
 */

import { createContext, useContext, type ReactNode } from "react";
import type { IPluginResolver } from "@/lib/types/plugin-resolver";

/**
 * Default resolver that returns null for everything
 *
 * This is used when no resolver is provided.
 * In production, PluginResolverStub or PluginRegistry should be injected.
 */
const defaultResolver: IPluginResolver = {
  getPluginComponent: () => null,
  getDefaultPluginForMimeType: () => null,
  isPluginRegistered: () => false,
};

/**
 * Plugin Resolver Context
 *
 * Initialized with default resolver to prevent runtime errors
 */
const PluginResolverContext = createContext<IPluginResolver>(defaultResolver);

/**
 * Plugin Resolver Provider Props
 */
interface PluginResolverProviderProps {
  /** Plugin resolver implementation */
  resolver: IPluginResolver;
  /** Child components */
  children: ReactNode;
}

/**
 * Plugin Resolver Provider
 *
 * Wraps the application to provide plugin resolution capabilities.
 *
 * @example
 * ```tsx
 * // In Phase 02, use PluginResolverStub
 * import { PluginResolverStub } from '@/lib/plugin-resolver-stub';
 *
 * const resolver = new PluginResolverStub();
 *
 * <PluginResolverProvider resolver={resolver}>
 *   <WorkspaceLayout />
 * </PluginResolverProvider>
 *
 * // In Phase 03+, use PluginRegistry
 * import { pluginRegistry } from '@/lib/plugin/registry';
 *
 * <PluginResolverProvider resolver={pluginRegistry}>
 *   <WorkspaceLayout />
 * </PluginResolverProvider>
 * ```
 */
export function PluginResolverProvider({
  resolver,
  children,
}: PluginResolverProviderProps) {
  return (
    <PluginResolverContext.Provider value={resolver}>
      {children}
    </PluginResolverContext.Provider>
  );
}

/**
 * Hook to access the plugin resolver
 *
 * Tab system and other components use this hook to resolve plugins.
 *
 * @returns Plugin resolver instance
 *
 * @example
 * ```tsx
 * function PluginRenderer({ pluginId, context, tabId }) {
 *   const resolver = usePluginResolver();
 *   const Component = resolver.getPluginComponent(pluginId);
 *
 *   if (!Component) {
 *     return <PluginNotFound pluginId={pluginId} />;
 *   }
 *
 *   return <Component context={context} tabId={tabId} />;
 * }
 * ```
 */
export function usePluginResolver(): IPluginResolver {
  const resolver = useContext(PluginResolverContext);
  return resolver;
}

/**
 * Hook to check if plugin resolver is available
 *
 * @returns true if a resolver is provided (not default)
 */
export function useHasPluginResolver(): boolean {
  const resolver = useContext(PluginResolverContext);
  return resolver !== defaultResolver;
}

export { PluginResolverContext };
