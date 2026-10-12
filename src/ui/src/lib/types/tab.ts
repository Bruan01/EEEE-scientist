/**
 * Tab Types
 * Core type definitions for the Tab system
 *
 * @module types/tab
 */

/**
 * Tab context type - defines the nature of content displayed in a Tab
 */
export type TabContextType = "file" | "notebook" | "custom";

/**
 * Tab Context - Data passed to plugins
 *
 * Contains all necessary information for a plugin to render content
 */
export interface TabContext {
  /** Context type */
  type: TabContextType;

  /** Resource ID (file ID, Notebook ID, etc.) */
  resourceId?: string;

  /** Resource path (used for display and navigation) */
  resourcePath?: string;

  /** Resource name (used for Tab title) */
  resourceName?: string;

  /** File MIME type (used for file type detection) */
  mimeType?: string;

  /** Plugin custom data */
  customData?: Record<string, unknown>;
}

/**
 * Tab Definition - Core data structure
 *
 * Represents a single tab in the workspace.
 * Key concept: Tab = Plugin Instance
 */
export interface Tab {
  /** Unique Tab ID */
  id: string;

  /** ID of the plugin that renders this Tab */
  pluginId: string;

  /** Context passed to the plugin */
  context: TabContext;

  /** Tab display title */
  title: string;

  /** Tab icon (lucide icon name) */
  icon?: string;

  /** Whether there are unsaved changes */
  isDirty?: boolean;

  /** Whether the tab is pinned */
  isPinned?: boolean;

  /** Creation timestamp */
  createdAt: number;

  /** Last accessed timestamp */
  lastAccessedAt: number;
}

/**
 * Options for opening a new Tab
 */
export interface OpenTabOptions {
  /** Plugin ID to render this tab */
  pluginId: string;

  /** Context to pass to the plugin */
  context: TabContext;

  /** Optional title (defaults to resourceName or 'Untitled') */
  title?: string;

  /** Optional icon */
  icon?: string;
}

/**
 * Plugin Component Props
 *
 * Props passed to plugin components when rendering in a Tab
 */
export interface PluginComponentProps {
  /** Tab context */
  context: TabContext;

  /** Tab ID (used to update Tab state) */
  tabId: string;

  /** Update Tab dirty state */
  setDirty: (isDirty: boolean) => void;

  /** Update Tab title */
  setTitle: (title: string) => void;
}
