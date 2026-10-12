"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { downloadFileById } from "@/lib/api/files";
import { copyToClipboard } from "@/lib/clipboard";
import { useArxivStore } from "@/lib/stores/arxiv-store";
import { useFileTreeStore } from "@/lib/stores/file-tree";
import { useTabsStore } from "@/lib/stores/tabs";
import type { ArxivPaper } from "@/lib/types/arxiv";
import { generateBibTeX } from "@/lib/utils/bibtex";
import { cn } from "@/lib/utils";
import { ArxivItem } from "./ArxivItem";
import { ArxivContextMenu } from "./ArxivContextMenu";
import { ArxivInfoModal } from "./ArxivInfoModal";
import { BUILTIN_PLUGINS } from "@/lib/types/plugin";
import { InfoTriangleIcon } from "@/components/ui/info-triangle-icon";

function buildPlaceholder(arxivId: string, status: string): ArxivPaper {
  return {
    fileId: "",
    arxivId,
    metadataStatus: status === "failed" ? null : "pending",
    title: "",
    authors: [],
    abstract: "",
    categories: [],
    tags: [],
    publishedAt: "",
    displayName: arxivId,
    createdAt: "",
    status,
  };
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/]+/g, "_");
}

function buildPdfFileName(paper: ArxivPaper): string {
  const base = sanitizeFileName(paper.displayName || paper.arxivId || "arxiv-paper");
  if (base.toLowerCase().endsWith(".pdf")) return base;
  return `${base}.pdf`;
}

export type ArxivSortKey = "recent" | "title" | "year";

const STATUS_ORDER: Record<string, number> = {
  processing: 0,
  failed: 1,
  ready: 2,
};

