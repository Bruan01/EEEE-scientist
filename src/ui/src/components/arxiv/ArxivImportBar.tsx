"use client";

import * as React from "react";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useArxivStore } from "@/lib/stores/arxiv-store";
import { cn } from "@/lib/utils";

const ARXIV_ID_PATTERN = /^\d{4}\.\d{4,5}$/;

function extractArxivId(input: string): string {
  const match = input.match(/(\d{4}\.\d{4,5})(v\d+)?/);
  return match ? match[1] : input.trim().replace(/v\d+$/, "");
}

function formatError(code: string): string {
  switch (code) {
    case "invalid_id":
      return "Invalid arXiv ID format";
    case "metadata_failed":
      return "Paper not found or metadata fetch failed";
    case "metadata_pending":
      return "Metadata timed out for now. Open the arXiv page directly.";
    case "download_failed":
      return "PDF download failed";
    case "already_exists":
      return "Paper already imported";
    case "queue_failed":
      return "Queue failed, please retry";
    case "storage_failed":
      return "Storage failed, please retry";
    case "timeout":
      return "Import timed out, please retry";
    default:
      return "Import failed, please retry";
  }
}

interface ArxivImportBarProps {
  disabled?: boolean;
}

export function ArxivImportBar({ disabled = false }: ArxivImportBarProps) {
  const { addToast } = useToast();
  const importArxiv = useArxivStore((s) => s.importArxiv);
  const importingIds = useArxivStore((s) => s.importingIds);
  const errors = useArxivStore((s) => s.errors);

  const [input, setInput] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);

  const normalizedId = extractArxivId(input);
  const isValid = ARXIV_ID_PATTERN.test(normalizedId);
  const isImporting = normalizedId
    ? Array.from(importingIds).some((id) => id === normalizedId || id.startsWith(normalizedId))
    : false;
  const errorCode = normalizedId
    ? errors[normalizedId] ||
      Object.entries(errors).find(([id]) => id.startsWith(normalizedId))?.[1] ||
      null
    : null;

  const handleSubmit = React.useCallback(async () => {
    if (disabled) return;
    if (!normalizedId || !isValid) {
      setLocalError("Enter a valid arXiv ID");
      return;
    }
    setLocalError(null);
    const result = await importArxiv(normalizedId);
    if (!result.ok) {
      return;
    }
    addToast({
      type: result.metadataPending ? "warning" : "success",
      title: result.metadataPending ? "Added with limited metadata" : "Added to arXiv library",
      description:
        result.message ||
        (result.metadataPending
          ? "Metadata timed out for now. You can open the arXiv page directly."
          : result.title || result.arxivId),
      duration: 2600,
    });
  }, [addToast, disabled, normalizedId, isValid, importArxiv]);

  const handlePaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLInputElement>) => {
      const text = event.clipboardData.getData("text");
      const extracted = extractArxivId(text);
      if (extracted && extracted !== text) {
        event.preventDefault();
        setInput(extracted);
      }
    },
    []
  );

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-1.5 py-1",
          disabled && "opacity-60"
        )}
      >
        <span className="shrink-0 whitespace-nowrap text-xs text-[var(--text-muted-on-dark)]">
          https://arxiv.org/pdf/
        </span>
        <input
          value={input}
          onChange={(event) => {
            setInput(extractArxivId(event.target.value));
            if (localError) setLocalError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleSubmit();
            }
          }}
          onPaste={handlePaste}
          className="min-w-0 flex-1 bg-transparent text-xs text-[var(--text-on-dark)] outline-none placeholder:text-[var(--text-muted-on-dark)]"
          placeholder=""
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={disabled || !isValid || isImporting}
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors",
            disabled || !isValid || isImporting
              ? "text-white/50"
              : "text-white/90 hover:bg-white/10 hover:text-white"
          )}
          title="Import arXiv"
          aria-label="Import arXiv"
        >
          {isImporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {localError || errorCode ? (
        <div className="mt-1 flex items-center gap-1 text-xs text-red-400">
          <AlertCircle className="h-3 w-3" />
          <span>{localError || (errorCode ? formatError(errorCode) : "")}</span>
        </div>
      ) : null}
    </div>
  );
}

export default ArxivImportBar;
