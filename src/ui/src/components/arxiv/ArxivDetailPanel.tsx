"use client";
import * as React from "react";
import { AlertCircle, ChevronDown, ClipboardCopy, ExternalLink, FileText, Loader2 } from "lucide-react";
import type { ArxivPaper } from "@/lib/types/arxiv";
import MarkdownRenderer from "@/lib/plugins/markdown-viewer/components/MarkdownRenderer";
import { getArxivSummaryDisplayMarkdown, hasArxivOverview } from "@/lib/arxiv-summary";
import { cn } from "@/lib/utils";

function formatError(code: string): string {
  switch (code) {
    case "invalid_id":
      return "Invalid ID";
    case "metadata_failed":
      return "Not found or metadata failed";
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

interface ArxivDetailPanelProps {
  paper: ArxivPaper | null;
  errorCode?: string;
  onOpenPdf?: () => void;
  onOpenArxiv?: () => void;
  onCopyBibtex?: () => void;
}

export function ArxivDetailPanel({
  paper,
  errorCode,
  onOpenPdf,
  onOpenArxiv,
  onCopyBibtex,
}: ArxivDetailPanelProps) {
  if (!paper) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-xs text-[var(--text-muted-on-dark)]">
        Select a paper to view details.
      </div>
    );
  }

  const isProcessing = paper.status === "processing";
  const isFailed = paper.status === "failed" || Boolean(errorCode);
  const canOpen = Boolean(paper.fileId) && paper.status === "ready";
  const title = paper.title || paper.displayName || paper.arxivId || "Untitled";
  const authors =
    paper.authors && paper.authors.length > 0 ? paper.authors.join(", ") : "Unknown authors";
  const categories =
    paper.categories && paper.categories.length > 0 ? paper.categories.join(", ") : "-";
  const publishedAt = formatDate(paper.publishedAt);
  const statusLabel = isFailed ? "Failed" : isProcessing ? "Processing" : "Imported";
  const statusClass = isFailed
    ? "bg-red-500/20 text-red-200"
    : isProcessing
    ? "bg-amber-500/20 text-amber-100"
    : "bg-emerald-500/20 text-emerald-100";
  const summaryMarkdown = getArxivSummaryDisplayMarkdown(paper);
  const showOverview = hasArxivOverview(paper);
  const [isExpanded, setIsExpanded] = React.useState(true);

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3 flex min-h-0 max-h-[40vh] flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted-on-dark)]">
          Item Details
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
              statusClass
            )}
          >
            {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {statusLabel}
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Collapse item details" : "Expand item details"}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md",
              "text-[var(--text-muted-on-dark)] transition-colors",
              "hover:bg-white/10 hover:text-[var(--text-on-dark)]"
            )}
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", isExpanded ? "rotate-0" : "-rotate-90")}
            />
          </button>
        </div>
      </div>

      {isExpanded ? (
        <>
          <div
            className="mt-2 w-full min-w-0 shrink-0 text-sm font-semibold text-[var(--text-on-dark)] line-clamp-2 break-words whitespace-normal"
            title={title}
          >
            {title}
          </div>

          <div className="mt-2 flex-1 min-h-0 space-y-2 overflow-y-auto pr-1">
            <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 text-xs">
              <div className="text-[var(--text-muted-on-dark)]">Authors</div>
              <div
                className="min-w-0 text-[var(--text-on-dark)] line-clamp-2 break-words whitespace-normal"
                title={authors}
              >
                {authors}
              </div>
              <div className="text-[var(--text-muted-on-dark)]">Published</div>
              <div className="text-[var(--text-on-dark)]">{publishedAt}</div>
              <div className="text-[var(--text-muted-on-dark)]">Categories</div>
              <div
                className="min-w-0 text-[var(--text-on-dark)] line-clamp-2 break-words whitespace-normal"
                title={categories}
              >
                {categories}
              </div>
              <div className="text-[var(--text-muted-on-dark)]">arXiv ID</div>
              <div className="text-[var(--text-on-dark)]">{paper.arxivId || "-"}</div>
            </div>

            <div className="rounded-md border border-white/10 bg-white/[0.05] p-2">
              <div className="text-[11px] font-semibold text-[var(--text-muted-on-dark)]">
                {showOverview ? "Summary" : "Abstract"}
              </div>
              <div className="mt-1 text-xs leading-relaxed text-[var(--text-on-dark)]">
                {showOverview ? (
                  <MarkdownRenderer
                    content={summaryMarkdown}
                    className="text-xs leading-relaxed text-[var(--text-on-dark)]"
                  />
                ) : (
                  paper.abstract || "No abstract available."
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenPdf}
              disabled={!canOpen || !onOpenPdf}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1",
                "text-[11px] text-[var(--text-on-dark)] transition-colors",
                "hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              Open PDF
            </button>
            <button
              type="button"
              onClick={onCopyBibtex}
              disabled={!onCopyBibtex}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1",
                "text-[11px] text-[var(--text-on-dark)] transition-colors",
                "hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
              Copy BibTeX
            </button>
            <button
              type="button"
              onClick={onOpenArxiv}
              disabled={!onOpenArxiv}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1",
                "text-[11px] text-[var(--text-on-dark)] transition-colors",
                "hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open arXiv
            </button>
          </div>

          {isFailed && errorCode ? (
            <div className="mt-2 flex items-center gap-1 shrink-0 text-[11px] text-red-300">
              <AlertCircle className="h-3.5 w-3.5" />
              {formatError(errorCode)}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default ArxivDetailPanel;
