/**
 * Plugin System Module
 *
 * Central export point for all plugin system functionality.
 *
 * @module lib/plugin
 */

// ============================================================
// Core Components
// ============================================================

// Plugin Registry - manages plugin registration and lookup
export { PluginRegistry, pluginRegistry } from "./registry";

// Builtin Plugin Loader - loads builtin plugins with React.lazy
export { BuiltinPluginLoader, builtinPluginLoader } from "./builtin-loader";

// Plugin Lifecycle Manager - manages plugin state transitions
export {
  PluginLifecycleManager,
  pluginLifecycleManager,
  generateInstanceId,
  parseInstanceId,
} from "./lifecycle";
export type {
  StateChangeCallback,
  LifecycleEvent,
  LifecycleEventCallback,
} from "./lifecycle";

// ============================================================
// File Operations
// ============================================================

// Open File API - unified file opening functionality
export {
  openFile,
  openFileWith,
  openNotebook,
  openSettings,
  openSearch,
  getDefaultPluginForFile,
  getPluginsForFile,
  useOpenFile,
} from "./open-file";
export type {
  FileInfo,
  OpenFileOptions,
  OpenFileResult,
  OpenWithOptions,
} from "./open-file";

// ============================================================
// Initialization
// ============================================================

// Plugin System Initialization
export {
  initializeBuiltinPlugins,
  preloadCommonPlugins,
  initializePluginSystem,
  isPluginSystemInitialized,
  getRegisteredBuiltinPluginIds,
  resetPluginSystem,
  BUILTIN_PLUGIN_MANIFESTS,
  PRELOAD_PLUGIN_IDS,
} from "./init";

// ============================================================
// Re-exports from Types
// ============================================================

// Re-export common types for convenience
export type {
  UnifiedPluginManifest,
  PluginType,
  PluginInstance,
  PluginInstanceState,
  PluginContext,
  FileAssociation,
  FrontendPermission,
  BackendPermission,
  PermissionConfig,
  ContributesConfig,
  SidebarContribution,
  SlashCommandContribution,
  StatusBarContribution,
  LifecycleConfig,
  PluginFrontendConfig,
  PluginBackendConfig,
  SandboxConfig,
  IPluginRegistry,
} from "@/lib/types/plugin";
