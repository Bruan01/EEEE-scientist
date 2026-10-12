/**
 * File System Type Definitions
 *
 * Types for the file tree and file operations
 *
 * @module types/file
 */

/**
 * FileNode - Represents a file or folder in the file tree
 */
export interface FileNode {
  /** Unique file/folder ID */
  id: string;

  /** File or folder name */
  name: string;

  /** Node type */
  type: "folder" | "file" | "notebook";

  /** Special folder kind (e.g. 'latex') */
  folderKind?: string;

  /** Folder-scoped metadata subset (only present for some folder kinds) */
  latex?: {
    mainFileId?: string | null;
  } | null;

  /** Child nodes (only for folders) */
  children?: FileNode[];

  /** MIME type (only for files) */
  mimeType?: string;

  /** File size in bytes (only for files) */
  size?: number;

  /** Parent folder ID */
  parentId: string | null;

  /** File path relative to project root */
  path?: string;

  /** Creation timestamp (ISO string) */
  createdAt: string;

  /** Last update timestamp (ISO string) */
  updatedAt: string;

  /** Whether child nodes are currently loading */
  isLoading?: boolean;

  /** Whether this node is soft-deleted */
  isDeleted?: boolean;

  /** Optional workspace-only decoration metadata */
  uiMeta?: {
    emphasis?: "diff" | "scope-root";
    diffStatus?: string | null;
    badge?: string | null;
  } | null;
}

/**
 * FileAPIResponse - Response from file list API
 */
export interface FileAPIResponse {
  id: string;
  name: string;
  type: "folder" | "file" | "notebook";
  folder_kind?: string;
  latex?: {
    mainFileId?: string | null;
  } | null;
  mime_type?: string;
  size?: number;
  parent_id: string | null;
  path?: string;
  project_id?: string;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
}

/**
 * FileTreeResponse - Response from file tree API
 */
export interface FileTreeResponse {
  files: FileAPIResponse[];
  total: number;
}

/**
 * FileSearchItem - Result item from file search API
 */
export interface FileSearchItem {
  id: string;
  path: string;
  name: string;
  type: "folder" | "file" | "notebook";
  size?: number;
  mime_type?: string;
  updated_at?: string;
}

/**
 * FileSearchResponse - Response from file search API
 */
export interface FileSearchResponse {
  items: FileSearchItem[];
  total: number;
  truncated: boolean;
}

/**
 * FileSearchParams - Request params for file search API
 */
export interface FileSearchParams {
  pattern: string;
  dir_path?: string;
  case_sensitive?: boolean;
  include?: string;
  include_hidden?: boolean;
  include_folders?: boolean;
  sort_by?: string;
  sort_order?: string;
  limit?: number;
}

/**
 * UploadTask - Represents an ongoing file upload
 */
export interface UploadTask {
  /** Unique upload task ID */
  id: string;

  /** Original file name */
  fileName: string;

  /** File size in bytes */
  fileSize: number;

  /** MIME type */
  mimeType: string;

  /** Upload status */
  status: "pending" | "uploading" | "completed" | "error" | "cancelled";

  /** Upload progress (0-100) */
  progress: number;

  /** Error message if status is 'error' */
  error?: string;

  /** Parent folder ID */
  parentId: string | null;

  /** Created file node (if upload completed) */
  createdFile?: FileNode;
}

/**
 * UploadUrlInfo - Presigned upload URL info
 */
export interface UploadUrlInfo {
  partNumber: number;
  url: string;
}

/**
 * MultipartUploadInit - Response from initiating multipart upload
 * Matches backend InitUploadResponse
 */
export interface MultipartUploadInit {
  taskId: string;
  uploadUrls: UploadUrlInfo[];
  chunkSize: number;
  totalChunks: number;
}

/**
 * UploadPart - Part info for completing multipart upload
 */
export interface UploadPart {
  partNumber: number;
  etag: string;
}

/**
 * CreateFolderRequest - Request body for creating a folder
 */
export interface CreateFolderRequest {
  name: string;
  parent_id?: string | null;
}

