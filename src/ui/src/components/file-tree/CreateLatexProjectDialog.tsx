"use client";

import * as React from "react";
import { Braces, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SegmentedControl, type SegmentedItem } from "@/components/ui/segmented-control";
import { useFileTreeStore } from "@/lib/stores/file-tree";
import type { FileNode } from "@/lib/types/file";
import type { LatexCompiler } from "@/lib/api/latex";
import { cn } from "@/lib/utils";
import { PngIcon } from "@/components/ui/png-icon";

const compilerItems: SegmentedItem<LatexCompiler>[] = [
  { value: "pdflatex", label: "pdfLaTeX", icon: <FileText className="h-4 w-4" /> },
  {
    value: "xelatex",
    label: "XeLaTeX",
    icon: (
      <PngIcon
        name="Braces"
        size={16}
        className="h-4 w-4"
        fallback={<Braces className="h-4 w-4" />}
      />
    ),
  },
  {
    value: "lualatex",
    label: "LuaLaTeX",
    icon: (
      <PngIcon
        name="Braces"
        size={16}
        className="h-4 w-4"
        fallback={<Braces className="h-4 w-4" />}
      />
    ),
  },
];

export interface CreateLatexProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: string | null;
  defaultName?: string;
  onCreated?: (folder: FileNode) => void;
}

export function CreateLatexProjectDialog({
  open,
  onOpenChange,
  parentId,
  defaultName = "LaTeX",
  onCreated,
}: CreateLatexProjectDialogProps) {
  const { createLatexProject } = useFileTreeStore();
  const [name, setName] = React.useState(defaultName);
  const [compiler, setCompiler] = React.useState<LatexCompiler>("pdflatex");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setIsSubmitting(false);
    setName(defaultName);
    setCompiler("pdflatex");
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open, defaultName]);

  const canSubmit = name.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const folder = await createLatexProject(parentId, name.trim(), { compiler });
      onCreated?.(folder);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create LaTeX project";
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
          <DialogTitle className="text-[var(--text-main)]">New LaTeX project</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-medium text-[var(--text-muted)]">Name</div>
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Paper"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              className="h-10 bg-white border-black/[0.08] focus-visible:ring-[var(--brand)]/25"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-[var(--text-muted)]">Compiler</div>
            <SegmentedControl
              value={compiler}
              onValueChange={setCompiler}
              items={compilerItems}
              className="w-full justify-between bg-black/[0.03] border-black/[0.06]"
              ariaLabel="LaTeX compiler"
            />
          </div>

          {error ? (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
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

export default CreateLatexProjectDialog;

