/**
 * Notebook Plugin Entry Point
 *
 * @ds/plugin-notebook
 *
 * Exports the notebook plugin manifest and components.
 * This file is the main entry point for the builtin loader.
 */

// NOTE: Notebook editor is powered by Novel (Tiptap) in this repo.

// Export manifest
export { notebookPluginManifest } from "./manifest";
export { default as notebookManifest } from "./manifest";

// Export types
export type {
  Notebook,
  NotebookDetail,
  NotebookContent,
  NotebookSnapshot,
  NotebookTabContext,
  NotebookHeading,
  NotebookSearchResult,
  NotebookCollaborator,
  AutoSaveStatus,
  NotebookEditorState,
  NotebookListResponse,
  NotebookCreateRequest,
  NotebookUpdateRequest,
  ExportFormat,
  NotebookExportOptions,
} from "./types";

// Export components
export { default as NotebookEditor } from "./components/NotebookEditor";
export { NotebookEditor as NotebookEditorComponent } from "./components/NotebookEditor";

// Default export for plugin loader (must be the component)
export { default } from "./components/NotebookEditor";
export { NotebookToolbar } from "./components/NotebookToolbar";
export { EditorLoading } from "./components/EditorLoading";

// Lifecycle hooks
export function activate(): void {
  console.log("[NotebookPlugin] Activated");
}

export function deactivate(): void {
  console.log("[NotebookPlugin] Deactivated");
}
