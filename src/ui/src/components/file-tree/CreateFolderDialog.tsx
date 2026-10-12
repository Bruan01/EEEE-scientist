"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useFileTreeStore } from "@/lib/stores/file-tree";
import type { FileNode } from "@/lib/types/file";
import { cn } from "@/lib/utils";

export interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: string | null;
  defaultName?: string;
  onCreated?: (folder: FileNode) => void;
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  parentId,
  defaultName,
  onCreated,
}: CreateFolderDialogProps) {
  const { createFolder, highlightFile } = useFileTreeStore();
  const [name, setName] = React.useState(defaultName || "");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setName(defaultName || "");
    setIsSubmitting(false);
    setError(null);
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [defaultName, open]);

  const canSubmit = name.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const folder = await createFolder(parentId, name.trim());
      highlightFile(folder.id);
      onCreated?.(folder);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create folder";
      setError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-md",
          "border-black/10 bg-white/90 backdrop-blur-xl",
          "shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-[var(--text-main)]">New folder</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <div className="text-xs font-medium text-[var(--text-muted)]">Name</div>
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. research-notes"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            className="h-10 bg-white border-black/[0.08] focus-visible:ring-[var(--brand)]/25"
          />
          {error ? (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-2">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} loading={isSubmitting}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateFolderDialog;
