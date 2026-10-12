/**
 * Open File Unified Flow
 *
 * Provides a unified API for opening files with the appropriate plugin.
 * Automatically determines the best plugin based on file extension and MIME type.
 *
 * @module lib/plugin/open-file
 */

import { pluginRegistry } from "./registry";
import { useTabsStore } from "@/lib/stores/tabs";
import type { TabContext, OpenTabOptions } from "@/lib/types/tab";
import type { UnifiedPluginManifest } from "@/lib/types/plugin";

// ============================================================
// Types
// ============================================================

/**
 * File information for opening
 */
export interface FileInfo {
  /** File ID (used as resourceId) */
  id: string;

  /** File name */
  name: string;

  /** File path (optional) */
  path?: string;

  /** MIME type (optional, helps with plugin selection) */
  mimeType?: string;

  /** File size in bytes (optional) */
  size?: number;

  /** Last modified timestamp (optional) */
  lastModified?: number;
}

/**
 * Options for opening a file
 */
export interface OpenFileOptions {
  /** File information */
  file: FileInfo;

  /** Project ID (optional) */
  projectId?: string;

  /** Force specific plugin ID (bypasses auto-detection) */
  forcePluginId?: string;

  /** Custom tab title (optional, defaults to file name) */
  title?: string;

  /** Custom tab icon (optional) */
  icon?: string;

  /** Additional custom data for the tab context */
  customData?: Record<string, unknown>;
}

/**
 * Result of opening a file
 */
export interface OpenFileResult {
  /** Whether the file was opened successfully */
  success: boolean;

  /** Tab ID if successful */
  tabId?: string;

  /** Plugin ID used to open the file */
  pluginId?: string;

  /** Error message if failed */
  error?: string;
}

/**
 * Options for "Open With" dialog
 */
export interface OpenWithOptions extends OpenFileOptions {
  /** Plugin ID to use */
  pluginId: string;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Extract file extension from file name
 */
function getFileExtension(fileName: string): string | undefined {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0) return undefined;
  return fileName.slice(lastDot).toLowerCase();
}

/**
 * Get default plugin ID for a file
 *
 * @param fileName - File name
 * @param mimeType - Optional MIME type
 * @returns Plugin ID or undefined
 */
export function getDefaultPluginForFile(
  fileName: string,
  mimeType?: string
): string | undefined {
  const plugin = pluginRegistry.findPluginForFile(fileName, mimeType);
  return plugin?.id;
}

/**
 * Get all plugins that can handle a file
 *
 * @param fileName - File name
 * @param mimeType - Optional MIME type
 * @returns Array of plugin manifests
 */
export function getPluginsForFile(
  fileName: string,
  mimeType?: string
): UnifiedPluginManifest[] {
  return pluginRegistry.findAllPluginsForFile(fileName, mimeType);
}

/**
 * Get icon for file based on extension
 */
function getIconForFile(fileName: string): string | undefined {
  const extension = getFileExtension(fileName);
  if (!extension) return undefined;

  // Map common extensions to icons
  const iconMap: Record<string, string> = {
    ".pdf": "file-text",
    ".md": "book-open",
    ".markdown": "book-open",
    ".mdx": "book-open",
    ".txt": "file-text",
    ".json": "file-json",
    ".js": "file-code",
    ".ts": "file-code",
    ".tsx": "file-code",
    ".jsx": "file-code",
    ".py": "file-code",
    ".html": "file-code",
    ".css": "file-code",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".gif": "image",
    ".svg": "image",
    ".webp": "image",
  };

  return iconMap[extension];
}

// ============================================================
// Main Functions
// ============================================================

/**
 * Open a file with the appropriate plugin
 *
 * This is the main entry point for opening files in the application.
 * It automatically determines the best plugin based on file extension
 * and MIME type.
 *
 * @param options - Open file options
 * @returns Result indicating success or failure
 *
 * @example
 * ```typescript
 * // Open a PDF file
 * const result = await openFile({
 *   file: {
 *     id: 'file-123',
 *     name: 'document.pdf',
 *     mimeType: 'application/pdf'
 *   }
 * });
 *
 * if (result.success) {
 *   console.log('Opened in tab:', result.tabId);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Open with specific plugin
 * const result = await openFile({
 *   file: { id: 'file-456', name: 'notes.md' },
 *   forcePluginId: '@ds/plugin-notebook'
 * });
 * ```
 */
export function openFile(options: OpenFileOptions): OpenFileResult {
  const { file, projectId, forcePluginId, title, icon, customData } = options;

  // Determine plugin to use
  let pluginId = forcePluginId;

  if (!pluginId) {
    // Auto-detect based on file extension and MIME type
    pluginId = getDefaultPluginForFile(file.name, file.mimeType);
  }

  if (!pluginId) {
    // No plugin found for this file type
    return {
      success: false,
      error: `No plugin available to open file: ${file.name}`,
    };
  }

  // Verify plugin is registered
  if (!pluginRegistry.hasPlugin(pluginId)) {
    return {
      success: false,
      error: `Plugin not registered: ${pluginId}`,
    };
  }

  // Build tab context
  const context: TabContext = {
    type: "file",
    resourceId: file.id,
    resourceName: file.name,
    customData: {
      ...customData,
      path: file.path,
      mimeType: file.mimeType,
      size: file.size,
      lastModified: file.lastModified,
      projectId,
    },
  };

  // Build open tab options
  const tabOptions: OpenTabOptions = {
    pluginId,
    context,
    title: title || file.name,
    icon: icon || getIconForFile(file.name),
  };

  // Open the tab
  const tabsStore = useTabsStore.getState();
  const tabId = tabsStore.openTab(tabOptions);

  return {
    success: true,
    tabId,
    pluginId,
  };
}