/**
 * RenameRequest - Request body for renaming a file/folder
 * Matches backend FileRename schema
 */
export interface RenameRequest {
  name: string;
}

/**
 * MoveRequest - Request body for moving files/folders
 */
export interface MoveRequest {
  file_ids: string[];
  target_parent_id: string | null;
}

/**
 * DeleteRequest - Request body for deleting files/folders
 */
export interface DeleteRequest {
  file_ids: string[];
  permanent?: boolean;
}

/**
 * ClipboardAction - Type of clipboard operation
 */
export type ClipboardAction = "copy" | "cut";

/**
 * ClipboardData - Data stored in clipboard for file operations
 */
export interface ClipboardData {
  action: ClipboardAction;
  fileIds: string[];
  sourceParentId: string | null;
}

/**
 * Transform API response to FileNode
 */
export function transformToFileNode(response: FileAPIResponse): FileNode {
  return {
    id: response.id,
    name: response.name,
    type: response.type,
    folderKind: response.folder_kind,
    latex: response.latex,
    mimeType: response.mime_type,
    size: response.size,
    parentId: response.parent_id,
    path: response.path,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
    isDeleted: response.is_deleted,
    children: response.type === "folder" ? [] : undefined,
  };
}

/**
 * Build file tree from flat list
 */
export function buildFileTree(files: FileAPIResponse[] | undefined | null): FileNode[] {
  // Defensive check: return empty array if files is not a valid array
  if (!files || !Array.isArray(files)) {
    return [];
  }

  const nodeMap = new Map<string, FileNode>();
  const roots: FileNode[] = [];

  // First pass: create all nodes
  for (const file of files) {
    nodeMap.set(file.id, transformToFileNode(file));
  }

  // Second pass: build tree structure
  for (const file of files) {
    const node = nodeMap.get(file.id)!;
    if (file.parent_id && nodeMap.has(file.parent_id)) {
      const parent = nodeMap.get(file.parent_id)!;
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children: folders first, then alphabetically
  const sortNodes = (nodes: FileNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children) {
        sortNodes(node.children);
      }
    }
  };

  sortNodes(roots);
  return roots;
}

/**
 * Find node by ID in tree
 */
export function findNodeById(nodes: FileNode[], id: string): FileNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/**
 * Get full path of a node
 */
export function getNodePath(nodes: FileNode[], id: string): string {
  const parts: string[] = [];

  const find = (searchNodes: FileNode[], targetId: string): boolean => {
    for (const node of searchNodes) {
      if (node.id === targetId) {
        parts.push(node.name);
        return true;
      }
      if (node.children) {
        if (find(node.children, targetId)) {
          parts.unshift(node.name);
          return true;
        }
      }
    }
    return false;
  };

  find(nodes, id);
  return "/" + parts.join("/");
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Get MIME type from file extension
 */
export function getMimeTypeFromExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    // Documents
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",

    // Text
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",

    // Code
    js: "text/javascript",
    ts: "text/typescript",
    jsx: "text/javascript",
    tsx: "text/typescript",
    json: "application/json",
    html: "text/html",
    css: "text/css",
    py: "text/x-python",
    java: "text/x-java-source",
    c: "text/x-c",
    cpp: "text/x-c++",
    h: "text/x-c",
    hpp: "text/x-c++",
    rs: "text/x-rust",
    go: "text/x-go",
    sh: "text/x-shellscript",
    yaml: "text/yaml",
    yml: "text/yaml",
    xml: "application/xml",
    sql: "application/sql",

    // Images
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    bmp: "image/bmp",

    // Audio
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",

    // Video
    mp4: "video/mp4",
    webm: "video/webm",
    avi: "video/x-msvideo",

    // Archives
    zip: "application/zip",
    tar: "application/x-tar",
    gz: "application/gzip",
    "7z": "application/x-7z-compressed",
    rar: "application/x-rar-compressed",

    // Notebook
    ipynb: "application/x-ipynb+json",
    dsnb: "application/x-deepscientist-notebook",
  };

  return mimeMap[ext || ""] || "application/octet-stream";
}
