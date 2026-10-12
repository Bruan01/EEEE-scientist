/**
 * File Opener Utility
 *
 * Provides functions to find the appropriate plugin for a given file
 * and open files with the correct viewer.
 *
 * @module lib/plugin/file-opener
 */

import { pluginRegistry } from "./registry";
import type { UnifiedPluginManifest } from "@/lib/types/plugin";

// ============================================================
// Types
// ============================================================

/**
 * File information for plugin matching
 */
export interface FileMatchInfo {
  /** File name (with extension) */
  filename: string;

  /** MIME type (optional) */
  mimeType?: string;

  /** File path (optional) */
  path?: string;
}

/**
 * Plugin match result
 */
export interface PluginMatch {
  /** Plugin manifest */
  plugin: UnifiedPluginManifest;

  /** Match priority (higher = better match) */
  priority: number;

  /** Match type: extension or mimeType */
  matchType: "extension" | "mimeType";
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Extract file extension from filename (lowercase, with dot)
 */
function getExtension(filename: string): string | undefined {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot < 0) return undefined;
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Check if a plugin's file association matches a file
 */
function matchesFile(
  plugin: UnifiedPluginManifest,
  filename: string,
  mimeType?: string
): PluginMatch | null {
  const associations = plugin.frontend?.fileAssociations;
  if (!associations || associations.length === 0) {
    return null;
  }

  const extension = getExtension(filename);
  let bestMatch: PluginMatch | null = null;

  for (const assoc of associations) {
    // Check extension match
    if (extension) {
      const extMatch = assoc.extensions.some(
        (ext) => ext.toLowerCase() === extension
      );
      if (extMatch) {
        if (!bestMatch || assoc.priority > bestMatch.priority) {
          bestMatch = {
            plugin,
            priority: assoc.priority,
            matchType: "extension",
          };
        }
      }
    }

    // Check MIME type match
    if (mimeType && assoc.mimeTypes) {
      const mimeMatch = assoc.mimeTypes.includes(mimeType);
      if (mimeMatch) {
        if (!bestMatch || assoc.priority > bestMatch.priority) {
          bestMatch = {
            plugin,
            priority: assoc.priority,
            matchType: "mimeType",
          };
        }
      }

      // Check wildcard MIME type match (e.g., "image/*")
      const [mainType] = mimeType.split("/");
      const wildcardMime = `${mainType}/*`;
      const wildcardMatch = assoc.mimeTypes.includes(wildcardMime);
      if (wildcardMatch && !bestMatch) {
        bestMatch = {
          plugin,
          priority: assoc.priority - 10, // Lower priority for wildcard
          matchType: "mimeType",
        };
      }
    }
  }

  return bestMatch;
}

// ============================================================
// Main Functions
// ============================================================

/**
 * Find the best plugin for a file
 *
 * Searches through all registered plugins and returns the one with
 * the highest priority that can handle the given file.
 *
 * @param filename - File name (used for extension matching)
 * @param mimeType - Optional MIME type
 * @returns Plugin manifest or undefined if no plugin found
 *
 * @example
 * ```typescript
 * // Find plugin for a PDF file
 * const plugin = findPluginForFile('document.pdf', 'application/pdf');
 * // Returns @ds/plugin-pdf-viewer manifest
 *
 * // Find plugin for a code file
 * const plugin = findPluginForFile('index.tsx');
 * // Returns @ds/plugin-code-viewer manifest
 * ```
 */
export function findPluginForFile(
  filename: string,
  mimeType?: string
): UnifiedPluginManifest | undefined {
  // Use registry's findPluginForFile which already handles priority
  return pluginRegistry.findPluginForFile(filename, mimeType);
}

/**
 * Find all plugins that can handle a file
 *
 * Returns all plugins that match the file, sorted by priority (highest first).
 * Useful for "Open With" functionality.
 *
 * @param filename - File name (used for extension matching)
 * @param mimeType - Optional MIME type
 * @returns Array of plugin manifests sorted by priority
 *
 * @example
 * ```typescript
 * // Find all plugins for a markdown file
 * const plugins = findAllPluginsForFile('readme.md');
 * // Returns [@ds/plugin-markdown-viewer, @ds/plugin-code-viewer]
 * ```
 */
export function findAllPluginsForFile(
  filename: string,
  mimeType?: string
): UnifiedPluginManifest[] {
  return pluginRegistry.findAllPluginsForFile(filename, mimeType);
}

/**
 * Get detailed plugin match information
 *
 * Returns all matching plugins with their match details (priority, match type).
 * Useful for debugging and advanced "Open With" dialogs.
 *
 * @param info - File information
 * @returns Array of plugin matches with details
 */
export function getPluginMatches(info: FileMatchInfo): PluginMatch[] {
  const allPlugins = pluginRegistry.getAllPlugins();
  const matches: PluginMatch[] = [];

  for (const plugin of allPlugins) {
    const match = matchesFile(plugin, info.filename, info.mimeType);
    if (match) {
      matches.push(match);
    }
  }

  // Sort by priority (highest first)
  matches.sort((a, b) => b.priority - a.priority);

  return matches;
}

/**
 * Check if any plugin can handle a file
 *
 * Quick check to determine if a file can be opened in the application.
 *
 * @param filename - File name
 * @param mimeType - Optional MIME type
 * @returns True if at least one plugin can handle the file
 */
export function canOpenFile(filename: string, mimeType?: string): boolean {
  return findPluginForFile(filename, mimeType) !== undefined;
}

/**
 * Get the default plugin ID for a file extension
 *
 * Returns the plugin ID that should be used by default for a given extension.
 *
 * @param extension - File extension (with or without dot)
 * @returns Plugin ID or undefined
 */
export function getDefaultPluginForExtension(
  extension: string
): string | undefined {
  // Normalize extension
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  const normalizedExt = ext.toLowerCase();

  // Create a dummy filename to use findPluginForFile
  const filename = `file${normalizedExt}`;
  const plugin = findPluginForFile(filename);

  return plugin?.id;
}

/**
 * Get supported file extensions
 *
 * Returns a list of all file extensions that can be opened.
 *
 * @returns Array of extensions (with dots, lowercase)
 */
export function getSupportedExtensions(): string[] {
  const extensions = new Set<string>();
  const allPlugins = pluginRegistry.getAllPlugins();

  for (const plugin of allPlugins) {
    const associations = plugin.frontend?.fileAssociations;
    if (!associations) continue;

    for (const assoc of associations) {
      for (const ext of assoc.extensions) {
        extensions.add(ext.toLowerCase());
      }
    }
  }

  return Array.from(extensions).sort();
}

/**
 * Get file type category based on extension
 *
 * Categorizes files into common types for UI grouping.
 *
 * @param filename - File name
 * @returns Category name
 */
export function getFileCategory(
  filename: string
): "code" | "document" | "image" | "data" | "other" {
  const ext = getExtension(filename);
  if (!ext) return "other";

  const codeExtensions = [
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".py",
    ".go",
    ".rs",
    ".java",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".cs",
    ".php",
    ".rb",
    ".swift",
    ".kt",
    ".scala",
    ".sh",
    ".bash",
    ".zsh",
    ".sql",
    ".graphql",
    ".html",
    ".css",
    ".scss",
    ".less",
    ".vue",
    ".svelte",
  ];

  const documentExtensions = [
    ".md",
    ".markdown",
    ".txt",
    ".pdf",
    ".doc",
    ".docx",
    ".rtf",
    ".odt",
    ".ppt",
    ".pptx",
    ".odp",
  ];

  const imageExtensions = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".bmp",
    ".ico",
    ".tiff",
    ".tif",
  ];

  const dataExtensions = [
    ".json",
    ".yaml",
    ".yml",
    ".xml",
    ".csv",
    ".xlsx",
    ".xls",
    ".ods",
    ".toml",
    ".ini",
    ".cfg",
  ];

  if (codeExtensions.includes(ext)) return "code";
  if (documentExtensions.includes(ext)) return "document";
  if (imageExtensions.includes(ext)) return "image";
  if (dataExtensions.includes(ext)) return "data";

  return "other";
}

// ============================================================
// Export for convenience
// ============================================================

const fileOpener = {
  findPluginForFile,
  findAllPluginsForFile,
  getPluginMatches,
  canOpenFile,
  getDefaultPluginForExtension,
  getSupportedExtensions,
  getFileCategory,
};

export default fileOpener;
