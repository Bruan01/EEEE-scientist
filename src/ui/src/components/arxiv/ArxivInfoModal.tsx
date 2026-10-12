"use client";

import * as React from "react";
import { AlertCircle, ClipboardCopy, ExternalLink, Loader2 } from "lucide-react";
import type { ArxivPaper } from "@/lib/types/arxiv";
import { Modal, ModalFooter } from "@/components/ui/modal";
import MarkdownRenderer from "@/lib/plugins/markdown-viewer/components/MarkdownRenderer";
import { getArxivSummaryDisplayMarkdown, hasArxivOverview } from "@/lib/arxiv-summary";
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
    default:
      return "Import failed";
  }
}

function formatDate(value: string): string {
  if (!value) return "-";
  const [date] = value.split("T");
  return date || value;
}

function formatSummarySource(value?: string | null): string {
  const normalized = String(value || "").trim().toLowerCase()
  if (!normalized) return "Unknown"
  if (normalized.startsWith("alphaxiv")) return "AlphaXiv"
  if (normalized === "quest_arxiv_library") return "Quest cache"
  if (normalized === "arxiv_api") return "arXiv API"
  if (normalized.startsWith("arxiv_")) return "arXiv"
  return normalized.replace(/_/g, " ")
}

interface ArxivInfoModalProps {
  open: boolean;
  onClose: () => void;
  paper: ArxivPaper | null;
  errorCode?: string;
  onCopyBibtex?: () => void;
  onOpenArxiv?: () => void;
}

export function ArxivInfoModal({
  open,
  onClose,
  paper,
  errorCode,
  onCopyBibtex,
  onOpenArxiv,
}: ArxivInfoModalProps) {
  const isProcessing = paper?.status === "processing";
  const isFailed = paper?.status === "failed" || Boolean(errorCode);
  const isMetadataPending = paper?.metadataStatus === "pending";
  const statusLabel = isFailed
    ? "Failed"
    : isProcessing
    ? "Processing"
    : isMetadataPending
    ? "Metadata pending"
    : "Imported";
  const statusClass = isFailed
    ? "bg-red-500/15 text-red-600"
    : isProcessing || isMetadataPending
    ? "bg-amber-500/15 text-amber-700"
    : "bg-emerald-500/15 text-emerald-700";
  const title = paper?.title || paper?.displayName || paper?.arxivId || "Paper info";
  const authors =
    paper?.authors && paper.authors.length > 0 ? paper.authors.join(", ") : "Unknown authors";
  const categories =
    paper?.categories && paper.categories.length > 0 ? paper.categories.join(", ") : "-";
  const publishedAt = paper ? formatDate(paper.publishedAt) : "-";
  const summarySource = formatSummarySource(paper?.summarySource);
  const metadataSource = formatSummarySource(paper?.metadataSource);
  const summaryMarkdown = getArxivSummaryDisplayMarkdown(paper);
  const showOverview = hasArxivOverview(paper);
  const canShowActions = Boolean(paper && (onCopyBibtex || onOpenArxiv));

  return (
    <Modal open={open} onClose={onClose} title="Paper summary" size="lg">
      {paper ? (
        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-base font-semibold text-soft-text-primary">{title}</div>
              <div className="inline-flex items-center rounded-full border border-soft-border bg-soft-bg-elevated/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-soft-text-secondary">
                Summary source: {summarySource}
              </div>
              <div className="inline-flex items-center rounded-full border border-soft-border bg-soft-bg-elevated/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-soft-text-secondary">
                Metadata source: {metadataSource}
              </div>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                statusClass
              )}
            >
              {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              {statusLabel}
            </span>
          </div>

          <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-2 text-xs">
            <div className="text-soft-text-secondary">Authors</div>
            <div className="min-w-0 text-soft-text-primary">{authors}</div>
            <div className="text-soft-text-secondary">Published</div>
            <div className="text-soft-text-primary">{publishedAt}</div>
            <div className="text-soft-text-secondary">Categories</div>
            <div className="min-w-0 text-soft-text-primary">{categories}</div>
            <div className="text-soft-text-secondary">arXiv ID</div>
            <div className="text-soft-text-primary">{paper.arxivId || "-"}</div>
          </div>

          <div className="rounded-md border border-soft-border bg-soft-bg-elevated/40 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-soft-text-secondary">
              {showOverview ? "Summary" : "Abstract"}
            </div>
            <div className="mt-1 text-xs leading-relaxed text-soft-text-primary">
              {showOverview ? (
                <MarkdownRenderer
                  content={summaryMarkdown}
                  className="text-xs leading-relaxed text-soft-text-primary"
                />
              ) : (
                paper.abstract || "No abstract available."
              )}
            </div>
          </div>

          {showOverview && paper.abstract ? (
            <div className="rounded-md border border-soft-border bg-soft-bg-elevated/40 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-soft-text-secondary">Abstract</div>
              <div className="mt-1 text-xs leading-relaxed text-soft-text-primary">
                {paper.abstract}
              </div>
            </div>
          ) : null}

          {isFailed && errorCode ? (
            <div className="flex items-center gap-1 text-[11px] text-red-600">
              <AlertCircle className="h-3.5 w-3.5" />
              {formatError(errorCode)}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="text-sm text-soft-text-secondary">
          Select a paper to view details.
        </div>
      )}

      {canShowActions ? (
        <ModalFooter className="-mx-6 -mb-4 mt-4">
          {onCopyBibtex ? (
            <button
              type="button"
              onClick={onCopyBibtex}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border border-soft-border bg-white px-3 py-1.5",
                "text-xs text-soft-text-primary transition-colors",
                "hover:bg-soft-bg-elevated"
              )}
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
              Copy BibTeX
            </button>
          ) : null}
          {onOpenArxiv ? (
            <button
              type="button"
              onClick={onOpenArxiv}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border border-soft-border bg-white px-3 py-1.5",
                "text-xs text-soft-text-primary transition-colors",
                "hover:bg-soft-bg-elevated"
              )}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open arXiv
            </button>
          ) : null}
        </ModalFooter>
      ) : null}
    </Modal>
  );
}

export default ArxivInfoModal;
