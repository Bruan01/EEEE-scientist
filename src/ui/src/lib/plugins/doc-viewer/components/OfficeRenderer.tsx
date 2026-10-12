/**
 * Office Document Renderer Component
 *
 * Renders Office documents using iframe-based preview.
 * Provides fallback download option for unsupported formats.
 *
 * Note: In production, you would use @cyntler/react-doc-viewer
 * This is a simplified implementation that relies on server-side
 * conversion or Office Online/Google Docs preview.
 */

"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/useI18n";
import {
  FileQuestion,
  Download,
  ExternalLink,
  Loader2,
  AlertTriangle,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface OfficeRendererProps {
  src?: string;
  fileName: string;
  fileType: string;
  onError?: (error: string) => void;
  onDownload?: () => void;
  className?: string;
}

// ============================================================
// Document Type Icons
// ============================================================

const DOC_TYPE_INFO: Record<
  string,
  { icon: string; color: string; labelKey: string }
> = {
  docx: { icon: "W", color: "bg-blue-600", labelKey: "word_document" },
  doc: { icon: "W", color: "bg-blue-600", labelKey: "word_document" },
  xlsx: { icon: "X", color: "bg-green-600", labelKey: "excel_spreadsheet" },
  xls: { icon: "X", color: "bg-green-600", labelKey: "excel_spreadsheet" },
  pptx: { icon: "P", color: "bg-primary", labelKey: "powerpoint_presentation" },
  ppt: { icon: "P", color: "bg-primary", labelKey: "powerpoint_presentation" },
  odt: { icon: "OD", color: "bg-blue-500", labelKey: "open_document_text" },
  ods: { icon: "OD", color: "bg-green-500", labelKey: "open_document_spreadsheet" },
  odp: { icon: "OD", color: "bg-primary", labelKey: "open_document_presentation" },
};

// ============================================================
// Office Renderer Component
// ============================================================

export default function OfficeRenderer({
  src,
  fileName,
  fileType,
  onError,
  onDownload,
  className,
}: OfficeRendererProps) {
  const { t } = useI18n("doc_viewer");
  const [loading, setLoading] = useState(true);
  const [renderError, setRenderError] = useState(false);

  const docInfo = DOC_TYPE_INFO[fileType.toLowerCase()] || {
    icon: "?",
    color: "bg-gray-600",
    labelKey: "document",
  };

  // Handle iframe load
  const handleLoad = useCallback(() => {
    setLoading(false);
  }, []);

  // Handle iframe error
  const handleError = useCallback(() => {
    setLoading(false);
    setRenderError(true);
    onError?.(t("preview_load_failed"));
  }, [onError, t]);

  // Build preview URL
  // Option 1: Use Office Online viewer (for public URLs)
  // Option 2: Use Google Docs viewer
  // Option 3: Server-side conversion to PDF/HTML
  const getPreviewUrl = (documentUrl: string): string | null => {
    if (!documentUrl) return null;
    // For demo purposes, we'll show a fallback
    // In production, you'd convert the document server-side
    // or use one of these services:

    // Office Online (requires public URL):
    // return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(documentUrl)}`;

    // Google Docs viewer (requires public URL):
    // return `https://docs.google.com/viewer?url=${encodeURIComponent(documentUrl)}&embedded=true`;

    return null; // No preview available
  };

  const previewUrl = src ? getPreviewUrl(src) : null;

  // Download handler
  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload();
      return;
    }
    if (!src) return;
    const link = document.createElement("a");
    link.href = src;
    link.download = fileName;
    link.click();
  }, [onDownload, src, fileName]);

  // If preview is available, show iframe
  if (previewUrl && !renderError) {
    return (
      <div className={cn("relative w-full h-full", className)}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <div className="text-sm text-muted-foreground">{t("preview_loading")}</div>
            </div>
          </div>
        )}
        <iframe
          src={previewUrl}
          className="w-full h-full border-0"
          onLoad={handleLoad}
          onError={handleError}
          title={fileName}
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>
    );
  }

  // Fallback: Show document info with download option
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center h-full text-center p-8",
        className
      )}
    >
      {/* Document icon */}
      <div
        className={cn(
          "w-24 h-24 rounded-lg flex items-center justify-center text-4xl font-bold text-white mb-6",
          docInfo.color
        )}
      >
        {docInfo.icon}
      </div>

      {/* Document info */}
      <h2 className="text-xl font-semibold text-foreground mb-2">{fileName}</h2>
      <p className="text-muted-foreground mb-6">{t(docInfo.labelKey)}</p>

      {/* Warning message */}
      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 mb-6">
        <AlertTriangle className="w-4 h-4" />
        <span>{t("preview_unavailable")}</span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Download className="w-4 h-4" />
          {t("download")}
        </button>
      </div>

      {/* Help text */}
      <p className="text-xs text-muted-foreground mt-8 max-w-md">
        {t("help_text")}
      </p>
    </div>
  );
}
