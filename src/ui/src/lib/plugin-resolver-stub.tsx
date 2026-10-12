/**
 * Plugin Resolver Stub
 *
 * Temporary implementation of IPluginResolver for Phase 02.
 * Only supports built-in plugins. Will be replaced by PluginRegistry in Phase 03.
 *
 * @module lib/plugin-resolver-stub
 */

import type { ComponentType } from "react";
import type { IPluginResolver, DEFAULT_MIME_PLUGIN_MAP } from "@/lib/types/plugin-resolver";
import type { PluginComponentProps } from "@/lib/types/tab";

// Re-export for convenience
export { DEFAULT_MIME_PLUGIN_MAP } from "@/lib/types/plugin-resolver";

/**
 * Placeholder component for plugins not yet implemented
 *
 * This is returned when a plugin is registered but its component
 * is not yet available.
 */
function PlaceholderPlugin({ context, tabId }: PluginComponentProps) {
  return (
    <div className="flex items-center justify-center h-full bg-muted/30">
      <div className="text-center space-y-2">
        <div className="text-lg font-medium text-muted-foreground">
          Plugin Coming Soon
        </div>
        <div className="text-sm text-muted-foreground">
          Tab ID: {tabId}
        </div>
        {context.resourceName && (
          <div className="text-sm text-muted-foreground">
            Resource: {context.resourceName}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Plugin Resolver Stub
 *
 * Temporary implementation that provides basic plugin resolution.
 * Supports registering placeholder components for built-in plugins.
 *
 * @example
 * ```tsx
 * const resolver = new PluginResolverStub();
 *
 * // Register built-in plugins (when available)
 * resolver.registerPlugin('@ds/plugin-pdf-viewer', PdfViewerPlugin);
 * resolver.registerPlugin('@ds/plugin-notebook', NotebookPlugin);
 *
 * // Use in provider
 * <PluginResolverProvider resolver={resolver}>
 *   <App />
 * </PluginResolverProvider>
 * ```
 */
export class PluginResolverStub implements IPluginResolver {
  /**
   * Map of plugin IDs to their React components
   */
  private plugins: Map<string, ComponentType<PluginComponentProps>>;

  /**
   * Map of MIME types to plugin IDs
   */
  private mimeTypeMap: Map<string, string>;

  constructor() {
    this.plugins = new Map();
    this.mimeTypeMap = new Map();

    // Initialize with default MIME type mappings
    this.initializeDefaultMappings();
  }

  /**
   * Initialize default MIME type to plugin mappings
   */
  private initializeDefaultMappings(): void {
    // PDF
    this.mimeTypeMap.set("application/pdf", "@ds/plugin-pdf-viewer");

    // Markdown / Notebook
    this.mimeTypeMap.set("text/markdown", "@ds/plugin-notebook");
    this.mimeTypeMap.set("application/x-ipynb+json", "@ds/plugin-notebook");

    // Text
    this.mimeTypeMap.set("text/plain", "@ds/plugin-text-editor");

    // Code
    this.mimeTypeMap.set("text/x-python", "@ds/plugin-code-editor");
    this.mimeTypeMap.set("application/javascript", "@ds/plugin-code-editor");
    this.mimeTypeMap.set("application/typescript", "@ds/plugin-code-editor");
    this.mimeTypeMap.set("text/javascript", "@ds/plugin-code-editor");
    this.mimeTypeMap.set("text/typescript", "@ds/plugin-code-editor");
    this.mimeTypeMap.set("application/json", "@ds/plugin-code-editor");
    this.mimeTypeMap.set("text/html", "@ds/plugin-code-editor");
    this.mimeTypeMap.set("text/css", "@ds/plugin-code-editor");

    // Register placeholder for all built-in plugins
    const builtinPluginIds = [
      "@ds/plugin-pdf-viewer",
      "@ds/plugin-notebook",
      "@ds/plugin-text-editor",
      "@ds/plugin-code-editor",
      "@ds/plugin-image-viewer",
    ];

    builtinPluginIds.forEach((id) => {
      this.plugins.set(id, PlaceholderPlugin);
    });
  }

  /**
   * Register a plugin component
   *
   * @param pluginId - Plugin identifier
   * @param component - React component for the plugin
   */
  registerPlugin(
    pluginId: string,
    component: ComponentType<PluginComponentProps>
  ): void {
    this.plugins.set(pluginId, component);
  }

  /**
   * Unregister a plugin
   *
   * @param pluginId - Plugin identifier to remove
   */
  unregisterPlugin(pluginId: string): void {
    this.plugins.delete(pluginId);
  }

  /**
   * Register a MIME type to plugin mapping
   *
   * @param mimeType - MIME type
   * @param pluginId - Plugin ID to handle this MIME type
   */
  registerMimeType(mimeType: string, pluginId: string): void {
    this.mimeTypeMap.set(mimeType, pluginId);
  }

  // IPluginResolver implementation

  /**
   * Get the React component for a plugin
   */
  getPluginComponent(
    pluginId: string
  ): ComponentType<PluginComponentProps> | null {
    return this.plugins.get(pluginId) || null;
  }

  /**
   * Get the default plugin ID for a MIME type
   */
  getDefaultPluginForMimeType(mimeType: string): string | null {
    return this.mimeTypeMap.get(mimeType) || null;
  }

  /**
   * Check if a plugin is registered
   */
  isPluginRegistered(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Get all registered plugin IDs
   */
  getRegisteredPluginIds(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Get all MIME type mappings
   */
  getMimeTypeMappings(): Record<string, string> {
    const result: Record<string, string> = {};
    this.mimeTypeMap.forEach((pluginId, mimeType) => {
      result[mimeType] = pluginId;
    });
    return result;
  }
}

/**
 * Global plugin resolver stub instance
 *
 * Use this singleton for simple cases. For more control,
 * create a new instance and pass to PluginResolverProvider.
 */
export const pluginResolverStub = new PluginResolverStub();
