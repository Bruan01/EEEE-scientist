"use client";

import * as React from "react";
import { BookOpen, ChevronDown, Loader2, Search } from "lucide-react";
import { isDemoProjectId } from "@/demo/projects";
import { acquireSocket } from "@/lib/plugins/notebook/lib/socket";
import { useArxivStore } from "@/lib/stores/arxiv-store";
import { useFileTreeStore } from "@/lib/stores/file-tree";
import { useTabsStore } from "@/lib/stores/tabs";
import { BUILTIN_PLUGINS } from "@/lib/types/plugin";
import { useToast } from "@/components/ui/toast";
import { ArxivImportBar } from "./ArxivImportBar";
import { ArxivList, type ArxivSortKey } from "./ArxivList";
import { cn } from "@/lib/utils";

interface ArxivPanelProps {
  projectId: string;
  readOnly?: boolean;
  className?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  variant?: "full" | "compact";
}

const ARXIV_POLL_INTERVAL_MS = 10000;

async function emitWithAck(
  socket: ReturnType<typeof acquireSocket>["socket"],
  event: string,
  data: unknown,
  timeoutMs = 8000
): Promise<void> {
  const socketAny: any = socket;
  if (typeof socketAny.timeout === "function" && typeof socketAny.emitWithAck === "function") {
    await socketAny.timeout(timeoutMs).emitWithAck(event, data);
    return;
  }

  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(() => resolve(), timeoutMs);
    socket.emit(event, data, () => {
      window.clearTimeout(timer);
      resolve();
    });
  });
}

