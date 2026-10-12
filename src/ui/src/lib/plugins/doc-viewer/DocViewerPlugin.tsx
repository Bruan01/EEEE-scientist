/**
 * Document Viewer Plugin Component
 *
 * @ds/plugin-doc-viewer
 *
 * Displays Office documents with:
 * - Preview for supported formats
 * - Download fallback for unsupported formats
 * - Document type detection and icons
 */

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { PluginComponentProps } from "@/lib/types/plugin";
import { useI18n } from "@/lib/i18n/useI18n";
import { cn } from "@/lib/utils";
import {
  FileSpreadsheet,
  FileText,
  Presentation,
  Download,
} from "lucide-react";
import OfficeRenderer from "./components/OfficeRenderer";

// ============================================================
// Types and Constants
// ============================================================

type DocType = "word" | "excel" | "powerpoint" | "opendocument" | "unknown";

interface DocTypeConfig {
  type: DocType;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
}

const EXTENSION_TO_TYPE: Record<string, DocTypeConfig> = {
  docx: {
    type: "word",
    icon: FileText,
    label: "Word Document",
    color: "text-blue-500",
  },
  doc: {
    type: "word",
    icon: FileText,
    label: "Word Document",
    color: "text-blue-500",
  },
  xlsx: {
    type: "excel",
    icon: FileSpreadsheet,
    label: "Excel Spreadsheet",
    color: "text-green-500",
  },
  xls: {
    type: "excel",
    icon: FileSpreadsheet,
    label: "Excel Spreadsheet",
    color: "text-green-500",
  },
  pptx: {
    type: "powerpoint",
    icon: Presentation,
    label: "PowerPoint",
    color: "text-primary",
  },
  ppt: {
    type: "powerpoint",
    icon: Presentation,
    label: "PowerPoint",
    color: "text-primary",
  },
  odt: {
    type: "opendocument",
    icon: FileText,
    label: "OpenDocument Text",
    color: "text-blue-400",
  },
  ods: {
    type: "opendocument",
    icon: FileSpreadsheet,
    label: "OpenDocument Spreadsheet",
    color: "text-green-400",
  },
  odp: {
    type: "opendocument",
    icon: Presentation,
    label: "OpenDocument Presentation",
    color: "text-primary",
  },
};

const DEFAULT_TYPE_CONFIG: DocTypeConfig = {
  type: "unknown",
  icon: FileText,
  label: "Document",
  color: "text-muted-foreground",
};

// ============================================================
// Helper Functions
// ============================================================

function getFileExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return ext;
}

function getDocTypeConfig(fileName: string): DocTypeConfig {
  const ext = getFileExtension(fileName);
  return EXTENSION_TO_TYPE[ext] || DEFAULT_TYPE_CONFIG;
}

function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================
// Main Component
// ============================================================

export default function DocViewerPlugin({
  context,
  tabId,
  setDirty,
  setTitle,
}: PluginComponentProps) {
  const { t } = useI18n("doc_viewer");
  // State
  const [error, setError] = useState<string | null>(null);

  // Get file name and type
  const fileName = context.resourceName || context.resourcePath || "Document";
  const fileExtension = getFileExtension(fileName);
  const docTypeConfig = useMemo(() => getDocTypeConfig(fileName), [fileName]);
  const fileSize = context.customData?.size as number | undefined;

  // Set tab title
  useEffect(() => {
    setTitle(fileName);
  }, [fileName, setTitle]);

  // Clear errors when switching documents
  useEffect(() => {
    setError(null);
  }, [context.resourceId]);

  // Handle render error
  const handleRenderError = useCallback((err: string) => {
    setError(err);
  }, []);

  // Download handler
  const handleDownload = useCallback(() => {
    if (!context.resourceId) return;

    (async () => {
      try {
        const { downloadFileById } = await import("@/lib/api/files");
        await downloadFileById(context.resourceId!, fileName);
      } catch (err) {
        console.error("Failed to download document:", err);
        setError("Failed to download document");
      }
    })();
  }, [context.resourceId, fileName]);

  const IconComponent = docTypeConfig.icon;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <IconComponent className={cn("w-4 h-4", docTypeConfig.color)} />
          <span className="text-sm text-foreground">{fileName}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase">
            {fileExtension}
          </span>
          {fileSize && (
            <span className="text-xs text-muted-foreground">
              {formatFileSize(fileSize)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Download button */}
          <button
            onClick={handleDownload}
            className="p-2 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title={t("download_document")}
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {context.resourceId ? (
          <OfficeRenderer
            src=""
            fileName={fileName}
            fileType={fileExtension}
            onError={handleRenderError}
            onDownload={handleDownload}
          />
        ) : (
          // No document selected
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <IconComponent className={cn("w-16 h-16 mb-4", docTypeConfig.color)} />
            <h2 className="text-lg font-medium text-foreground mb-2">
              No document selected
            </h2>
            <p className="text-sm text-muted-foreground">
              Select a document file to view it here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
