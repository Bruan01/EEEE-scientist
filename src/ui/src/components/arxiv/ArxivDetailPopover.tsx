"use client";

import * as React from "react";
import { ExternalLink, ClipboardCopy } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { ArxivPaper } from "@/lib/types/arxiv";
import MarkdownRenderer from "@/lib/plugins/markdown-viewer/components/MarkdownRenderer";
import { getArxivSummaryDisplayMarkdown, hasArxivOverview } from "@/lib/arxiv-summary";
import { generateBibTeX } from "@/lib/utils/bibtex";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

interface ArxivDetailPopoverProps {
  paper: ArxivPaper;
  trigger: React.ReactNode;
  disabled?: boolean;
}

export function ArxivDetailPopover({ paper, trigger, disabled = false }: ArxivDetailPopoverProps) {
  const { addToast } = useToast();

  const handleCopy = React.useCallback(async () => {
    const bibtex = generateBibTeX(paper);
    const success = await copyToClipboard(bibtex);
    if (success) {
      addToast({
        type: "success",
        title: "BibTeX copied",
        description: paper.title || paper.arxivId,
        duration: 1800,
      });
    } else {
      addToast({
        type: "error",
        title: "Copy failed",
        description: "Please try again",
        duration: 1800,
      });
    }
  }, [addToast, paper]);

  const handleOpen = React.useCallback(() => {
    if (!paper.arxivId) return;
    window.open(`https://arxiv.org/abs/${paper.arxivId}`, "_blank", "noopener,noreferrer");
  }, [paper.arxivId]);

  if (disabled) {
    return <span className="pointer-events-none opacity-50">{trigger}</span>;
  }

  const authors = (paper.authors || []).join(", ");
  const categories = (paper.categories || []).join(", ");
  const publishedLine = [paper.publishedAt, paper.version ? `v${paper.version}` : null]
    .filter(Boolean)
    .join(" - ");
  const summaryMarkdown = getArxivSummaryDisplayMarkdown(paper);
  const showOverview = hasArxivOverview(paper);

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-[420px] max-h-[500px]">
        <div className="space-y-3">
          <DialogTitle className="text-base">{paper.title || paper.arxivId}</DialogTitle>

          <div className="space-y-1 text-xs text-[var(--soft-text-secondary)]">
            {authors ? <div>Authors: {authors}</div> : null}
            {categories ? <div>Categories: {categories}</div> : null}
            {publishedLine ? <div>Published: {publishedLine}</div> : null}
            {paper.arxivId ? <div>arXiv ID: {paper.arxivId}</div> : null}
          </div>

          <div className="rounded-lg border border-[var(--soft-border)] bg-[var(--soft-bg-surface)]/60 p-3">
            <div className="text-xs font-semibold text-[var(--soft-text-secondary)]">
              {showOverview ? "Summary" : "Abstract"}
            </div>
            <div className="mt-2 max-h-[200px] overflow-y-auto text-sm leading-relaxed text-[var(--text-main)]">
              {showOverview ? (
                <MarkdownRenderer
                  content={summaryMarkdown}
                  className="text-sm leading-relaxed text-[var(--text-main)]"
                />
              ) : (
                paper.abstract || "No abstract available."
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border border-[var(--soft-border)]",
                "px-3 py-1.5 text-xs font-medium text-[var(--text-main)]",
                "transition-colors hover:bg-[var(--soft-bg-surface)]"
              )}
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
              Copy BibTeX
            </button>
            <button
              type="button"
              onClick={handleOpen}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border border-[var(--soft-border)]",
                "px-3 py-1.5 text-xs font-medium text-[var(--text-main)]",
                "transition-colors hover:bg-[var(--soft-bg-surface)]"
              )}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open on arXiv
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ArxivDetailPopover;
