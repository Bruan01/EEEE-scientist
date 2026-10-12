/**
 * Plugin Resolver Interface
 *
 * Minimum interface for Tab system to resolve plugins.
 * Tab system only depends on this interface, not the full PluginRegistry.
 *
 * @module types/plugin-resolver
 */

import type { ComponentType } from "react";
import type { PluginComponentProps } from "./tab";

/**
 * Plugin Resolver Minimum Interface
 *
 * This interface is defined in Phase 02 (Tab System) and implemented
 * by PluginRegistry in Phase 03 (Plugin System).
 *
 * This decoupling allows Tab system to work before Plugin system is ready.
 */
export interface IPluginResolver {
  /**
   * Get the React component for a plugin
   *
   * @param pluginId - Plugin identifier (e.g., '@ds/plugin-pdf-viewer')
   * @returns React component or null if not found
   */
  getPluginComponent(
    pluginId: string
  ): ComponentType<PluginComponentProps> | null;

  /**
   * Get the default plugin ID for a MIME type
   *
   * @param mimeType - MIME type (e.g., 'application/pdf')
   * @returns Plugin ID or null if no default handler
   */
  getDefaultPluginForMimeType(mimeType: string): string | null;

  /**
   * Check if a plugin is registered
   *
   * @param pluginId - Plugin identifier
   * @returns true if plugin is registered
   */
  isPluginRegistered(pluginId: string): boolean;
}

/**
 * Default MIME type to Plugin mapping
 *
 * Used by PluginResolverStub before full Plugin system is loaded.
 * Provides basic functionality for built-in plugins.
 */
export const DEFAULT_MIME_PLUGIN_MAP: Record<string, string> = {
  // PDF files
  "application/pdf": "@ds/plugin-pdf-viewer",

  // Markdown / Notebook
  "text/markdown": "@ds/plugin-notebook",
  "application/x-ipynb+json": "@ds/plugin-notebook",

  // Text files
  "text/plain": "@ds/plugin-text-editor",
  "text/x-tex": "@ds/plugin-code-editor",
  "application/x-tex": "@ds/plugin-code-editor",
  "text/x-bibtex": "@ds/plugin-code-editor",
  "application/x-bibtex": "@ds/plugin-code-editor",

  // Code files
  "text/x-python": "@ds/plugin-code-editor",
  "application/javascript": "@ds/plugin-code-editor",
  "application/typescript": "@ds/plugin-code-editor",
  "text/javascript": "@ds/plugin-code-editor",
  "text/typescript": "@ds/plugin-code-editor",
  "application/json": "@ds/plugin-code-editor",
  "text/html": "@ds/plugin-code-editor",
  "text/css": "@ds/plugin-code-editor",

  // Images (future)
  "image/png": "@ds/plugin-image-viewer",
  "image/jpeg": "@ds/plugin-image-viewer",
  "image/gif": "@ds/plugin-image-viewer",
  "image/webp": "@ds/plugin-image-viewer",
  "image/svg+xml": "@ds/plugin-image-viewer",
};

/**
 * Get plugin ID from file extension
 *
 * Helper function to determine plugin based on file extension
 * when MIME type is not available.
 */
export function getPluginIdFromExtension(fileName: string): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase();

  const extensionMap: Record<string, string> = {
    // PDF
    pdf: "@ds/plugin-pdf-viewer",

    // Markdown / Notebook
    md: "@ds/plugin-notebook",
    markdown: "@ds/plugin-notebook",
    ipynb: "@ds/plugin-notebook",

    // Code files
    py: "@ds/plugin-code-editor",
    js: "@ds/plugin-code-editor",
    ts: "@ds/plugin-code-editor",
    jsx: "@ds/plugin-code-editor",
    tsx: "@ds/plugin-code-editor",
    json: "@ds/plugin-code-editor",
    html: "@ds/plugin-code-editor",
    css: "@ds/plugin-code-editor",
    scss: "@ds/plugin-code-editor",
    yaml: "@ds/plugin-code-editor",
    yml: "@ds/plugin-code-editor",
    xml: "@ds/plugin-code-editor",
    sh: "@ds/plugin-code-editor",
    bash: "@ds/plugin-code-editor",
    sql: "@ds/plugin-code-editor",

    // Text files
    txt: "@ds/plugin-text-editor",
    log: "@ds/plugin-text-editor",
    csv: "@ds/plugin-text-editor",
    tex: "@ds/plugin-code-editor",
    bib: "@ds/plugin-code-editor",

    // Images
    png: "@ds/plugin-image-viewer",
    jpg: "@ds/plugin-image-viewer",
    jpeg: "@ds/plugin-image-viewer",
    gif: "@ds/plugin-image-viewer",
    webp: "@ds/plugin-image-viewer",
    svg: "@ds/plugin-image-viewer",
  };

  return ext ? extensionMap[ext] || null : null;
}