/**
 * Open a file with a specific plugin (for "Open With" functionality)
 *
 * @param options - Open with options including plugin ID
 * @returns Result indicating success or failure
 *
 * @example
 * ```typescript
 * // Open markdown file with code viewer instead of markdown viewer
 * const result = openFileWith({
 *   file: { id: 'file-789', name: 'readme.md' },
 *   pluginId: '@ds/plugin-code-viewer'
 * });
 * ```
 */
export function openFileWith(options: OpenWithOptions): OpenFileResult {
  return openFile({
    ...options,
    forcePluginId: options.pluginId,
  });
}

/**
 * Open a notebook file
 *
 * Convenience function for opening notebook files with the notebook plugin.
 *
 * @param notebookId - Notebook ID
 * @param notebookName - Notebook name
 * @param projectId - Optional project ID
 * @returns Result indicating success or failure
 *
 * @example
 * ```typescript
 * const result = openNotebook('notebook-123', 'My Research Notes');
 * ```
 */
export function openNotebook(
  notebookId: string,
  notebookName: string,
  projectId?: string
): OpenFileResult {
  const pluginId = "@ds/plugin-notebook";

  // Verify plugin is registered
  if (!pluginRegistry.hasPlugin(pluginId)) {
    return {
      success: false,
      error: `Notebook plugin not registered: ${pluginId}`,
    };
  }

  // Build tab context for notebook
  const context: TabContext = {
    type: "notebook",
    resourceId: notebookId,
    resourceName: notebookName,
    customData: {
      projectId,
    },
  };

  // Build open tab options
  const tabOptions: OpenTabOptions = {
    pluginId,
    context,
    title: notebookName,
    icon: "notebook",
  };

  // Open the tab
  const tabsStore = useTabsStore.getState();
  const tabId = tabsStore.openTab(tabOptions);

  return {
    success: true,
    tabId,
    pluginId,
  };
}

/**
 * Open settings page
 *
 * Convenience function for navigating to the dedicated settings route.
 *
 * @param section - Optional settings document to open
 * @returns Result indicating success or failure
 */
export function openSettings(section?: string): OpenFileResult {
  if (typeof window === "undefined") {
    return {
      success: false,
      error: "Settings route is only available in the browser",
    };
  }

  const target = section ? `/settings/${section}` : "/settings";
  window.location.assign(target);

  return {
    success: true,
    tabId: target,
    pluginId: "route:/settings",
  };
}

/**
 * Open search panel
 *
 * Convenience function for opening the search plugin.
 *
 * @param query - Optional initial search query
 * @returns Result indicating success or failure
 *
 * @example
 * ```typescript
 * // Open search with initial query
 * openSearch('neural networks');
 * ```
 */
export function openSearch(query?: string): OpenFileResult {
  const pluginId = "@ds/plugin-search";

  // Verify plugin is registered
  if (!pluginRegistry.hasPlugin(pluginId)) {
    return {
      success: false,
      error: `Search plugin not registered: ${pluginId}`,
    };
  }

  // Build tab context for search
  const context: TabContext = {
    type: "custom",
    resourceId: "search",
    resourceName: "Search",
    customData: {
      query,
    },
  };

  // Build open tab options
  const tabOptions: OpenTabOptions = {
    pluginId,
    context,
    title: query ? `Search: ${query}` : "Search",
    icon: "search",
  };

  // Open the tab
  const tabsStore = useTabsStore.getState();
  const tabId = tabsStore.openTab(tabOptions);

  return {
    success: true,
    tabId,
    pluginId,
  };
}

// ============================================================
// React Hooks
// ============================================================

/**
 * Hook for opening files with the plugin system
 *
 * @returns Object with file opening functions
 *
 * @example
 * ```tsx
 * function FileList({ files }) {
 *   const { openFile, openFileWith, getPluginsForFile } = useOpenFile();
 *
 *   const handleFileClick = (file) => {
 *     openFile({ file });
 *   };
 *
 *   const handleOpenWith = (file, pluginId) => {
 *     openFileWith({ file, pluginId });
 *   };
 *
 *   return (
 *     <ul>
 *       {files.map(file => (
 *         <li key={file.id} onClick={() => handleFileClick(file)}>
 *           {file.name}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useOpenFile() {
  return {
    openFile,
    openFileWith,
    openNotebook,
    openSettings,
    openSearch,
    getDefaultPluginForFile,
    getPluginsForFile,
  };
}