function useArxivSocket(projectId: string, readOnly: boolean) {
  const isDemoProject = isDemoProjectId(projectId);
  const refresh = useArxivStore((s) => s.refresh);
  const markImported = useArxivStore((s) => s.markImported);
  const markFailed = useArxivStore((s) => s.markFailed);
  const setBatchProgress = useArxivStore((s) => s.setBatchProgress);
  const items = useArxivStore((s) => s.items);
  const importingIds = useArxivStore((s) => s.importingIds);

  // Polling fallback: check for processing items and refresh periodically
  React.useEffect(() => {
    if (!projectId) return;

    const hasProcessingItems = items.some((item) => item.status === "processing");
    const hasImportingIds = importingIds.size > 0;

    if (!hasProcessingItems && !hasImportingIds) return;

    // Poll at a gentle interval while there are processing items
    const intervalId = setInterval(() => {
      void refresh();
    }, ARXIV_POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [projectId, items, importingIds, refresh]);

  React.useEffect(() => {
    if (!projectId) return;
    if (isDemoProject) return;
    const { socket, release } = acquireSocket();

    const handleImported = (payload: any) => {
      if (!payload || payload.project_id !== projectId) return;
      console.log("[ArxivPanel] Received arxiv:imported", payload);
      if (payload.arxiv_id) {
        markImported(String(payload.arxiv_id));
      }
      void refresh();
    };

    const handleFailed = (payload: any) => {
      if (!payload || payload.project_id !== projectId) return;
      console.log("[ArxivPanel] Received arxiv:import_failed", payload);
      if (payload.arxiv_id) {
        markFailed(String(payload.arxiv_id), String(payload.error || "import_failed"));
      }
      void refresh();
    };

    const handleBatch = (payload: any) => {
      if (!payload || payload.project_id !== projectId) return;
      setBatchProgress({
        completed: Number(payload.completed || 0),
        total: Number(payload.total || 0),
        currentArxivId: payload.current_arxiv_id ? String(payload.current_arxiv_id) : undefined,
      });
    };

    socket.on("arxiv:imported", handleImported);
    socket.on("arxiv:import_failed", handleFailed);
    socket.on("arxiv:batch_progress", handleBatch);

    // Log connection status
    socket.on("connect", () => {
      console.log("[ArxivPanel] Socket connected");
      void emitWithAck(socket, "space:join", {
        spaceType: "workspace",
        spaceId: projectId,
        clientVersion: "1.0.0",
      })
        .then(() => console.log("[ArxivPanel] Joined workspace room"))
        .catch((err) => console.error("[ArxivPanel] Failed to join workspace room", err));
    });

    socket.on("disconnect", (reason) => {
      console.log("[ArxivPanel] Socket disconnected:", reason);
    });

    // Join room immediately if already connected
    if (socket.connected) {
      void emitWithAck(socket, "space:join", {
        spaceType: "workspace",
        spaceId: projectId,
        clientVersion: "1.0.0",
      })
        .then(() => console.log("[ArxivPanel] Joined workspace room"))
        .catch((err) => console.error("[ArxivPanel] Failed to join workspace room", err));
    }

    return () => {
      socket.off("arxiv:imported", handleImported);
      socket.off("arxiv:import_failed", handleFailed);
      socket.off("arxiv:batch_progress", handleBatch);
      socket.emit("space:leave", { spaceType: "workspace", spaceId: projectId });
      release();
    };
  }, [isDemoProject, projectId, readOnly, refresh, markImported, markFailed, setBatchProgress]);
}

export function ArxivPanel({
  projectId,
  readOnly = false,
  className,
  collapsible = false,
  collapsed = false,
  onCollapsedChange,
  variant = "full",
}: ArxivPanelProps) {
  const { addToast } = useToast();
  const load = useArxivStore((s) => s.load);
  const isLoading = useArxivStore((s) => s.isLoading);
  const items = useArxivStore((s) => s.items);
  const importingIds = useArxivStore((s) => s.importingIds);
  const errors = useArxivStore((s) => s.errors);
  const pendingOpenArxivId = useArxivStore((s) => s.pendingOpenArxivId);
  const setPendingOpenArxivId = useArxivStore((s) => s.setPendingOpenArxivId);
  const setSelectedPaperKey = useArxivStore((s) => s.setSelectedPaperKey);
  const clearSelection = useFileTreeStore((s) => s.clearSelection);
  const setFocused = useFileTreeStore((s) => s.setFocused);
  const openTab = useTabsStore((s) => s.openTab);
  const contentId = React.useId();
  const searchSectionId = React.useId();
  const isCollapsed = Boolean(collapsible && collapsed);
  const isCompact = variant === "compact";
  const [query, setQuery] = React.useState("");
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [sortKey, setSortKey] = React.useState<ArxivSortKey>("recent");
  const itemStatusRef = React.useRef<Map<string, string>>(new Map());
  const itemHydratedRef = React.useRef(false);

  React.useEffect(() => {
    void load(projectId);
  }, [projectId, load]);

  React.useEffect(() => {
    if (!projectId || !pendingOpenArxivId) return;
    const paper = items.find((item) => item.arxivId === pendingOpenArxivId);
    if (!paper || paper.status !== "ready" || !paper.fileId) return;
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
    setPendingOpenArxivId(null);
  }, [
    clearSelection,
    items,
    openTab,
    pendingOpenArxivId,
    projectId,
    setFocused,
    setPendingOpenArxivId,
    setSelectedPaperKey,
  ]);

  React.useEffect(() => {
    const nextMap = new Map(items.map((item) => [item.arxivId, `${item.status}:${item.metadataStatus || "none"}`]));
    if (!itemHydratedRef.current) {
      itemStatusRef.current = nextMap;
      itemHydratedRef.current = true;
      return;
    }
    for (const item of items) {
      const previous = itemStatusRef.current.get(item.arxivId) || "";
      const current = `${item.status}:${item.metadataStatus || "none"}`;
      if (previous === current) {
        continue;
      }
      if (!previous.startsWith("ready:") && item.status === "ready") {
        addToast({
          type: "success",
          title: "arXiv PDF ready",
          description: item.title || item.arxivId,
          duration: 2200,
        });
      } else if (
        item.metadataStatus === "pending" &&
        !previous.endsWith(":pending")
      ) {
        addToast({
          type: "warning",
          title: "Metadata pending",
          description: item.absUrl || `https://arxiv.org/abs/${item.arxivId}`,
          duration: 2600,
        });
      } else if (!previous.startsWith("failed:") && item.status === "failed") {
        addToast({
          type: "error",
          title: "arXiv import failed",
          description: item.title || item.arxivId,
          duration: 2600,
        });
      }
    }
    itemStatusRef.current = nextMap;
  }, [addToast, items]);

  useArxivSocket(projectId, readOnly);

  const counts = React.useMemo(() => {
    const existingIds = new Set(items.map((item) => item.arxivId));
    const pendingIds = Array.from(importingIds).filter((id) => !existingIds.has(id));
    const errorIds = Object.keys(errors).filter(
      (id) => id !== "batch" && !existingIds.has(id) && !pendingIds.includes(id)
    );

    return {
      total: items.length + pendingIds.length + errorIds.length,
    };
  }, [errors, importingIds, items]);

  const header = (
    <div className={cn("flex items-center justify-between", isCollapsed ? "mb-0" : "mb-2")}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted-on-dark)]">
        <BookOpen className="h-3.5 w-3.5" />
        <span>ArXiv Library</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-[var(--text-muted-on-dark)]">
          {counts.total} items
        </span>
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--text-muted-on-dark)]" />
        ) : null}
        {collapsible ? (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-[var(--text-muted-on-dark)] transition-transform",
              isCollapsed ? "-rotate-90" : "rotate-0"
            )}
          />
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      data-onboarding-id="workspace-arxiv"
      className={cn(
        "flex min-w-0 flex-col overflow-hidden border-t border-[var(--border-dark)] px-3",
        isCollapsed ? "py-1.5" : "py-2",
        className
      )}
    >
      {collapsible ? (
        <button
          type="button"
          className="w-full text-left"
          onClick={() => onCollapsedChange?.(!isCollapsed)}
          aria-expanded={!isCollapsed}
          aria-controls={contentId}
        >
          {header}
        </button>
      ) : (
        header
      )}

      {isCollapsed ? null : (
        <div id={contentId} className="flex min-h-0 flex-1 flex-col gap-2">
          {isCompact ? (
            <>
              <ArxivImportBar disabled={readOnly} />
              <div className="flex-1 min-h-0 overflow-hidden">
                <ArxivList
                  projectId={projectId}
                  readOnly={readOnly}
                  showHeader={false}
                  rowVariant="compact"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSearchOpen((prev) => {
                      const next = !prev;
                      if (!next) setQuery("");
                      return next;
                    });
                  }}
                  aria-expanded={isSearchOpen}
                  aria-controls={searchSectionId}
                  className={cn(
                    "flex w-full items-center justify-between px-1.5 py-1 text-[10px]",
                    "uppercase tracking-wide text-[var(--text-muted-on-dark)] transition-colors",
                    "hover:text-[var(--text-on-dark)]"
                  )}
                >
                  <span>Search</span>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform",
                      isSearchOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </button>
                <div id={searchSectionId} hidden={!isSearchOpen} aria-hidden={!isSearchOpen}>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 min-w-0">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted-on-dark)]" />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search title, author, or arXiv ID"
                        className={cn(
                          "h-8 w-full rounded-md border border-white/10 bg-white/5",
                          "pl-8 pr-2 text-xs text-[var(--text-on-dark)]",
                          "placeholder:text-[var(--text-muted-on-dark)] outline-none focus:border-white/20"
                        )}
                      />
                    </div>
                    <select
                      value={sortKey}
                      onChange={(event) => setSortKey(event.target.value as ArxivSortKey)}
                      className={cn(
                        "h-8 rounded-md border border-white/10 bg-white/5 px-2",
                        "text-xs text-[var(--text-on-dark)] outline-none"
                      )}
                      aria-label="Sort papers"
                    >
                      <option value="recent">Recent</option>
                      <option value="title">Title</option>
                      <option value="year">Year</option>
                    </select>
                  </div>
                </div>
                <ArxivImportBar disabled={readOnly} />
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <ArxivList
                  projectId={projectId}
                  readOnly={readOnly}
                  query={query}
                  sortKey={sortKey}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ArxivPanel;
