"use client";

import * as React from "react";
import { Check, X, Loader2, XCircle } from "lucide-react";
import { FileIcon } from "./FileIcon";
import { useUploadTasks, useFileTreeStore } from "@/lib/stores/file-tree";
import { formatFileSize } from "@/lib/types/file";
import { cn } from "@/lib/utils";

/**
 * Progress bar component
 */
function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-1 w-full bg-soft-border rounded-full overflow-hidden",
        className
      )}
    >
      <div
        className="h-full bg-soft-primary transition-all duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/**
 * UploadProgress - Shows progress of ongoing file uploads
 *
 * Features:
 * - List of upload tasks with progress bars
 * - Status icons (loading, success, error)
 * - Cancel button for active uploads
 * - Clear completed uploads button
 */
export function UploadProgress() {
  const uploadTasks = useUploadTasks();
  const { cancelUpload, clearCompletedUploads } = useFileTreeStore();

  // Filter out completed/cancelled tasks after a delay
  const visibleTasks = uploadTasks.filter(
    (task) => task.status !== "cancelled"
  );

  if (visibleTasks.length === 0) {
    return null;
  }

  const completedCount = visibleTasks.filter(
    (t) => t.status === "completed"
  ).length;
  const activeCount = visibleTasks.filter(
    (t) => t.status === "uploading" || t.status === "pending"
  ).length;

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-soft-bg-base border border-soft-border rounded-soft-md shadow-soft-lg z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-soft-border">
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <Loader2 className="h-4 w-4 animate-spin text-soft-primary" />
          )}
          <span className="font-medium text-sm text-soft-text-primary">
            {activeCount > 0 ? "Uploading" : "Upload Complete"}
          </span>
        </div>
        <span className="text-sm text-soft-text-muted">
          {completedCount}/{visibleTasks.length}
        </span>
      </div>

      {/* Upload list */}
      <div className="max-h-48 overflow-auto p-2 space-y-2">
        {visibleTasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-3 p-2 bg-soft-bg-elevated rounded-soft-sm"
          >
            {/* File icon */}
            <FileIcon
              type="file"
              name={task.fileName}
              mimeType={task.mimeType}
              className="shrink-0"
            />

            {/* File info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate text-soft-text-primary">
                {task.fileName}
              </p>
              <div className="flex items-center gap-2">
                <ProgressBar value={task.progress} />
                <span className="text-xs text-soft-text-muted shrink-0">
                  {task.status === "completed"
                    ? formatFileSize(task.fileSize)
                    : `${task.progress}%`}
                </span>
              </div>
              {task.error && (
                <p className="text-xs text-red-500 mt-1">{task.error}</p>
              )}
            </div>

            {/* Status icon */}
            <div className="shrink-0">
              {task.status === "completed" && (
                <Check className="h-4 w-4 text-green-500" />
              )}
              {task.status === "error" && (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              {task.status === "uploading" && (
                <button
                  onClick={() => cancelUpload(task.id)}
                  className="p-1 hover:bg-soft-bg-base rounded-full transition-colors"
                  title="Cancel upload"
                >
                  <X className="h-3 w-3 text-soft-text-muted" />
                </button>
              )}
              {task.status === "pending" && (
                <div className="h-4 w-4 rounded-full border-2 border-soft-border border-t-soft-primary animate-spin" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer - clear completed */}
      {completedCount > 0 && activeCount === 0 && (
        <div className="px-4 py-2 border-t border-soft-border">
          <button
            onClick={clearCompletedUploads}
            className="text-sm text-soft-primary hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

export default UploadProgress;
