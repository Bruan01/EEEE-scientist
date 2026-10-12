/**
 * Notebook Plugin Type Definitions
 *
 * @ds/plugin-notebook
 *
 * TypeScript interfaces for notebook data structures and editor contexts.
 */

import type { JSONContent } from "novel";

/**
 * Notebook entity - basic notebook information
 */
export interface Notebook {
  /** Unique notebook ID */
  id: string;

  /** Project ID this notebook belongs to */
  projectId: string;

  /** Notebook title */
  title: string;

  /** Emoji icon (optional) */
  icon?: string;

  /** Cover image URL (optional) */
  coverUrl?: string;

  /** Whether real-time collaboration is enabled */
  collaborationEnabled: boolean;

  /** User ID who created this notebook */
  createdBy: string;

  /** Creation timestamp (ISO 8601) */
  createdAt: string;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/**
 * Notebook detail - includes content data
 */
export interface NotebookDetail extends Notebook {
  /** Notebook content structure */
  content: NotebookContent | null;

  /** Yjs binary state (base64 encoded) for restoration */
  yjsUpdate?: string;
}

/**
 * Notebook content - Tiptap JSON structure
 */
export type NotebookContent = JSONContent;

/**
 * Notebook version snapshot
 */
export interface NotebookSnapshot {
  /** Snapshot ID */
  id: string;

  /** Associated notebook ID */
  notebookId: string;

  /** Snapshot title/label */
  title: string;

  /** Content at this snapshot */
  content: NotebookContent;

  /** Creation timestamp (ISO 8601) */
  createdAt: string;

  /** User ID who created this snapshot */
  createdBy: string;
}

/**
 * Tab context for opening a notebook
 */
export interface NotebookTabContext {
  /** Context type identifier */
  type: "notebook";

  /** Notebook ID */
  resourceId: string;

  /** Notebook title (for tab display) */
  resourceName: string;

  /** Whether to open in readonly mode */
  readonly?: boolean;
}

/**
 * Notebook outline heading entry
 */
export interface NotebookHeading {
  /** Block ID */
  blockId: string;

  /** Heading level (1-6) */
  level: number;

  /** Heading text content */
  text: string;
}

/**
 * Notebook search result
 */
export interface NotebookSearchResult {
  /** Block ID containing the match */
  blockId: string;

  /** Block type */
  blockType: string;

  /** Matched content */
  content: string;

  /** Surrounding context for display */
  context: string;
}

/**
 * Notebook collaborator
 */
export interface NotebookCollaborator {
  /** User ID */
  userId: string;

  /** User display name */
  displayName: string;

  /** User avatar URL */
  avatarUrl?: string;

  /** Permission level */
  permission: "viewer" | "editor" | "owner";

  /** Cursor color for collaboration */
  color?: string;
}


/**
 * Auto-save status
 */
export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Notebook editor state
 */
export interface NotebookEditorState {
  /** Whether the editor is loading */
  isLoading: boolean;

  /** Whether the document has unsaved changes */
  isDirty: boolean;

  /** Auto-save status */
  autoSaveStatus: AutoSaveStatus;

  /** Error message if any */
  error?: string;

  /** Connected collaborators */
  collaborators: NotebookCollaborator[];
}

/**
 * Notebook API response types
 */
export interface NotebookListResponse {
  notebooks: Notebook[];
  total: number;
  page: number;
  pageSize: number;
}

export interface NotebookCreateRequest {
  title: string;
  projectId: string;
  icon?: string;
  collaborationEnabled?: boolean;
}

export interface NotebookUpdateRequest {
  title?: string;
  icon?: string;
  coverUrl?: string;
  yjsUpdate?: string; // Base64 encoded Yjs state
}

/**
 * Export format options
 */
export type ExportFormat = "markdown" | "html" | "pdf";

export interface NotebookExportOptions {
  format: ExportFormat;
  includeImages?: boolean;
  includeAttachments?: boolean;
}
