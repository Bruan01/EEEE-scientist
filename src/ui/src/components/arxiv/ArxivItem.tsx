"use client";

import * as React from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import type { ArxivPaper } from "@/lib/types/arxiv";
import { cn } from "@/lib/utils";

function formatError(code: string): string {
  switch (code) {
    case "invalid_id":
      return "Invalid ID";
    case "metadata_failed":
      return "Not found or metadata failed";
    case "metadata_pending":
      return "Metadata pending";
    case "download_failed":
      return "Download failed";
    case "already_exists":
      return "Already imported";
    case "storage_failed":
      return "Storage failed";
    case "timeout":
      return "Import timed out";
    case "import_failed":
      return "Import failed";
    default:
      return "Import failed";
  }
}

function formatYear(value: string): string {
  if (!value) return "";
  const match = value.match(/\d{4}/);
  return match ? match[0] : "";
}

interface ArxivItemProps {
  paper: ArxivPaper;
  errorCode?: string;
  isSelected?: boolean;
  onSelect?: (paper: ArxivPaper) => void;
  onOpen?: (paper: ArxivPaper) => void;
  onContextMenu?: (paper: ArxivPaper, event: React.MouseEvent) => void;
  variant?: "full" | "compact";
}

export function ArxivItem({
  paper,
  errorCode,
  isSelected = false,
  onSelect,
  onOpen,
  onContextMenu,
  variant = "full",
}: ArxivItemProps) {
  const isProcessing = paper.status === "processing";
  const isFailed = paper.status === "failed" || Boolean(errorCode);
  const isMetadataPending = paper.metadataStatus === "pending";
  const canOpen = Boolean(paper.fileId) && paper.status === "ready";
  const title = paper.title || paper.displayName || paper.arxivId || "Untitled";
  const subtitle =
    paper.authors && paper.authors.length > 0
      ? paper.authors.join(", ")
      : paper.metadataStatus === "pending"
      ? `arXiv ${paper.arxivId} | Metadata pending`
      : paper.arxivId
      ? `arXiv ${paper.arxivId}`
      : "Metadata pending";
  const year = formatYear(paper.publishedAt);
  const statusClass = isFailed
    ? "bg-red-500/20 text-red-200"
    : isProcessing || isMetadataPending
    ? "bg-amber-500/20 text-amber-100"
    : "bg-emerald-500/20 text-emerald-100";

  const handleSelect = React.useCallback(() => {
    onSelect?.(paper);
  }, [onSelect, paper]);

  const handleOpen = React.useCallback(() => {
    if (!canOpen) return;
    onOpen?.(paper);
  }, [canOpen, onOpen, paper]);

  const handlePrimaryClick = React.useCallback(() => {
    handleSelect();
    handleOpen();
  }, [handleOpen, handleSelect]);

  const compactMeta = [
    paper.authors && paper.authors.length > 0 ? paper.authors.join(", ") : subtitle,
    year,
  ]
    .filter(Boolean)
    .join(" | ");

  const compactStatusLabel = isFailed
    ? "Failed"
    : isProcessing
    ? "Processing"
    : isMetadataPending
    ? "Metadata"
    : "Ready";

  return (
    <div onContextMenu={(e) => onContextMenu?.(paper, e)}>
      <div
        className={cn(
          "rounded-md px-2 py-1.5 text-xs transition-colors",
          "hover:bg-white/5",
          isSelected && "bg-white/10 ring-1 ring-white/10",
          isFailed && !isSelected && "bg-red-500/10"
        )}
        role="button"
        tabIndex={0}
        aria-selected={isSelected}
        onClick={handlePrimaryClick}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            handleOpen();
          }
          if (event.key === " ") {
            event.preventDefault();
            handleSelect();
          }
        }}
      >
        {variant === "compact" ? (
          <div className="flex min-w-0 items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 break-words text-sm font-medium leading-5 text-[var(--text-on-dark)]">
                {title}
              </div>
              <div className="truncate text-[11px] text-[var(--text-muted-on-dark)]">
                {compactMeta}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 pt-0.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                  statusClass
                )}
              >
                {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {compactStatusLabel}
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_80px] items-center gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-[var(--text-on-dark)]">
                {title}
              </div>
              <div className="truncate text-[11px] text-[var(--text-muted-on-dark)]">
                {subtitle}
              </div>
            </div>
            <div className="text-right text-[11px] text-[var(--text-muted-on-dark)]">
              {year || "-"}
            </div>
          </div>
        )}
      </div>

      {isFailed && errorCode ? (
        <div className="mt-0.5 flex items-center gap-1 pl-2 text-[10px] text-red-300">
          <AlertCircle className="h-3 w-3" />
          {formatError(errorCode)}
        </div>
      ) : null}
    </div>
  );
}

export default ArxivItem;
