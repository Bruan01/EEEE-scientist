/**
 * Text Viewer Plugin Component
 *
 * @ds/plugin-text-viewer
 *
 * Displays plain text files with:
 * - Monospace font
 * - Optional line numbers
 * - Search/highlight (placeholder)
 * - Large file warning (> 1MB)
 */

"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { PluginComponentProps } from "@/lib/types/plugin";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { consumeFileJumpEffects } from "@/lib/ai/file-jump-queue";
import {
  FileText,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  Hash,
  WrapText,
  Search,
  X,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

/**
 * Size threshold for large file warning (1MB)
 */
const LARGE_FILE_THRESHOLD = 1024 * 1024;

/**
 * Maximum lines to render for performance
 */
const MAX_RENDERED_LINES = 10000;

/**
 * TextViewerPlugin - Main component
 */
export default function TextViewerPlugin({
  context,
  tabId,
  setDirty,
  setTitle,
}: PluginComponentProps) {
  // State
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(true);
  const [fileSize, setFileSize] = useState(0);
  const [showLargeFileWarning, setShowLargeFileWarning] = useState(false);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [matchPositions, setMatchPositions] = useState<number[]>([]);
  const [highlightRange, setHighlightRange] = useState<{ start: number; end: number } | null>(
    null
  );
  const highlightTimerRef = useRef<number | null>(null);

  const fileId = context.resourceId;

  // Get file name
  const fileName = context.resourceName || context.resourcePath || "Untitled";

  // Set tab title
  useEffect(() => {
    setTitle(fileName);
  }, [fileName, setTitle]);

  // Load file content
  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError(null);
      setShowLargeFileWarning(false);

      try {
        if (!context.resourceId) {
          // No file selected: show demo content
          setContent(DEMO_TEXT);
          setFileSize(DEMO_TEXT.length);
          setLoading(false);
          return;
        }

        // Load file content from API
        const { getFileContent } = await import("@/lib/api/files");
        const text = await getFileContent(context.resourceId);
        setContent(text);
        setFileSize(text.length);

        // Check for large file
        if (text.length > LARGE_FILE_THRESHOLD) {
          setShowLargeFileWarning(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load file");
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [context.resourceId]);

  // Split content into lines
  const lines = useMemo(() => content.split("\n"), [content]);

  // Limit rendered lines for performance
  const renderedLines = useMemo(() => {
    if (lines.length > MAX_RENDERED_LINES) {
      return lines.slice(0, MAX_RENDERED_LINES);
    }
    return lines;
  }, [lines]);

  const isTruncated = lines.length > MAX_RENDERED_LINES;

  const applyJump = useCallback(
    (detail: { fileId?: string; lineStart?: number; lineEnd?: number; line?: number }) => {
      if (!fileId || detail.fileId !== fileId) return;
      const startValue = detail.lineStart ?? detail.line ?? detail.lineEnd;
      if (!startValue) return;
      const endValue = detail.lineEnd ?? detail.line ?? detail.lineStart ?? startValue;
      const maxLine = Math.max(1, lines.length);
      const start = Math.min(Math.max(startValue, 1), maxLine);
      const end = Math.min(Math.max(endValue, start), maxLine);
      setHighlightRange({ start, end });
      const lineElement = document.getElementById(`line-${start - 1}`);
      if (lineElement) {
        lineElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightRange(null);
      }, 2500);
    },
    [fileId, lines.length]
  );

  useEffect(() => {
    if (!fileId) return;

    const processQueue = () => {
      const queued = consumeFileJumpEffects(fileId);
      queued.forEach((entry) => applyJump(entry.data));
    };

    processQueue();

    const handleJump = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        fileId?: string;
        lineStart?: number;
        lineEnd?: number;
        line?: number;
      };
      applyJump(detail);
    };

    const handleQueue = (event: Event) => {
      const detail = (event as CustomEvent).detail as { fileId?: string };
      if (!detail || detail.fileId !== fileId) return;
      processQueue();
    };

    window.addEventListener("ds:file:jump", handleJump as EventListener);
    window.addEventListener("ds:file:queue", handleQueue as EventListener);

    return () => {
      window.removeEventListener("ds:file:jump", handleJump as EventListener);
      window.removeEventListener("ds:file:queue", handleQueue as EventListener);
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
    };
  }, [applyJump, fileId]);

  // Search functionality
  useEffect(() => {
    if (!searchQuery.trim()) {
      setMatchPositions([]);
      setCurrentMatchIndex(0);
      return;
    }

    const query = searchQuery.toLowerCase();
    const positions: number[] = [];

    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(query)) {
        positions.push(index);
      }
    });

    setMatchPositions(positions);
    setCurrentMatchIndex(0);
  }, [searchQuery, lines]);

  // Navigate to match
  const goToMatch = useCallback(
    (direction: "next" | "prev") => {
      if (matchPositions.length === 0) return;

      let newIndex = currentMatchIndex;
      if (direction === "next") {
        newIndex = (currentMatchIndex + 1) % matchPositions.length;
      } else {
        newIndex =
          (currentMatchIndex - 1 + matchPositions.length) % matchPositions.length;
      }
      setCurrentMatchIndex(newIndex);

      // Scroll to match
      const lineElement = document.getElementById(`line-${matchPositions[newIndex]}`);
      if (lineElement) {
        lineElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    [currentMatchIndex, matchPositions]
  );

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [content]);

  // Format file size
  const formattedSize = useMemo(() => {
    if (fileSize < 1024) return `${fileSize} B`;
    if (fileSize < 1024 * 1024) return `${(fileSize / 1024).toFixed(1)} KB`;
    return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
  }, [fileSize]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + F for search
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
      }
      // Escape to close search
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
        setSearchQuery("");
      }
      // F3 or Enter for next match
      if (showSearch && (e.key === "F3" || (e.key === "Enter" && !e.shiftKey))) {
        e.preventDefault();
        goToMatch("next");
      }
      // Shift+F3 or Shift+Enter for previous match
      if (showSearch && ((e.key === "F3" && e.shiftKey) || (e.key === "Enter" && e.shiftKey))) {
        e.preventDefault();
        goToMatch("prev");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSearch, goToMatch]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span>Loading file...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="flex flex-col items-center gap-3 text-destructive">
          <AlertTriangle className="w-8 h-8" />
          <span>{error}</span>
          <button
            className="px-4 py-2 text-sm bg-destructive/10 hover:bg-destructive/20 rounded-lg transition-colors"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-foreground">{fileName}</span>
          <span className="text-xs text-muted-foreground">
            {lines.length} {lines.length === 1 ? "line" : "lines"} | {formattedSize}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Search toggle */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={cn(
              "p-2 rounded hover:bg-accent transition-colors",
              showSearch ? "text-primary bg-accent" : "text-muted-foreground"
            )}
            title="Search (Ctrl+F)"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Toggle line numbers */}
          <button
            onClick={() => setShowLineNumbers(!showLineNumbers)}
            className={cn(
              "p-2 rounded hover:bg-accent transition-colors",
              showLineNumbers ? "text-primary" : "text-muted-foreground"
            )}
            title="Toggle line numbers"
          >
            <Hash className="w-4 h-4" />
          </button>

          {/* Toggle word wrap */}
          <button
            onClick={() => setWordWrap(!wordWrap)}
            className={cn(
              "p-2 rounded hover:bg-accent transition-colors",
              wordWrap ? "text-primary" : "text-muted-foreground"
            )}
            title="Toggle word wrap"
          >
            <WrapText className="w-4 h-4" />
          </button>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="p-2 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/20">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
            autoFocus
          />
          {matchPositions.length > 0 && (
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {currentMatchIndex + 1} of {matchPositions.length}
            </span>
          )}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => goToMatch("prev")}
              disabled={matchPositions.length === 0}
              className="p-1 rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => goToMatch("next")}
              disabled={matchPositions.length === 0}
              className="p-1 rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery("");
              }}
              className="p-1 rounded hover:bg-accent"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Large File Warning */}
      {showLargeFileWarning && (
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/30 text-yellow-600 dark:text-yellow-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">
            Large file ({formattedSize}). Performance may be affected.
          </span>
          <button
            onClick={() => setShowLargeFileWarning(false)}
            className="ml-auto p-1 hover:bg-yellow-500/20 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="flex min-h-full">
          {/* Line Numbers */}
          {showLineNumbers && (
            <div className="flex-shrink-0 py-4 pr-4 text-right bg-muted/20 border-r border-border select-none sticky left-0">
              {renderedLines.map((_, index) => (
                <div
                  key={index}
                  id={`line-num-${index}`}
                  className={cn(
                    "px-4 text-xs leading-6 font-mono",
                    matchPositions.includes(index) &&
                      matchPositions[currentMatchIndex] === index
                      ? "text-primary font-bold"
                      : matchPositions.includes(index)
                      ? "text-primary/60"
                      : "text-muted-foreground"
                  )}
                >
                  {index + 1}
                </div>
              ))}
            </div>
          )}

          {/* Text Content */}
          <pre
            className={cn(
              "flex-1 py-4 px-4 font-mono text-sm leading-6 overflow-x-auto",
              wordWrap && "whitespace-pre-wrap break-all"
            )}
          >
            {renderedLines.map((line, index) => {
              const isCurrentMatch =
                matchPositions.length > 0 &&
                matchPositions[currentMatchIndex] === index;
              const hasMatch =
                searchQuery.trim() &&
                line.toLowerCase().includes(searchQuery.toLowerCase());
              const isCitationLine =
                highlightRange &&
                index + 1 >= highlightRange.start &&
                index + 1 <= highlightRange.end;

              return (
                <div
                  key={index}
                  id={`line-${index}`}
                  className={cn(
                    "min-h-[1.5rem]",
                    isCitationLine && "ds-citation-line-highlight",
                    isCurrentMatch && "bg-primary/20",
                    hasMatch && !isCurrentMatch && "bg-primary/10"
                  )}
                >
                  {hasMatch
                    ? highlightMatches(line, searchQuery)
                    : line || "\u00A0"}
                </div>
              );
            })}
            {isTruncated && (
              <div className="py-4 text-center text-muted-foreground border-t border-border mt-4">
                <AlertTriangle className="w-4 h-4 inline-block mr-2" />
                File truncated. Showing first {MAX_RENDERED_LINES.toLocaleString()}{" "}
                of {lines.length.toLocaleString()} lines.
              </div>
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}

/**
 * Highlight search matches in a line
 */
function highlightMatches(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const parts: React.ReactNode[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let lastIndex = 0;

  let index = lowerText.indexOf(lowerQuery);
  while (index !== -1) {
    // Add text before match
    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }
    // Add highlighted match
    parts.push(
      <mark
        key={index}
        className="bg-yellow-300 dark:bg-yellow-500/50 text-foreground px-0.5 rounded"
      >
        {text.slice(index, index + query.length)}
      </mark>
    );
    lastIndex = index + query.length;
    index = lowerText.indexOf(lowerQuery, lastIndex);
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/**
 * Demo text content
 */
const DEMO_TEXT = `DeepScientist - Text Viewer Demo
================================

This is a demonstration of the Text Viewer plugin.
It displays plain text files with optional features:

Features:
---------
1. Line numbers (toggle with # button)
2. Word wrap (toggle with wrap button)
3. Search functionality (Ctrl+F)
4. Copy to clipboard
5. Large file warning (> 1MB)

Keyboard Shortcuts:
------------------
- Ctrl+F: Open search
- Escape: Close search
- Enter: Next match
- Shift+Enter: Previous match
- F3: Next match
- Shift+F3: Previous match

Sample Log Output:
-----------------
[2025-12-18 10:30:15] INFO: Application started
[2025-12-18 10:30:16] DEBUG: Loading configuration from config.yaml
[2025-12-18 10:30:16] INFO: Database connection established
[2025-12-18 10:30:17] DEBUG: Cache initialized with 256MB limit
[2025-12-18 10:30:18] INFO: API server listening on port 8080
[2025-12-18 10:30:20] INFO: Worker pool started with 4 workers
[2025-12-18 10:30:22] DEBUG: Health check endpoint registered
[2025-12-18 10:30:25] INFO: Ready to accept connections

Environment Variables:
---------------------
NODE_ENV=production
DATABASE_URL=postgresql://localhost/deepscientist
REDIS_URL=redis://localhost:6379
API_KEY=sk-...
LOG_LEVEL=debug

This text viewer is designed as a fallback for files
that don't have a specialized viewer, such as:
- Plain text files (.txt)
- Log files (.log)
- Configuration files
- README files without markdown rendering

The viewer prioritizes readability and performance,
even for large files with thousands of lines.
`;
