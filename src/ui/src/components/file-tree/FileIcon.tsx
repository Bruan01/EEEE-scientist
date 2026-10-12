"use client";

import * as React from "react";
import {
  File,
  FileText,
  FileCode,
  FileJson,
  FileImage,
  Folder,
  FolderOpen,
  FileSpreadsheet,
  FileVideo,
  FileAudio,
  FileArchive,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PngIcon } from "@/components/ui/png-icon";

/**
 * FileIcon props
 */
export interface FileIconProps {
  /** Node type */
  type: "folder" | "file" | "notebook";

  /** Special folder kind (e.g. 'latex') */
  folderKind?: string;

  /** MIME type (for files) */
  mimeType?: string;

  /** File name (used to infer type from extension) */
  name?: string;

  /** Whether the folder is open */
  isOpen?: boolean;

  /** Additional class names */
  className?: string;
}

/**
 * Icon mapping by MIME type
 */
const MIME_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  // Documents
  "application/pdf": FileText,
  "application/msword": FileText,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": FileText,

  // Spreadsheets
  "application/vnd.ms-excel": FileSpreadsheet,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": FileSpreadsheet,
  "text/csv": FileSpreadsheet,

  // Text
  "text/plain": FileText,
  "text/markdown": BookOpen,
  "text/x-markdown": BookOpen,

  // Code
  "text/javascript": FileCode,
  "text/typescript": FileCode,
  "application/javascript": FileCode,
  "application/typescript": FileCode,
  "text/x-python": FileCode,
  "text/x-java-source": FileCode,
  "text/html": FileCode,
  "text/css": FileCode,
  "text/x-rust": FileCode,
  "text/x-go": FileCode,
  "text/x-c": FileCode,
  "text/x-c++": FileCode,
  "text/yaml": FileCode,
  "application/xml": FileCode,
  "application/sql": FileCode,

  // JSON
  "application/json": FileJson,

  // Images
  "image/png": FileImage,
  "image/jpeg": FileImage,
  "image/gif": FileImage,
  "image/webp": FileImage,
  "image/svg+xml": FileImage,
  "image/bmp": FileImage,

  // Video
  "video/mp4": FileVideo,
  "video/webm": FileVideo,
  "video/x-msvideo": FileVideo,

  // Audio
  "audio/mpeg": FileAudio,
  "audio/wav": FileAudio,
  "audio/ogg": FileAudio,

  // Archives
  "application/zip": FileArchive,
  "application/x-tar": FileArchive,
  "application/gzip": FileArchive,
  "application/x-7z-compressed": FileArchive,
  "application/x-rar-compressed": FileArchive,

  // Notebook
  "application/x-ipynb+json": FileCode,
  "application/x-blocksuite-notebook": BookOpen,
};

/**
 * Icon mapping by file extension
 */
const EXT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  // Documents
  ".pdf": FileText,
  ".doc": FileText,
  ".docx": FileText,

  // Spreadsheets
  ".xls": FileSpreadsheet,
  ".xlsx": FileSpreadsheet,
  ".csv": FileSpreadsheet,

  // Text
  ".txt": FileText,
  ".md": BookOpen,
  ".markdown": BookOpen,
  ".mdx": BookOpen,

  // Code
  ".js": FileCode,
  ".jsx": FileCode,
  ".ts": FileCode,
  ".tsx": FileCode,
  ".py": FileCode,
  ".java": FileCode,
  ".c": FileCode,
  ".cpp": FileCode,
  ".h": FileCode,
  ".hpp": FileCode,
  ".rs": FileCode,
  ".go": FileCode,
  ".html": FileCode,
  ".css": FileCode,
  ".scss": FileCode,
  ".sass": FileCode,
  ".less": FileCode,
  ".yaml": FileCode,
  ".yml": FileCode,
  ".xml": FileCode,
  ".sql": FileCode,
  ".sh": FileCode,
  ".bash": FileCode,

  // JSON
  ".json": FileJson,

  // Images
  ".png": FileImage,
  ".jpg": FileImage,
  ".jpeg": FileImage,
  ".gif": FileImage,
  ".webp": FileImage,
  ".svg": FileImage,
  ".bmp": FileImage,
  ".ico": FileImage,

  // Video
  ".mp4": FileVideo,
  ".webm": FileVideo,
  ".avi": FileVideo,
  ".mov": FileVideo,

  // Audio
  ".mp3": FileAudio,
  ".wav": FileAudio,
  ".ogg": FileAudio,
  ".flac": FileAudio,

  // Archives
  ".zip": FileArchive,
  ".tar": FileArchive,
  ".gz": FileArchive,
  ".7z": FileArchive,
  ".rar": FileArchive,

  // Notebook
  ".ipynb": FileCode,
  ".dsnb": BookOpen,
  ".notebook": BookOpen,
  ".ds": BookOpen,
};

/**
 * Get icon component for a file
 */
function getFileIcon(
  mimeType?: string,
  name?: string
): React.ComponentType<{ className?: string }> {
  // Try MIME type first
  if (mimeType && MIME_ICONS[mimeType]) {
    return MIME_ICONS[mimeType];
  }

  // Try file extension
  if (name) {
    const lastDot = name.lastIndexOf(".");
    if (lastDot >= 0) {
      const ext = name.slice(lastDot).toLowerCase();
      if (EXT_ICONS[ext]) {
        return EXT_ICONS[ext];
      }
    }
  }

  // Default icon
  return File;
}

/**
 * FileIcon - Displays an icon based on file type
 *
 * Uses MIME type or file extension to determine the appropriate icon.
 * Falls back to a generic file icon if type cannot be determined.
 */
export function FileIcon({
  type,
  folderKind,
  mimeType,
  name,
  isOpen = false,
  className,
}: FileIconProps) {
  if (type === "folder" && folderKind === "latex") {
    return (
      <span
        className={cn(
          "h-4 w-4 shrink-0 rounded-[4px] border border-dashed border-current/35",
          "flex items-center justify-center text-[9px] font-semibold tracking-tight",
          className
        )}
        aria-label="LaTeX folder"
        title="LaTeX project"
      >
        TeX
      </span>
    );
  }

  const Icon =
    type === "folder" ? (isOpen ? FolderOpen : Folder) : getFileIcon(mimeType, name);

  return (
    Icon === File ? (
      <PngIcon
        name="File"
        size={16}
        className={cn(
          "h-4 w-4 shrink-0",
          type === "folder" && "text-soft-accent",
          className
        )}
        fallback={
          <Icon
            className={cn(
              "h-4 w-4 shrink-0",
              type === "folder" && "text-soft-accent",
              className
            )}
          />
        }
      />
    ) : (
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          type === "folder" && "text-soft-accent",
          className
        )}
      />
    )
  );
}

export default FileIcon;
