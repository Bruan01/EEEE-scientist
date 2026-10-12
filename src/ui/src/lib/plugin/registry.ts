/**
 * Plugin Registry
 *
 * Central registry for managing all registered plugins.
 * Implements singleton pattern and provides plugin lookup capabilities.
 *
 * @module lib/plugin/registry
 */

import type { ComponentType } from "react";
import type {
  UnifiedPluginManifest,
  FileAssociation,
  IPluginRegistry,
  SidebarContribution,
  SlashCommandContribution,
  StatusBarContribution,
} from "@/lib/types/plugin";
import type { PluginComponentProps } from "@/lib/types/tab";
import type { IPluginResolver } from "@/lib/types/plugin-resolver";

// ============================================================
// Internal Types
// ============================================================

/**
 * File association entry with plugin reference
 */
interface FileAssociationEntry {
  pluginId: string;
  association: FileAssociation;
}

/**
 * Registered plugin with optional component
 */
interface RegisteredPlugin {
  manifest: UnifiedPluginManifest;
  component?: ComponentType<PluginComponentProps>;
}

// ============================================================
// Plugin Registry Implementation
// ============================================================

/**
 * Plugin Registry
 *
 * Singleton class that manages all registered plugins.
 * Provides methods for registering, unregistering, and querying plugins.
 *
 * @example
 * ```typescript
 * const registry = PluginRegistry.getInstance();
 *
 * // Register a plugin
 * registry.register(pdfViewerManifest, PdfViewerComponent);
 *
 * // Find plugin for a file
 * const plugin = registry.findPluginForFile('document.pdf');
 *
 * // Get sidebar contributions
 * const sidebarItems = registry.getSidebarContributions();
 * ```
 */
export class PluginRegistry implements IPluginRegistry, IPluginResolver {
  private static instance: PluginRegistry;

  /**
   * Registered plugins
   * key: pluginId
   * value: RegisteredPlugin
   */
  private plugins = new Map<string, RegisteredPlugin>();

  /**
   * File extension associations (sorted by priority)
   * key: extension (lowercase, with dot)
   * value: sorted array of FileAssociationEntry
   */
  private extensionAssociations = new Map<string, FileAssociationEntry[]>();

  /**
   * MIME type associations (sorted by priority)
   * key: MIME type
   * value: sorted array of FileAssociationEntry
   */
  private mimeAssociations = new Map<string, FileAssociationEntry[]>();

  /**
   * Cached sidebar contributions
   */
  private sidebarContributionsCache: Array<{
    pluginId: string;
    contribution: SidebarContribution;
  }> = [];

  /**
   * Cached slash command contributions
   */
  private slashCommandContributionsCache: Array<{
    pluginId: string;
    contribution: SlashCommandContribution;
  }> = [];

  /**
   * Cached status bar contributions
   */
  private statusBarContributionsCache: Array<{
    pluginId: string;
    contribution: StatusBarContribution;
  }> = [];

  /**
   * Flag indicating if contributions cache is dirty
   */
  private contributionsCacheDirty = true;

