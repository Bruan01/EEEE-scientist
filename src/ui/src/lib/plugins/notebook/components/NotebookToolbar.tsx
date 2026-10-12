"use client";

/**
 * NotebookToolbar Component
 *
 * @ds/plugin-notebook
 *
 * Editor toolbar with save status and lightweight local actions.
 * Shows auto-save status indicator.
 */

import React, { useCallback, useState } from "react";
import {
  Check,
  Loader2,
  AlertCircle,
  Copy,
} from "lucide-react";
import type { AutoSaveStatus } from "../types";
import { useToast } from "@/components/ui/toast";
import { getFileContent } from "@/lib/api/files";
import { useI18n } from "@/lib/i18n/useI18n";

/**
 * NotebookToolbar Props
 */
interface NotebookToolbarProps {
  /** Notebook ID */
  notebookId: string;

  /** Whether the editor is in readonly mode */
  readonly?: boolean;

  /** Auto-save status */
  autoSaveStatus: AutoSaveStatus;

  /** Get current markdown content (for copy) */
  getMarkdown?: () => string | Promise<string>;

  /** Toggle copy action */
  allowCopy?: boolean;
}

/**
 * Auto-save status indicator component
 */
function SaveStatusIndicator({ status }: { status: AutoSaveStatus }) {
  const { t } = useI18n("notebook");

  switch (status) {
    case "saving":
      return (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>{t("saving")}</span>
        </div>
      );
    case "saved":
      return (
        <div className="flex items-center gap-1.5 text-xs text-green-600">
          <Check className="w-3 h-3" />
          <span>{t("saved")}</span>
        </div>
      );
    case "error":
      return (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="w-3 h-3" />
          <span>{t("save_failed")}</span>
        </div>
      );
    default:
      return null;
  }
}

/**
 * NotebookToolbar Component
 */
export function NotebookToolbar({
  notebookId,
  autoSaveStatus,
  getMarkdown,
  allowCopy = true,
}: NotebookToolbarProps) {
  const [isCopying, setIsCopying] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n("notebook");
  const canCopy = allowCopy && (Boolean(notebookId) || Boolean(getMarkdown));

  const resolveMarkdownContent = useCallback(async () => {
    if (getMarkdown) {
      const content = await Promise.resolve(getMarkdown());
      if (typeof content === "string") return content;
    }
    if (!notebookId) return "";
    return await getFileContent(notebookId);
  }, [getMarkdown, notebookId]);

  const handleCopy = useCallback(async () => {
    if (!canCopy) return;
    setIsCopying(true);
    try {
      const markdown = await resolveMarkdownContent();
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(markdown);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = markdown;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      toast({
        title: t("copy_success_title"),
        description: t("copy_success_desc"),
        variant: "success",
      });
    } catch (error) {
      console.error("[NotebookToolbar] Copy failed:", error);
      toast({
        title: t("copy_failed_title"),
        description: t("try_again"),
        variant: "destructive",
      });
    } finally {
      setIsCopying(false);
    }
  }, [canCopy, resolveMarkdownContent, t, toast]);

  return (
    <div className="notebook-toolbar flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Left section: Save status */}
      <div className="flex items-center gap-3">
        <SaveStatusIndicator status={autoSaveStatus} />
      </div>

      {/* Right section: Actions */}
      <div className="flex items-center gap-1">
        {canCopy ? (
          <button
            type="button"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            onClick={handleCopy}
            title={t("copy")}
          >
            {isCopying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default NotebookToolbar;
