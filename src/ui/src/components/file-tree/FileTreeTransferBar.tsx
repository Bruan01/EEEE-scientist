"use client";

import * as React from "react";
import { Check, Loader2, XCircle } from "lucide-react";
import { useFileTreeStore, useTransferTasks, useUploadTasks, type TransferTask } from "@/lib/stores/file-tree";
import type { UploadTask } from "@/lib/types/file";
import { cn } from "@/lib/utils";

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="file-tree-transfer-progress">
      <div
        className="file-tree-transfer-progress-fill"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export interface FileTreeTransferBarProps {
  className?: string;
}

export function FileTreeTransferBar({ className }: FileTreeTransferBarProps) {
  const uploadTasks = useUploadTasks();
  const transferTasks = useTransferTasks();
  const { clearCompletedUploads, clearCompletedTransfers } = useFileTreeStore();

  const activeUploads = uploadTasks.filter(
    (task) => task.status === "uploading" || task.status === "pending"
  );
  const completedUploads = uploadTasks.filter((task) => task.status === "completed");
  const erroredUploads = uploadTasks.filter((task) => task.status === "error");
  const cancelledUploads = uploadTasks.filter((task) => task.status === "cancelled");
  const activeTransfers = transferTasks.filter((task: TransferTask) => task.status === "in_progress");
  const completedTransfers = transferTasks.filter((task: TransferTask) => task.status !== "in_progress");
  const hasUploadSummary =
    completedUploads.length > 0 || erroredUploads.length > 0 || cancelledUploads.length > 0;

  if (uploadTasks.length === 0 && transferTasks.length === 0) {
    return null;
  }

  const totalUploadBytes = activeUploads.reduce((sum, task) => sum + task.fileSize, 0);
  const loadedUploadBytes = activeUploads.reduce(
    (sum, task) => sum + (task.fileSize * task.progress) / 100,
    0
  );
  const uploadProgress =
    totalUploadBytes > 0 ? Math.round((loadedUploadBytes / totalUploadBytes) * 100) : 0;

  const showClear =
    activeUploads.length === 0 &&
    activeTransfers.length === 0 &&
    (hasUploadSummary || completedTransfers.length > 0);

  return (
    <div className={cn("file-tree-transfer-bar", className)}>
      <div className="file-tree-transfer-header">
        <span>Transfers</span>
        {showClear && (
          <button
            type="button"
            className="file-tree-transfer-clear"
            onClick={() => {
              clearCompletedUploads();
              clearCompletedTransfers();
            }}
          >
            Clear
          </button>
        )}
      </div>

      {activeUploads.length > 0 ? (
        <div className="file-tree-transfer-block">
          <div className="file-tree-transfer-row">
            <div className="file-tree-transfer-label">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{`Uploading ${activeUploads.length} file${activeUploads.length > 1 ? "s" : ""}`}</span>
            </div>
            <span className="file-tree-transfer-value">{uploadProgress}%</span>
          </div>
          <ProgressBar value={uploadProgress} />
        </div>
      ) : (
        <>
          {completedUploads.length > 0 ? (
            <div className="file-tree-transfer-row is-complete">
              <div className="file-tree-transfer-label">
                <Check className="h-3 w-3" />
                <span>{`Upload complete (${completedUploads.length})`}</span>
              </div>
            </div>
          ) : null}
          {erroredUploads.length > 0 ? (
            <div className="file-tree-transfer-row is-error">
              <div className="file-tree-transfer-label">
                <XCircle className="h-3 w-3" />
                <span>{`Upload failed (${erroredUploads.length})`}</span>
              </div>
            </div>
          ) : null}
          {cancelledUploads.length > 0 ? (
            <div className="file-tree-transfer-row is-error">
              <div className="file-tree-transfer-label">
                <XCircle className="h-3 w-3" />
                <span>{`Upload cancelled (${cancelledUploads.length})`}</span>
              </div>
            </div>
          ) : null}
        </>
      )}

      {transferTasks.map((task: TransferTask) => (
        <div
          key={task.id}
          className={cn(
            "file-tree-transfer-row",
            task.status === "completed" && "is-complete",
            task.status === "error" && "is-error"
          )}
          title={task.error || undefined}
        >
          <div className="file-tree-transfer-label">
            {task.status === "in_progress" && <Loader2 className="h-3 w-3 animate-spin" />}
            {task.status === "completed" && <Check className="h-3 w-3" />}
            {task.status === "error" && <XCircle className="h-3 w-3" />}
            <span>{task.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default FileTreeTransferBar;