  /**
   * Private constructor (singleton pattern)
   */
  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): PluginRegistry {
    if (!PluginRegistry.instance) {
      PluginRegistry.instance = new PluginRegistry();
    }
    return PluginRegistry.instance;
  }

  /**
   * Reset the registry (for testing purposes)
   */
  static resetInstance(): void {
    PluginRegistry.instance = new PluginRegistry();
  }

  // ============================================================
  // Registration Methods
  // ============================================================

  /**
   * Register a plugin
   *
   * @param manifest - Plugin manifest
   * @param component - React component (optional, required for builtin plugins)
   */
  register(
    manifest: UnifiedPluginManifest,
    component?: ComponentType<PluginComponentProps>
  ): void {
    // Check for existing registration
    if (this.plugins.has(manifest.id)) {
      console.warn(
        `[PluginRegistry] Plugin ${manifest.id} is already registered, replacing...`
      );
      this.unregister(manifest.id);
    }

    // Validate manifest
    this.validateManifest(manifest);

    // Store plugin
    this.plugins.set(manifest.id, { manifest, component });

    // Register file associations
    this.registerFileAssociations(manifest);

    // Mark contributions cache as dirty
    this.contributionsCacheDirty = true;

    console.log(`[PluginRegistry] Plugin registered: ${manifest.id}`);
  }

  /**
   * Unregister a plugin
   *
   * @param pluginId - Plugin ID to unregister
   */
  unregister(pluginId: string): void {
    const registered = this.plugins.get(pluginId);
    if (!registered) {
      return;
    }

    // Remove file associations
    this.unregisterFileAssociations(registered.manifest);

    // Remove plugin
    this.plugins.delete(pluginId);

    // Mark contributions cache as dirty
    this.contributionsCacheDirty = true;

    console.log(`[PluginRegistry] Plugin unregistered: ${pluginId}`);
  }

  // ============================================================
  // Query Methods
  // ============================================================

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId: string): UnifiedPluginManifest | undefined {
    return this.plugins.get(pluginId)?.manifest;
  }

  /**
   * Check if plugin is registered
   */
  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): UnifiedPluginManifest[] {
    return Array.from(this.plugins.values()).map((p) => p.manifest);
  }

  /**
   * Find the best matching plugin for a file
   *
   * @param fileName - File name (used to extract extension)
   * @param mimeType - Optional MIME type
   * @returns Best matching plugin or undefined
   */
  findPluginForFile(
    fileName: string,
    mimeType?: string
  ): UnifiedPluginManifest | undefined {
    // Try extension match first
    const extension = this.getExtension(fileName);
    if (extension) {
      const extEntries = this.extensionAssociations.get(extension);
      if (extEntries && extEntries.length > 0) {
        const pluginId = extEntries[0].pluginId;
        return this.plugins.get(pluginId)?.manifest;
      }
    }

    // Fall back to MIME type match
    if (mimeType) {
      const mimeEntries = this.mimeAssociations.get(mimeType);
      if (mimeEntries && mimeEntries.length > 0) {
        const pluginId = mimeEntries[0].pluginId;
        return this.plugins.get(pluginId)?.manifest;
      }

      // Try MIME type wildcard match (e.g., text/*)
      const [mainType] = mimeType.split("/");
      const wildcardMime = `${mainType}/*`;
      const wildcardEntries = this.mimeAssociations.get(wildcardMime);
      if (wildcardEntries && wildcardEntries.length > 0) {
        const pluginId = wildcardEntries[0].pluginId;
        return this.plugins.get(pluginId)?.manifest;
      }
    }

    return undefined;
  }

  /**
   * Find all plugins that can handle a file
   *
   * @param fileName - File name
   * @param mimeType - Optional MIME type
   * @returns Array of matching plugins (sorted by priority)
   */
  findAllPluginsForFile(
    fileName: string,
    mimeType?: string
  ): UnifiedPluginManifest[] {
    const result = new Map<string, UnifiedPluginManifest>();
    const priorities = new Map<string, number>();

    // Collect extension matches
    const extension = this.getExtension(fileName);
    if (extension) {
      const extEntries = this.extensionAssociations.get(extension);
      extEntries?.forEach((entry) => {
        const manifest = this.plugins.get(entry.pluginId)?.manifest;
        if (manifest) {
          result.set(entry.pluginId, manifest);
          priorities.set(entry.pluginId, entry.association.priority);
        }
      });
    }

    // Collect MIME type matches
    if (mimeType) {
      const mimeEntries = this.mimeAssociations.get(mimeType);
      mimeEntries?.forEach((entry) => {
        const manifest = this.plugins.get(entry.pluginId)?.manifest;
        if (manifest && !result.has(entry.pluginId)) {
          result.set(entry.pluginId, manifest);
          priorities.set(entry.pluginId, entry.association.priority);
        }
      });
    }

    // Sort by priority (descending)
    return Array.from(result.values()).sort((a, b) => {
      const priorityA = priorities.get(a.id) || 0;
      const priorityB = priorities.get(b.id) || 0;
      return priorityB - priorityA;
    });
  }

  /**
   * Get React component for a plugin
   */
  getPluginComponent(
    pluginId: string
  ): ComponentType<PluginComponentProps> | null {
    return this.plugins.get(pluginId)?.component || null;
  }

  // ============================================================
  // IPluginResolver Implementation (for compatibility)
  // ============================================================

  /**
   * Get the default plugin ID for a MIME type
   */
  getDefaultPluginForMimeType(mimeType: string): string | null {
    const entries = this.mimeAssociations.get(mimeType);
    if (entries && entries.length > 0) {
      return entries[0].pluginId;
    }
    return null;
  }

  /**
   * Check if plugin is registered (alias for hasPlugin)
   */
  isPluginRegistered(pluginId: string): boolean {
    return this.hasPlugin(pluginId);
  }

  // ============================================================
  // Contribution Methods
  // ============================================================

  /**
   * Get all sidebar contributions
   */
  getSidebarContributions(): Array<{
    pluginId: string;
    contribution: SidebarContribution;
  }> {
    this.rebuildContributionsCacheIfNeeded();
    return this.sidebarContributionsCache;
  }

  /**
   * Get all slash command contributions
   */
  getSlashCommandContributions(): Array<{
    pluginId: string;
    contribution: SlashCommandContribution;
  }> {
    this.rebuildContributionsCacheIfNeeded();
    return this.slashCommandContributionsCache;
  }

  /**
   * Get all status bar contributions
   */
  getStatusBarContributions(): Array<{
    pluginId: string;
    contribution: StatusBarContribution;
  }> {
    this.rebuildContributionsCacheIfNeeded();
    return this.statusBarContributionsCache;
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /**
   * Get file extension (lowercase, with dot)
   */
  private getExtension(fileName: string): string | undefined {
    const lastDot = fileName.lastIndexOf(".");
    if (lastDot < 0) return undefined;
    return fileName.slice(lastDot).toLowerCase();
  }

  /**
   * Validate plugin manifest
   */
  private validateManifest(manifest: UnifiedPluginManifest): void {
    // Validate ID format
    if (manifest.type === "builtin" && !manifest.id.startsWith("@ds/")) {
      console.warn(
        `[PluginRegistry] Builtin plugin ID should start with @ds/: ${manifest.id}`
      );
    }

    // Validate render mode for external plugins
    if (
      manifest.type === "external" &&
      manifest.frontend?.renderMode === "react"
    ) {
      throw new Error(
        `External plugin ${manifest.id} cannot use react render mode`
      );
    }
  }

  /**
   * Register file associations for a plugin
   */
  private registerFileAssociations(manifest: UnifiedPluginManifest): void {
    const fileAssociations = manifest.frontend?.fileAssociations;
    if (!fileAssociations) return;

    fileAssociations.forEach((association) => {
      // Register extension associations
      association.extensions.forEach((ext) => {
        const normalizedExt = ext.toLowerCase();
        const entries = this.extensionAssociations.get(normalizedExt) || [];
        entries.push({ pluginId: manifest.id, association });
        // Sort by priority (descending)
        entries.sort((a, b) => b.association.priority - a.association.priority);
        this.extensionAssociations.set(normalizedExt, entries);
      });

      // Register MIME type associations
      association.mimeTypes?.forEach((mimeType) => {
        const entries = this.mimeAssociations.get(mimeType) || [];
        entries.push({ pluginId: manifest.id, association });
        entries.sort((a, b) => b.association.priority - a.association.priority);
        this.mimeAssociations.set(mimeType, entries);
      });
    });
  }

  /**
   * Unregister file associations for a plugin
   */
  private unregisterFileAssociations(manifest: UnifiedPluginManifest): void {
    const fileAssociations = manifest.frontend?.fileAssociations;
    if (!fileAssociations) return;

    fileAssociations.forEach((association) => {
      // Remove extension associations
      association.extensions.forEach((ext) => {
        const normalizedExt = ext.toLowerCase();
        const entries = this.extensionAssociations.get(normalizedExt);
        if (entries) {
          const filtered = entries.filter((e) => e.pluginId !== manifest.id);
          if (filtered.length > 0) {
            this.extensionAssociations.set(normalizedExt, filtered);
          } else {
            this.extensionAssociations.delete(normalizedExt);
          }
        }
      });

      // Remove MIME type associations
      association.mimeTypes?.forEach((mimeType) => {
        const entries = this.mimeAssociations.get(mimeType);
        if (entries) {
          const filtered = entries.filter((e) => e.pluginId !== manifest.id);
          if (filtered.length > 0) {
            this.mimeAssociations.set(mimeType, filtered);
          } else {
            this.mimeAssociations.delete(mimeType);
          }
        }
      });
    });
  }

  /**
   * Rebuild contributions cache if dirty
   */
  private rebuildContributionsCacheIfNeeded(): void {
    if (!this.contributionsCacheDirty) return;

    // Clear caches
    this.sidebarContributionsCache = [];
    this.slashCommandContributionsCache = [];
    this.statusBarContributionsCache = [];

    // Collect contributions from all plugins
    this.plugins.forEach((registered, pluginId) => {
      const { manifest } = registered;
      const contributes = manifest.contributes;

      if (!contributes) return;

      // Sidebar menus
      contributes.sidebarMenus?.forEach((contribution: SidebarContribution) => {
        this.sidebarContributionsCache.push({ pluginId, contribution });
      });

      // Slash commands
      contributes.slashCommands?.forEach((contribution: SlashCommandContribution) => {
        this.slashCommandContributionsCache.push({ pluginId, contribution });
      });

      // Status bar items
      contributes.statusBarItems?.forEach((contribution: StatusBarContribution) => {
        this.statusBarContributionsCache.push({ pluginId, contribution });
      });
    });

    // Sort sidebar contributions by order
    this.sidebarContributionsCache.sort(
      (a, b) => (a.contribution.order || 100) - (b.contribution.order || 100)
    );

    // Sort status bar contributions by priority
    this.statusBarContributionsCache.sort(
      (a, b) =>
        (b.contribution.priority || 0) - (a.contribution.priority || 0)
    );

    this.contributionsCacheDirty = false;
  }
}

/**
 * Global plugin registry singleton
 */
export const pluginRegistry = PluginRegistry.getInstance();
