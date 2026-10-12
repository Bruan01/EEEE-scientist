/**
 * Notebook Plugin Manifest
 *
 * @ds/plugin-notebook
 *
 * Built-in plugin for rich-text editing powered by Novel (Tiptap).
 * Features:
 * - Rich block editor (paragraphs, headings, lists, code, images)
 * - Slash command menu for quick block insertion
 * - Real-time collaboration via Yjs
 * - Auto-save with Yjs binary state
 * - No AI features enabled
 */

import type { UnifiedPluginManifest } from "@/lib/types/plugin";

/**
 * Notebook Plugin Manifest Definition
 */
export const notebookPluginManifest: UnifiedPluginManifest = {
  // ============================================================
  // Basic Information
  // ============================================================
  id: "@ds/plugin-notebook",
  name: "Notebook Editor",
  description: "Novel-based rich text editor with real-time collaboration",
  version: "1.0.0",
  type: "builtin",
  author: "DeepScientist Team",
  icon: "BookOpen",

  // ============================================================
  // Frontend Configuration
  // ============================================================
  frontend: {
    entry: "./NotebookEditor",
    renderMode: "react",
    fileAssociations: [
      {
        extensions: [".ds", ".notebook", ".dsnb"],
        mimeTypes: ["application/x-blocksuite-notebook"],
        priority: 100, // Highest priority for notebook files
      },
      {
        extensions: [".md", ".markdown"],
        mimeTypes: ["text/markdown", "text/x-markdown"],
        priority: 95, // Prefer notebook editor for markdown files
      },
    ],
    multiInstance: true, // Allow multiple notebooks open
  },

  // ============================================================
  // Backend Configuration
  // ============================================================
  backend: {
    entry: "app.plugins.builtin.notebook_tools",
    tools: [],
  },

  // ============================================================
  // Permissions
  // ============================================================
  permissions: {
    frontend: ["notebook:read", "notebook:write", "file:read", "file:upload"],
    backend: ["database:read", "database:write", "file:read", "file:write"],
  },

  // ============================================================
  // UI Contributions
  // ============================================================
  contributes: {
    // Tab configuration
    tabIcon: "file-text",
    tabTitle: {
      dynamic: "resourceName",
    },

    // Toolbar buttons
    toolbar: [
      {
        id: "notebook-export",
        title: "Export",
        icon: "Download",
        command: "notebook.export",
        position: "right",
      },
    ],

    // Context menu items (optional)
    contextMenus: [
      {
        id: "duplicate-block",
        title: "Duplicate Block",
        command: "notebook.duplicateBlock",
        context: "editor",
        group: "edit",
        order: 1,
      },
      {
        id: "delete-block",
        title: "Delete Block",
        command: "notebook.deleteBlock",
        context: "editor",
        group: "edit",
        order: 2,
      },
    ],
  },

  // ============================================================
  // Configuration Schema
  // ============================================================
  configSchema: {
    type: "object",
    properties: {
      defaultFontFamily: {
        type: "string",
        default: "Inter",
        description: "Default font family",
      },
      autoSaveInterval: {
        type: "number",
        default: 3000,
        minimum: 1000,
        maximum: 30000,
        description: "Auto-save interval in milliseconds",
      },
      enableCollaboration: {
        type: "boolean",
        default: true,
        description: "Enable real-time collaboration",
      },
      showBlockHandles: {
        type: "boolean",
        default: true,
        description: "Show block drag handles on hover",
      },
    },
  },

  // ============================================================
  // Default Configuration
  // ============================================================
  defaultConfig: {
    defaultFontFamily: "Inter",
    autoSaveInterval: 3000,
    enableCollaboration: true,
    showBlockHandles: true,
  },

  // ============================================================
  // Lifecycle Hooks
  // ============================================================
  lifecycle: {
    activationEvents: ["onFileType:notebook", "onCommand:newNotebook"],
    onActivate: "activate",
    onDeactivate: "deactivate",
  },
};

export default notebookPluginManifest;