function resolveTitle(paper: ArxivPaper): string {
  return paper.title || paper.displayName || paper.arxivId || "";
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function matchesQuery(paper: ArxivPaper, query: string): boolean {
  if (!query) return true;
  const haystack = [
    resolveTitle(paper),
    paper.displayName,
    paper.arxivId,
    (paper.authors || []).join(" "),
    (paper.categories || []).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function parseTimestamp(value: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getPublishedYear(paper: ArxivPaper): number {
  if (!paper.publishedAt) return 0;
  const match = paper.publishedAt.match(/\d{4}/);
  if (match) return Number(match[0]);
  const parsed = Date.parse(paper.publishedAt);
  if (Number.isNaN(parsed)) return 0;
  return new Date(parsed).getFullYear();
}

function comparePapers(a: ArxivPaper, b: ArxivPaper, sortKey: ArxivSortKey): number {
  const statusDelta = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
  if (statusDelta !== 0) return statusDelta;

  if (sortKey === "title") {
    return resolveTitle(a).localeCompare(resolveTitle(b));
  }

  if (sortKey === "year") {
    return getPublishedYear(b) - getPublishedYear(a);
  }

  return parseTimestamp(b.createdAt) - parseTimestamp(a.createdAt);
}

interface ArxivListProps {
  projectId: string;
  readOnly?: boolean;
  query?: string;
  sortKey?: ArxivSortKey;
  showHeader?: boolean;
  rowVariant?: "full" | "compact";
}

export function ArxivList({
  projectId,
  readOnly = false,
  query = "",
  sortKey = "recent",
  showHeader = true,
  rowVariant,
}: ArxivListProps) {
  const { addToast } = useToast();
  const items = useArxivStore((s) => s.items);
  const importingIds = useArxivStore((s) => s.importingIds);
  const errors = useArxivStore((s) => s.errors);
  const isLoading = useArxivStore((s) => s.isLoading);
  const selectedPaperKey = useArxivStore((s) => s.selectedPaperKey);
  const setSelectedPaperKey = useArxivStore((s) => s.setSelectedPaperKey);
  const clearSelection = useFileTreeStore((s) => s.clearSelection);
  const setFocused = useFileTreeStore((s) => s.setFocused);
  const openTab = useTabsStore((s) => s.openTab);
  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);

  const [contextMenu, setContextMenu] = React.useState<{
    paper: ArxivPaper;
    position: { x: number; y: number };
  } | null>(null);
  const [infoOpen, setInfoOpen] = React.useState(false);

  const existingIds = React.useMemo(() => new Set(items.map((item) => item.arxivId)), [items]);
  const normalizedQuery = React.useMemo(() => normalizeSearch(query), [query]);

  React.useEffect(() => {
    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    if (!activeTab) {
      setSelectedPaperKey(null);
      return;
    }
    if (activeTab.pluginId !== BUILTIN_PLUGINS.PDF_VIEWER) {
      setSelectedPaperKey(null);
      return;
    }
    if (activeTab.context?.type !== "file") {
      setSelectedPaperKey(null);
      return;
    }
    const resourceId = activeTab.context.resourceId;
    if (typeof resourceId !== "string") {
      setSelectedPaperKey(null);
      return;
    }

    const match = items.find((item) => item.fileId === resourceId);
    if (match) {
      setSelectedPaperKey(match.fileId || match.arxivId);
      clearSelection();
      setFocused(null);
    } else {
      setSelectedPaperKey(null);
    }
  }, [activeTabId, clearSelection, items, setFocused, setSelectedPaperKey, tabs]);

  const handleContextMenu = React.useCallback(
    (paper: ArxivPaper, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setSelectedPaperKey(paper.fileId || paper.arxivId);
      setContextMenu({
        paper,
        position: { x: event.clientX, y: event.clientY },
      });
    },
    [setSelectedPaperKey]
  );

  const handleSelectPaper = React.useCallback(
    (paper: ArxivPaper) => {
      setSelectedPaperKey(paper.fileId || paper.arxivId);
      clearSelection();
      setFocused(null);
    },
    [clearSelection, setFocused, setSelectedPaperKey]
  );

  const handleOpenPaper = React.useCallback(
    (paper: ArxivPaper) => {
      if (!paper.fileId || paper.status !== "ready") {
        return;
      }
      setSelectedPaperKey(paper.fileId || paper.arxivId);
      clearSelection();
      setFocused(null);
      openTab({
        pluginId: BUILTIN_PLUGINS.PDF_VIEWER,
        context: {
          type: "file",
          resourceId: paper.fileId,
          resourceName: paper.displayName || paper.arxivId,
          customData: {
            projectId,
            arxiv: { ...paper },
          },
        },
        title: paper.displayName || paper.arxivId,
      });
    },
    [clearSelection, openTab, projectId, setFocused, setSelectedPaperKey]
  );

  const downloadPdf = React.useCallback(
    async (paper: ArxivPaper) => {
      if (!paper.fileId || paper.status !== "ready") {
        addToast({
          type: "error",
          title: "PDF unavailable",
          description: "The PDF is still downloading.",
          duration: 2000,
        });
        return;
      }
      try {
        await downloadFileById(paper.fileId, buildPdfFileName(paper));
      } catch (error) {
        addToast({
          type: "error",
          title: "Download failed",
          description: "Could not download the PDF.",
          duration: 2000,
        });
      }
    },
    [addToast]
  );

  const handleDownloadPdf = React.useCallback(
    (paper: ArxivPaper) => {
      setContextMenu(null);
      void downloadPdf(paper);
    },
    [downloadPdf]
  );

  const pending = React.useMemo(
    () => Array.from(importingIds).filter((id) => !existingIds.has(id)),
    [importingIds, existingIds]
  );

  const errorIds = React.useMemo(
    () =>
      Object.keys(errors).filter(
        (id) => id !== "batch" && !existingIds.has(id) && !pending.includes(id)
      ),
    [errors, existingIds, pending]
  );

  const placeholderItems = React.useMemo(
    () => [
      ...errorIds.map((id) => buildPlaceholder(id, "failed")),
      ...pending.map((id) => buildPlaceholder(id, "processing")),
    ],
    [errorIds, pending]
  );

  const allItems = React.useMemo(() => [...placeholderItems, ...items], [items, placeholderItems]);

  const visibleItems = React.useMemo(() => {
    return allItems
      .filter((paper) => matchesQuery(paper, normalizedQuery))
      .sort((a, b) => comparePapers(a, b, sortKey));
  }, [allItems, normalizedQuery, sortKey]);

  const selectedPaper = React.useMemo(() => {
    if (!selectedPaperKey) return null;
    return (
      allItems.find((paper) => (paper.fileId || paper.arxivId) === selectedPaperKey) || null
    );
  }, [allItems, selectedPaperKey]);

  const selectedErrorCode = selectedPaper ? errors[selectedPaper.arxivId] : undefined;

  const handleOpenArxiv = React.useCallback(() => {
    if (!selectedPaper?.arxivId) return;
    window.open(`https://arxiv.org/abs/${selectedPaper.arxivId}`, "_blank", "noopener,noreferrer");
  }, [selectedPaper]);

  const handleCopyBibtex = React.useCallback(async () => {
    if (!selectedPaper) return;
    const bibtex = generateBibTeX(selectedPaper);
    const success = await copyToClipboard(bibtex);
    if (success) {
      addToast({
        type: "success",
        title: "BibTeX copied",
        description: selectedPaper.title || selectedPaper.arxivId,
        duration: 1800,
      });
    } else {
      addToast({
        type: "error",
        title: "Copy failed",
        description: "Please try again.",
        duration: 1800,
      });
    }
  }, [addToast, selectedPaper]);

  const handleCopyBibtexForPaper = React.useCallback(
    async (paper: ArxivPaper) => {
      const bibtex = generateBibTeX(paper);
      const success = await copyToClipboard(bibtex);
      setContextMenu(null);
      addToast({
        type: success ? "success" : "error",
        title: success ? "BibTeX copied" : "Copy failed",
        description: success ? paper.title || paper.arxivId : "Please try again.",
        duration: 1800,
      });
    },
    [addToast]
  );

  const handleOpenArxivForPaper = React.useCallback((paper: ArxivPaper) => {
    setContextMenu(null);
    if (!paper.arxivId) return;
    window.open(`https://arxiv.org/abs/${paper.arxivId}`, "_blank", "noopener,noreferrer");
  }, []);

  const menuPaper = contextMenu?.paper || null;
  const canDownloadPdf = Boolean(menuPaper?.fileId) && menuPaper?.status === "ready";
  const canOpenArxiv = Boolean(menuPaper?.arxivId);
  const canCopyBibtex = Boolean(menuPaper);

  const isEmpty = visibleItems.length === 0;
  const isInitialLoading =
    isLoading && items.length === 0 && pending.length === 0 && errorIds.length === 0;
  const emptyMessage = normalizedQuery
    ? "No matches for your search."
    : "No arXiv papers yet";
  const resolvedRowVariant = rowVariant || (showHeader ? "full" : "compact");

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="file-tree-scroll flex-1 min-h-0 overflow-x-hidden overflow-y-auto">
          {showHeader ? (
            <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_80px] items-center gap-2 border-b border-white/10 bg-[var(--bg-panel-left)] px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--text-muted-on-dark)]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setInfoOpen(true)}
                  disabled={!selectedPaper}
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded",
                    "text-[var(--text-muted-on-dark)] transition-colors",
                    "hover:text-[var(--text-on-dark)] hover:bg-white/10",
                    !selectedPaper && "cursor-not-allowed opacity-40"
                  )}
                  aria-label="Paper info"
                  title={selectedPaper ? "Paper info" : "Select a paper to view info"}
                >
                  <InfoTriangleIcon className="h-3.5 w-3.5" />
                </button>
                <span className="truncate">Title</span>
              </div>
              <span className="text-right">Year</span>
            </div>
          ) : null}
          {isInitialLoading ? (
            <div className="flex h-32 items-center justify-center text-xs text-[var(--text-muted-on-dark)]">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Loading...
            </div>
          ) : isEmpty ? (
            <div className="flex h-32 items-center justify-center text-xs text-[var(--text-muted-on-dark)]">
              {emptyMessage}
            </div>
          ) : (
            <div className="space-y-1 px-1.5 py-1">
              {visibleItems.map((paper) => (
                <ArxivItem
                  key={paper.fileId || paper.arxivId}
                  paper={paper}
                  errorCode={errors[paper.arxivId]}
                  isSelected={selectedPaperKey === (paper.fileId || paper.arxivId)}
                  onSelect={handleSelectPaper}
                  onOpen={handleOpenPaper}
                  onContextMenu={handleContextMenu}
                  variant={resolvedRowVariant}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {contextMenu && menuPaper && (
        <ArxivContextMenu
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onDownloadPdf={() => handleDownloadPdf(menuPaper)}
          onCopyBibtex={() => void handleCopyBibtexForPaper(menuPaper)}
          onOpenArxiv={() => handleOpenArxivForPaper(menuPaper)}
          onDelete={() => {}}
          canDownloadPdf={canDownloadPdf}
          canCopyBibtex={canCopyBibtex}
          canOpenArxiv={canOpenArxiv}
          canDelete={false}
          readOnly
        />
      )}

      <ArxivInfoModal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        paper={selectedPaper}
        errorCode={selectedErrorCode}
        onCopyBibtex={selectedPaper ? handleCopyBibtex : undefined}
        onOpenArxiv={selectedPaper ? handleOpenArxiv : undefined}
      />
    </>
  );
}

export default ArxivList;
